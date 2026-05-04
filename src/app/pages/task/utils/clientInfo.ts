import type { TaskField } from '../../../types';
import type { ClientInfo } from '../types';

export function extractClientInfo(
  customFields: Record<string, unknown> | undefined,
  taskFields: TaskField[],
): ClientInfo {
  const custom = customFields || {};
  let fullName: string | null = null;
  let organization: string | null = null;
  for (const f of taskFields) {
    const label = String(f.name || '');
    if (f.type !== 'text' && f.type !== 'textarea' && f.type !== 'select') continue;
    const raw = custom[f.id];
    if (raw == null || raw === '') continue;
    const val = Array.isArray(raw) ? raw.join(', ') : String(raw);
    if (/организац|компани|юр\.\s*лиц|инн|огрн|бик/i.test(label)) {
      if (!organization) organization = val;
      continue;
    }
    if (
      /клиент|фио|заказчик|контакт|представитель|полное\s+имя|контрагент/i.test(label) &&
      !/организац|юр\.\s*лиц/i.test(label)
    ) {
      if (!fullName) fullName = val;
    }
  }
  return { fullName, organization, email: null, phone: null, contactNotes: null };
}
