/** Qiankun micro-app «forms» (entry: legal-forms.ru/docstream/forms-app). */

import {
  DEFAULT_FORMS_DOCSTREAM_PREFIX,
  DEFAULT_FORMS_MICRO_APP_ENTRY_PATH,
  DEFAULT_FORMS_API_ORIGIN,
  buildFormsMicroAppEntry,
  FORMS_API_PATH_PREFIXES,
  isLegalFormsApiPath,
} from './formsMicroApp.constants';

export { FORMS_API_PATH_PREFIXES, isLegalFormsApiPath };

export const FORMS_MICRO_APP_NAME = 'forms';

/** Префикс маршрутов React Router / qiankun activeRule на host. */
export const FORMS_HOST_ACTIVE_RULE = '/forms';

/** Basename роутера forms-app (Umi bundle: /forms/). */
export const FORMS_SUBAPP_BASENAME = FORMS_HOST_ACTIVE_RULE;

/** @deprecated alias */
export const FORMS_ACTIVE_RULE = FORMS_HOST_ACTIVE_RULE;

function normalizeMicroAppEntryPath(entry: string): string {
  const trimmed = entry.trim();
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

/** Qiankun entry: в dev — same-origin через Vite proxy, в prod — legal-forms.ru. */
export function resolveFormsMicroAppEntry(origin?: string): string {
  const override = import.meta.env.VITE_FORMS_MICRO_APP_ENTRY?.trim();
  if (override) return normalizeMicroAppEntryPath(override);
  if (import.meta.env.DEV) {
    return normalizeMicroAppEntryPath(DEFAULT_FORMS_MICRO_APP_ENTRY_PATH);
  }
  return buildFormsMicroAppEntry(origin);
}

export function resolveFormsMicroAppPublicPath(origin?: string): string {
  return resolveFormsMicroAppEntry(origin);
}

export const FORMS_MICRO_APP_ENTRY = resolveFormsMicroAppEntry();

/** Mount-узел forms-app (#legal-forms в index.html). */
export const FORMS_MICRO_APP_CONTAINER = '#legal-forms';

/** Origin Legal Forms API (standalone: https://legal-forms.ru/api/…). */
export const FORMS_API_ORIGIN =
  import.meta.env.VITE_FORMS_API_ORIGIN?.replace(/\/$/, '') ?? DEFAULT_FORMS_API_ORIGIN;
