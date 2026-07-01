/** Без import.meta.env — безопасно импортировать из vite.config.ts. */

export const DEFAULT_FORMS_API_ORIGIN = 'https://legal-forms.ru';

/** Префикс маршрутов LF docstream (expertise flows) и qiankun entry. */
export const DEFAULT_FORMS_DOCSTREAM_PREFIX = '/docstream';

/** Qiankun entry + publicPath micro-app bundle forms-app. */
export const DEFAULT_FORMS_MICRO_APP_ENTRY_PATH = `${DEFAULT_FORMS_DOCSTREAM_PREFIX}/forms-app`;

export const DEFAULT_FORMS_MICRO_APP_ENTRY = `${DEFAULT_FORMS_API_ORIGIN}${DEFAULT_FORMS_MICRO_APP_ENTRY_PATH}/`;

export function buildFormsMicroAppEntry(origin?: string): string {
  const base = (origin ?? DEFAULT_FORMS_API_ORIGIN).replace(/\/$/, '');
  return `${base}${DEFAULT_FORMS_MICRO_APP_ENTRY_PATH}/`;
}

/** publicPath для qiankun / __INJECTED_PUBLIC_PATH_BY_QIANKUN__ в bundle LF. */
export function buildFormsMicroAppPublicPath(origin?: string): string {
  return buildFormsMicroAppEntry(origin);
}

export const FORMS_API_PATH_PREFIXES = [
  '/api/flow',
  '/api/flow_items',
  '/api/dictionaries',
  '/api/legal-expertise',
  '/api/v2/legal-expertise',
  '/api/initialize',
  '/api/forms',
  '/api/project_items',
  '/api/projects',
  '/api/glossary_items',
  '/api/compile',
  '/api/functions',
  '/api/postgrest',
  '/api/chat-service',
  '/api/egr-service',
  '/api/users/whoami',
  '/api/users/change_password',
  '/api/auth/token',
  '/api/auth/logout',
  '/api/reports/render',
] as const;

export function isLegalFormsApiPath(pathname: string): boolean {
  const apiPath = pathname.startsWith(`${DEFAULT_FORMS_DOCSTREAM_PREFIX}/api/`)
    ? pathname.slice(DEFAULT_FORMS_DOCSTREAM_PREFIX.length)
    : pathname;

  return FORMS_API_PATH_PREFIXES.some(
    (prefix) => apiPath === prefix || apiPath.startsWith(`${prefix}/`),
  );
}
