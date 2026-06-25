import { FORMS_ACTIVE_RULE } from './formsMicroApp.config';

/**
 * Deep-link из standalone LF:
 * https://legal-forms.ru/expertises/v/436/expertise/{session}/flows/{id}/{key}/…
 * → /forms/436/expertise/{session}/flows/{id}/{key}/…
 */
const STANDALONE_FLOW_PATH =
  /^\/expertises\/v\/([^/]+)\/expertise\/([^/]+)\/flows\/([^/]+)\/([^/]+)(?:\/(.*))?\/?$/;

/** POC: рабочий flow без query (token передаётся отдельно). */
export const FORMS_DEFAULT_EMBEDDED_PATH =
  import.meta.env.VITE_FORMS_DEFAULT_PATH ??
  `${FORMS_ACTIVE_RULE}/436/expertise/18fb19e8-d0ce-4e6d-8e45-0a9d716b8998/flows/82KDS2T9/${encodeURIComponent('АМ')}/1907`;

export function isBareFormsRoute(pathname: string): boolean {
  return pathname === FORMS_ACTIVE_RULE || pathname === `${FORMS_ACTIVE_RULE}/`;
}

export function mapStandaloneLegalFormsPathToHost(pathname: string): string | null {
  const match = pathname.match(STANDALONE_FLOW_PATH);
  if (!match) return null;

  const [, projectVersion, sessionID, flowId, key, rest] = match;
  const tail = rest ? `/${rest}` : '';
  return `${FORMS_ACTIVE_RULE}/${projectVersion}/expertise/${sessionID}/flows/${flowId}/${key}${tail}`;
}

export function mapStandaloneLegalFormsUrlToHost(url: string): string | null {
  try {
    const parsed = new URL(url);
    return mapStandaloneLegalFormsPathToHost(parsed.pathname);
  } catch {
    return null;
  }
}

export function resolveFormsEntryPath(pathname: string, search: string): string {
  if (isBareFormsRoute(pathname)) {
    return search ? `${FORMS_DEFAULT_EMBEDDED_PATH}${search}` : FORMS_DEFAULT_EMBEDDED_PATH;
  }
  const mapped = mapStandaloneLegalFormsPathToHost(pathname);
  if (mapped) {
    return search ? `${mapped}${search}` : mapped;
  }
  return search ? `${pathname}${search}` : pathname;
}
