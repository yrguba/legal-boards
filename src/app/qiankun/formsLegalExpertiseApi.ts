import { tasksApi } from '../services/api';
import {
  DEFAULT_FORMS_API_ORIGIN,
  DEFAULT_FORMS_DOCSTREAM_PREFIX,
} from './formsMicroApp.constants';
import { extractExpertiseIdFromFormsPath } from './formsMicroAppPaths';
import { normalizeFormsAccessToken, persistFormsAccessToken } from './formsMicroAppBridge';

function resolveDocstreamOrigin(): string {
  const override = import.meta.env.VITE_FORMS_DOCSTREAM_ORIGIN?.trim().replace(/\/$/, '');
  if (override) return override;
  if (import.meta.env.DEV) {
    return `${window.location.origin}${DEFAULT_FORMS_DOCSTREAM_PREFIX}`;
  }
  return `${DEFAULT_FORMS_API_ORIGIN}${DEFAULT_FORMS_DOCSTREAM_PREFIX}`;
}

/** URL conclusion без access_token — токен добавляет formsMicroAppApiAuth fetch patch. */
export function buildLegalExpertiseConclusionUrl(
  expertiseId: string,
  previewMode = false,
): string {
  const base = resolveDocstreamOrigin().replace(/\/$/, '');
  const url = new URL(
    `${base}/api/v2/legal-expertise/${encodeURIComponent(expertiseId)}/conclusion`,
  );
  url.searchParams.set('preview_mode', previewMode ? 'true' : 'false');
  return url.toString();
}

export function resolveExpertiseIdForFormsPath(formsPath: string | null | undefined): string | null {
  if (!formsPath?.trim()) return null;
  return extractExpertiseIdFromFormsPath(formsPath);
}

const URL_KEYS = [
  'url',
  'link',
  'href',
  'documentUrl',
  'document_url',
  'fileUrl',
  'file_url',
  'downloadUrl',
  'download_url',
];

function findUrlInObject(obj: unknown, depth = 0): string | null {
  if (depth > 4 || obj == null) return null;
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : null;
  }
  if (typeof obj !== 'object') return null;

  const record = obj as Record<string, unknown>;
  for (const key of URL_KEYS) {
    const value = record[key];
    if (typeof value === 'string' && /^https?:\/\//i.test(value.trim())) {
      return value.trim();
    }
  }
  for (const value of Object.values(record)) {
    const found = findUrlInObject(value, depth + 1);
    if (found) return found;
  }
  return null;
}

export type ParsedLegalExpertiseConclusion =
  | { kind: 'url'; url: string; name?: string }
  | { kind: 'file'; blob: Blob; fileName: string; mimeType: string };

export async function parseLegalExpertiseConclusionResponse(
  res: Response,
): Promise<ParsedLegalExpertiseConclusion> {
  const location = res.headers.get('Location');
  if (location && /^https?:\/\//i.test(location.trim())) {
    return { kind: 'url', url: location.trim() };
  }

  const contentType = res.headers.get('Content-Type') ?? '';

  if (contentType.includes('application/json')) {
    const data = (await res.json()) as Record<string, unknown>;
    const url = findUrlInObject(data);
    if (url) {
      const name = typeof data.name === 'string' ? data.name.trim() : undefined;
      return { kind: 'url', url, name: name || undefined };
    }
    throw new Error('В ответе conclusion не найдена ссылка на документ');
  }

  if (
    contentType.includes('application/pdf') ||
    contentType.includes('application/octet-stream') ||
    contentType.includes('wordprocessingml') ||
    contentType.includes('msword')
  ) {
    const blob = await res.blob();
    const mimeType = contentType.split(';')[0]?.trim() || blob.type || 'application/octet-stream';
    const ext = mimeType.includes('pdf') ? 'pdf' : mimeType.includes('word') ? 'docx' : 'bin';
    return {
      kind: 'file',
      blob,
      fileName: `Документ LF.${ext}`,
      mimeType,
    };
  }

  const text = (await res.text()).trim();
  if (/^https?:\/\//i.test(text)) {
    return { kind: 'url', url: text };
  }

  try {
    const data = JSON.parse(text) as unknown;
    const url = findUrlInObject(data);
    if (url) return { kind: 'url', url };
  } catch {
    /* ignore */
  }

  throw new Error('Не удалось получить ссылку на документ из ответа LF');
}

export async function attachLegalExpertiseDocumentToTask(
  taskId: string,
  parsed: ParsedLegalExpertiseConclusion,
): Promise<void> {
  if (parsed.kind === 'url') {
    await tasksApi.attachLink(taskId, parsed.url, parsed.name ?? 'Документ LF');
    return;
  }

  const file = new File([parsed.blob], parsed.fileName, { type: parsed.mimeType });
  await tasksApi.uploadAttachment(taskId, file);
}

/** POST conclusion (preview_mode=true) — формирование документа после заполнения формы LF. */
export async function requestLegalExpertiseConclusion(
  expertiseId: string,
  accessToken: string,
): Promise<Response> {
  const clean = normalizeFormsAccessToken(accessToken);
  if (!clean) {
    throw new Error('LF access_token не задан');
  }
  persistFormsAccessToken(clean);

  const url = buildLegalExpertiseConclusionUrl(expertiseId, true);
  return fetch(url, { method: 'POST', credentials: 'omit' });
}

/** Conclusion → ссылка/файл → вложение задачи. */
export async function generateAndAttachLegalExpertiseDocument(
  taskId: string,
  formsPath: string,
  accessToken: string,
): Promise<ParsedLegalExpertiseConclusion> {
  const expertiseId = resolveExpertiseIdForFormsPath(formsPath);
  if (!expertiseId) {
    throw new Error('Не удалось определить expertiseId из пути к форме.');
  }

  const res = await requestLegalExpertiseConclusion(expertiseId, accessToken);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail.trim() || `Не удалось сформировать документ (HTTP ${res.status})`);
  }

  const parsed = await parseLegalExpertiseConclusionResponse(res);
  await attachLegalExpertiseDocumentToTask(taskId, parsed);
  return parsed;
}
