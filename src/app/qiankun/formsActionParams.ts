import type { TaskField } from '../types';
import type { TaskForColumnChecks } from '../utils/boardColumnActions';
import { getDescriptionFieldId, getTitleFieldId } from '../pages/task/utils/taskFieldIds';
import { FORMS_ACTIVE_RULE, FORMS_MICRO_APP_ENTRY, resolveFormsMicroAppEntry } from './formsMicroApp.config';
import {
  FORMS_DEFAULT_EMBEDDED_PATH,
  mapStandaloneLegalFormsPathToHost,
  mapStandaloneLegalFormsUrlToHost,
  normalizeEmbeddedFormsHostPath,
  resolveFormsEntryPath,
} from './formsMicroAppPaths';
import {
  extractAccessTokenFromFormsRaw,
  persistFormsAccessToken,
  stripFormsEmbeddedQuery,
  syncAuthTokenForFormsApp,
} from './formsMicroAppBridge';

const FIELD_TEMPLATE = /^\{field:([^}]+)\}$/;

export type ResolvedFormsMount = {
  /** Путь для pushState в host (/forms/…). */
  embeddedPath: string | null;
  /** Qiankun entry ({origin}/docstream/forms-app/). */
  entry: string;
  /** Человекочитаемая причина, если путь не удалось разобрать. */
  error?: string;
};

function readTaskFieldValue(
  task: TaskForColumnChecks,
  fieldId: string,
  taskFields: TaskField[],
): unknown {
  const titleFieldId = getTitleFieldId(taskFields);
  const descriptionFieldId = getDescriptionFieldId(taskFields);
  if (titleFieldId && fieldId === titleFieldId) return task.title;
  if (descriptionFieldId && fieldId === descriptionFieldId) return task.description;
  return task.customFields?.[fieldId];
}

/** Статичное значение или `{field:customFieldId}` из задачи. */
export function resolveFormsActionParam(
  template: string | undefined,
  task: TaskForColumnChecks,
  taskFields: TaskField[],
): string {
  const raw = template?.trim() ?? '';
  if (!raw) return '';
  const match = raw.match(FIELD_TEMPLATE);
  if (match) {
    const val = readTaskFieldValue(task, match[1], taskFields);
    return val != null && val !== '' ? String(val) : '';
  }
  return raw;
}

function splitPathAndSearch(input: string): { pathname: string; search: string } {
  const queryIndex = input.indexOf('?');
  const pathname = (queryIndex >= 0 ? input.slice(0, queryIndex) : input).replace(/\/+$/, '') || '/';
  const search = queryIndex >= 0 ? input.slice(queryIndex) : '';
  return { pathname, search };
}

/**
 * Разбирает полный путь LF:
 * - https://host/docstream/expertise/…/flows/…
 * - https://host/expertises/v/436/expertise/…/flows/… (legacy)
 * - https://host/forms/{session}/flows/…
 * - /forms/{session}/flows/… (legacy /forms/expertise/… тоже нормализуется)
 * - /docstream/expertise/…
 */
export function parseFormsFullPath(raw: string): ResolvedFormsMount {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { embeddedPath: null, entry: FORMS_MICRO_APP_ENTRY, error: 'Путь не задан' };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const mapped = mapStandaloneLegalFormsUrlToHost(trimmed);
    if (mapped) {
      try {
        const url = new URL(trimmed);
        return {
          embeddedPath: stripFormsEmbeddedQuery(mapped),
          entry: resolveFormsMicroAppEntry(url.origin),
        };
      } catch {
        return { embeddedPath: stripFormsEmbeddedQuery(mapped), entry: FORMS_MICRO_APP_ENTRY };
      }
    }

    try {
      const url = new URL(trimmed);
      const pathname = url.pathname.replace(/\/+$/, '') || '/';
      if (pathname === FORMS_ACTIVE_RULE || pathname.startsWith(`${FORMS_ACTIVE_RULE}/`)) {
        return {
          embeddedPath: stripFormsEmbeddedQuery(pathname),
          entry: resolveFormsMicroAppEntry(url.origin),
        };
      }
    } catch {
      /* fall through */
    }

    return {
      embeddedPath: null,
      entry: FORMS_MICRO_APP_ENTRY,
      error: 'Не удалось разобрать URL Legal Forms — проверьте формат пути',
    };
  }

  const { pathname, search } = splitPathAndSearch(trimmed);
  const normalizedPath = normalizeEmbeddedFormsHostPath(pathname);

  const mappedStandalone = mapStandaloneLegalFormsPathToHost(normalizedPath);
  if (mappedStandalone) {
    return {
      embeddedPath: stripFormsEmbeddedQuery(mappedStandalone),
      entry: FORMS_MICRO_APP_ENTRY,
    };
  }

  if (normalizedPath === FORMS_ACTIVE_RULE || normalizedPath.startsWith(`${FORMS_ACTIVE_RULE}/`)) {
    return {
      embeddedPath: stripFormsEmbeddedQuery(normalizedPath),
      entry: FORMS_MICRO_APP_ENTRY,
    };
  }

  return {
    embeddedPath: null,
    entry: FORMS_MICRO_APP_ENTRY,
    error: 'Не удалось разобрать путь — укажите URL legal-forms.ru или /forms/{session}/flows/…',
  };
}

export type LegalFormsActionConfig = {
  formsPath?: string;
  /** Статичный LF access_token (пресет быстрого создания). */
  formsAccessToken?: string;
  formsAccessTokenFieldId?: string;
};

export function resolveFormsMountFromActionConfig(
  config: LegalFormsActionConfig,
  task: TaskForColumnChecks,
  taskFields: TaskField[],
): ResolvedFormsMount {
  const configured = config.formsPath?.trim() ?? '';
  const raw = configured
    ? resolveFormsActionParam(config.formsPath, task, taskFields).trim()
    : '';

  if (!raw) {
    if (configured.match(FIELD_TEMPLATE)) {
      return {
        embeddedPath: null,
        entry: FORMS_MICRO_APP_ENTRY,
        error: 'Поле задачи для пути LF пустое — заполните его или укажите статичный URL',
      };
    }
    return parseFormsFullPath(FORMS_DEFAULT_EMBEDDED_PATH);
  }

  const parsed = parseFormsFullPath(raw);
  if (parsed.embeddedPath) return parsed;

  const fallbackPath = resolveFormsEntryPath(
    splitPathAndSearch(raw).pathname,
    raw.includes('?') ? raw.slice(raw.indexOf('?')) : '',
  );
  if (fallbackPath.startsWith(`${FORMS_ACTIVE_RULE}/`)) {
    try {
      if (/^https?:\/\//i.test(raw)) {
        const url = new URL(raw);
        return {
          embeddedPath: stripFormsEmbeddedQuery(fallbackPath),
          entry: resolveFormsMicroAppEntry(url.origin),
        };
      }
    } catch {
      /* ignore */
    }
    return { embeddedPath: stripFormsEmbeddedQuery(fallbackPath), entry: FORMS_MICRO_APP_ENTRY };
  }

  return parsed;
}

export function resolveFormsAccessTokenForTask(
  config: LegalFormsActionConfig,
  task: TaskForColumnChecks,
  taskFields: TaskField[],
): string | null {
  const fromPreset = config.formsAccessToken?.trim();
  if (fromPreset) {
    return persistFormsAccessToken(fromPreset);
  }

  const configured = config.formsPath?.trim() ?? '';
  const rawPath = configured
    ? resolveFormsActionParam(config.formsPath, task, taskFields).trim()
    : '';
  const fromPath = rawPath ? extractAccessTokenFromFormsRaw(rawPath) : null;
  if (fromPath) {
    return persistFormsAccessToken(fromPath);
  }

  const fieldId = config.formsAccessTokenFieldId?.trim();
  if (fieldId) {
    const fromField = resolveFormsActionParam(`{field:${fieldId}}`, task, taskFields);
    if (fromField) {
      return persistFormsAccessToken(fromField);
    }
  }
  return syncAuthTokenForFormsApp('');
}
