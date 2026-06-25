/** Без import.meta.env — безопасно импортировать из vite.config.ts. */

export const DEFAULT_FORMS_API_ORIGIN = 'https://legal-forms.ru';

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
  return FORMS_API_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
