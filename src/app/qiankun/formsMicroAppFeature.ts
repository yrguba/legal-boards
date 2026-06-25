/** Feature flag: встроенный Legal Forms (qiankun). Без qiankun-зависимостей — можно импортировать из routes. */

function parseFormsMicroAppEnabled(): boolean {
  const raw = import.meta.env.VITE_FORMS_MICROAPP_ENABLED?.trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  /** По умолчанию: dev — вкл., prod — выкл. (безопасный деплой). */
  return import.meta.env.DEV;
}

export const FORMS_MICROAPP_ENABLED = parseFormsMicroAppEnabled();

export function isFormsMicroAppEnabled(): boolean {
  return FORMS_MICROAPP_ENABLED;
}
