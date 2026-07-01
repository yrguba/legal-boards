import { FORMS_HOST_ACTIVE_RULE, FORMS_SUBAPP_BASENAME } from './formsMicroApp.config';
import { DEFAULT_FORMS_DOCSTREAM_PREFIX } from './formsMicroApp.constants';

/**
 * Deep-link standalone LF (clients bundle URL; маппим на forms-app host path):
 * https://legal-forms.ru/docstream/expertise/{session}/flows/{id}/{key}/…
 */
const DOCSTREAM_FLOW_PATH =
  /^\/docstream\/expertise\/([^/]+)\/flows\/([^/]+)\/([^/]+)(?:\/(.*))?\/?$/;

/**
 * Host embed (forms-app basename /forms/, внутренний route /:sessionID/flows/:id/:key/*):
 * /forms/{session}/flows/{id}/{key}/…
 */
const HOST_FLOW_PATH =
  /^\/forms\/(?!expertise\/)([^/]+)\/flows\/([^/]+)\/([^/]+)(?:\/(.*))?\/?$/;

/** Старый неверный host path с лишним /expertise/ — нормализуем в HOST_FLOW_PATH. */
const HOST_FLOW_LEGACY_EXPERTISE_PATH =
  /^\/forms\/expertise\/([^/]+)\/flows\/([^/]+)\/([^/]+)(?:\/(.*))?\/?$/;

/**
 * Legacy standalone:
 * https://legal-forms.ru/expertises/v/436/expertise/…
 */
const LEGACY_STANDALONE_FLOW_PATH =
  /^\/expertises\/v\/([^/]+)\/expertise\/([^/]+)\/flows\/([^/]+)\/([^/]+)(?:\/(.*))?\/?$/;

/** Legacy host: /forms/{version}/expertise/{session}/flows/… */
const LEGACY_HOST_FORMS_WITH_VERSION =
  /^\/forms\/([^/]+)\/expertise\/([^/]+)\/flows\/([^/]+)\/([^/]+)(?:\/(.*))?\/?$/;

export const FORMS_DEFAULT_TEST_FLOW_URL =
  'https://legal-forms.ru/docstream/expertise/8565495e-7d69-4771-a150-1c171c2902fe/flows/A5QUSFR4/Договоры/2008';

/** Дефолтный flow на host (/forms/{session}/flows/…). */
export const FORMS_DEFAULT_EMBEDDED_PATH =
  import.meta.env.VITE_FORMS_DEFAULT_PATH ??
  `${FORMS_HOST_ACTIVE_RULE}/8565495e-7d69-4771-a150-1c171c2902fe/flows/A5QUSFR4/${encodeURIComponent('Договоры')}/2008`;

export function isBareFormsRoute(pathname: string): boolean {
  return (
    pathname === FORMS_HOST_ACTIVE_RULE || pathname === `${FORMS_HOST_ACTIVE_RULE}/`
  );
}

function buildHostFlowPath(sessionID: string, flowId: string, key: string, rest?: string): string {
  const tail = rest ? `/${rest}` : '';
  return `${FORMS_HOST_ACTIVE_RULE}/${sessionID}/flows/${flowId}/${key}${tail}`;
}

function buildSubAppFlowPath(sessionID: string, flowId: string, key: string, rest?: string): string {
  const tail = rest ? `/${rest}` : '';
  return `${FORMS_SUBAPP_BASENAME}/${sessionID}/flows/${flowId}/${key}${tail}`;
}

function mapFlowPathMatch(
  match: RegExpMatchArray,
  build: typeof buildHostFlowPath,
): string {
  const [, sessionID, flowId, key, rest] = match;
  return build(sessionID, flowId, key, rest);
}

/** Маршрут для props qiankun (LF router basename = /forms). */
export function toSubAppRoutePath(hostOrSubAppPath: string): string {
  const path = hostOrSubAppPath.replace(/\/+$/, '') || '/';

  const docstreamMatch = path.match(DOCSTREAM_FLOW_PATH);
  if (docstreamMatch) return mapFlowPathMatch(docstreamMatch, buildSubAppFlowPath);

  const legacyExpertiseHost = path.match(HOST_FLOW_LEGACY_EXPERTISE_PATH);
  if (legacyExpertiseHost) return mapFlowPathMatch(legacyExpertiseHost, buildSubAppFlowPath);

  const hostMatch = path.match(HOST_FLOW_PATH);
  if (hostMatch) return mapFlowPathMatch(hostMatch, buildSubAppFlowPath);

  const legacyHost = path.match(LEGACY_HOST_FORMS_WITH_VERSION);
  if (legacyHost) {
    const [, , sessionID, flowId, key, rest] = legacyHost;
    return buildSubAppFlowPath(sessionID, flowId, key, rest);
  }

  if (path.startsWith(`${FORMS_SUBAPP_BASENAME}/`)) return path;
  return path;
}

/** Маршрут для React Router host (/forms/…). */
export function toHostRoutePath(input: string): string {
  const path = input.replace(/\/+$/, '') || '/';

  const docstreamMatch = path.match(DOCSTREAM_FLOW_PATH);
  if (docstreamMatch) return mapFlowPathMatch(docstreamMatch, buildHostFlowPath);

  const legacyExpertiseHost = path.match(HOST_FLOW_LEGACY_EXPERTISE_PATH);
  if (legacyExpertiseHost) return mapFlowPathMatch(legacyExpertiseHost, buildHostFlowPath);

  const hostMatch = path.match(HOST_FLOW_PATH);
  if (hostMatch) return path;

  const legacyHost = path.match(LEGACY_HOST_FORMS_WITH_VERSION);
  if (legacyHost) {
    const [, , sessionID, flowId, key, rest] = legacyHost;
    return buildHostFlowPath(sessionID, flowId, key, rest);
  }

  const legacyStandalone = path.match(LEGACY_STANDALONE_FLOW_PATH);
  if (legacyStandalone) {
    const [, , sessionID, flowId, key, rest] = legacyStandalone;
    return buildHostFlowPath(sessionID, flowId, key, rest);
  }

  if (path.startsWith(`${FORMS_HOST_ACTIVE_RULE}/`) || isBareFormsRoute(path)) return path;
  return path;
}

/** Нормализует pathname host (/forms/…), в т.ч. legacy /forms/{version}/…. */
export function normalizeEmbeddedFormsHostPath(pathname: string): string {
  return toHostRoutePath(pathname);
}

export function mapStandaloneLegalFormsPathToHost(pathname: string): string | null {
  if (pathname.match(HOST_FLOW_PATH)) return pathname;
  if (
    pathname.match(DOCSTREAM_FLOW_PATH) ||
    pathname.match(HOST_FLOW_LEGACY_EXPERTISE_PATH) ||
    pathname.match(LEGACY_STANDALONE_FLOW_PATH) ||
    pathname.match(LEGACY_HOST_FORMS_WITH_VERSION)
  ) {
    const host = toHostRoutePath(pathname);
    return host.match(HOST_FLOW_PATH) ? host : null;
  }
  return null;
}

export function mapStandaloneLegalFormsUrlToHost(url: string): string | null {
  try {
    return mapStandaloneLegalFormsPathToHost(new URL(url).pathname);
  } catch {
    return null;
  }
}

export function resolveFormsEntryPath(pathname: string, search: string): string {
  const hostPath = normalizeEmbeddedFormsHostPath(pathname);

  if (isBareFormsRoute(hostPath)) {
    return search ? `${FORMS_DEFAULT_EMBEDDED_PATH}${search}` : FORMS_DEFAULT_EMBEDDED_PATH;
  }

  if (hostPath.match(HOST_FLOW_PATH)) {
    return search ? `${hostPath}${search}` : hostPath;
  }

  const mapped = mapStandaloneLegalFormsPathToHost(pathname);
  if (mapped) {
    return search ? `${mapped}${search}` : mapped;
  }

  return search ? `${hostPath}${search}` : hostPath;
}

/** Redirect /docstream/expertise/… → /forms/{session}/flows/… (только host URL). */
export function docstreamBrowserPathToHost(pathname: string): string | null {
  if (!pathname.startsWith(`${DEFAULT_FORMS_DOCSTREAM_PREFIX}/`)) return null;
  if (pathname.startsWith(`${DEFAULT_FORMS_DOCSTREAM_PREFIX}/forms-app`)) return null;
  const hostPath = toHostRoutePath(pathname);
  if (hostPath === pathname) return null;
  return hostPath;
}

/** session / expertise id из пути LF (/docstream/expertise/{id}/… или /forms/{id}/flows/…). */
export function extractExpertiseIdFromFormsPath(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let pathname = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      pathname = new URL(trimmed).pathname;
    } catch {
      return null;
    }
  } else {
    const q = trimmed.indexOf('?');
    pathname = q >= 0 ? trimmed.slice(0, q) : trimmed;
  }

  pathname = pathname.replace(/\/+$/, '') || '/';

  const docstreamMatch = pathname.match(DOCSTREAM_FLOW_PATH);
  if (docstreamMatch) return docstreamMatch[1];

  const legacyExpertiseHost = pathname.match(HOST_FLOW_LEGACY_EXPERTISE_PATH);
  if (legacyExpertiseHost) return legacyExpertiseHost[1];

  const hostMatch = pathname.match(HOST_FLOW_PATH);
  if (hostMatch) return hostMatch[1];

  const legacyHost = pathname.match(LEGACY_HOST_FORMS_WITH_VERSION);
  if (legacyHost) return legacyHost[2];

  const legacyStandalone = pathname.match(LEGACY_STANDALONE_FLOW_PATH);
  if (legacyStandalone) return legacyStandalone[2];

  return null;
}
