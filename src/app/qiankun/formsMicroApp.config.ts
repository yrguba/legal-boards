/** Qiankun micro-app «forms» (headless-forms-app на legal-forms.ru). */

import { DEFAULT_FORMS_API_ORIGIN, FORMS_API_PATH_PREFIXES, isLegalFormsApiPath } from './formsMicroApp.constants';

export { FORMS_API_PATH_PREFIXES, isLegalFormsApiPath };

export const FORMS_MICRO_APP_NAME = 'forms';

/**
 * Префикс маршрутов host (activeRule qiankun).
 * У sub-app Umi default basename = `/forms/` (см. их umi bundle), не publicPath.
 */
export const FORMS_ACTIVE_RULE = '/forms';

export const FORMS_MICRO_APP_ENTRY =
  import.meta.env.VITE_FORMS_MICRO_APP_ENTRY ?? 'https://legal-forms.ru/headless-forms-app/';

/** Mount-узел sub-app (Umi / headless-forms). */
export const FORMS_MICRO_APP_CONTAINER = '#legal-forms';

/** Origin Legal Forms API (standalone: https://legal-forms.ru/api/…). */
export const FORMS_API_ORIGIN =
  import.meta.env.VITE_FORMS_API_ORIGIN?.replace(/\/$/, '') ?? DEFAULT_FORMS_API_ORIGIN;
