/** Вкладка «Клиенты LEXPRO» в Legal Boards (по умолчанию включена). */
export function isLexClientsTabEnabled(): boolean {
  const raw = process.env.LEXPRO_CLIENTS_ENABLED?.trim().toLowerCase();
  if (!raw) return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return raw === 'true' || raw === '1' || raw === 'yes';
}
