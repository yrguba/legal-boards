import type { UserAbsence, UserPresenceInfo, UserPresenceStatus } from '../types';

export const PRESENCE_OPTIONS: {
  value: Exclude<UserPresenceStatus, 'vacation'>;
  label: string;
}[] = [
  { value: 'available', label: 'Доступен' },
  { value: 'busy', label: 'Занят' },
  { value: 'dnd', label: 'Не беспокоить' },
  { value: 'meeting', label: 'На совещании' },
  { value: 'custom', label: 'Свой статус' },
];

export const ABSENCE_KIND_OPTIONS: { value: UserAbsence['kind']; label: string }[] = [
  { value: 'vacation', label: 'Отпуск' },
  { value: 'sick', label: 'Больничный' },
  { value: 'business_trip', label: 'Командировка' },
  { value: 'other', label: 'Другое' },
];

export function absenceKindLabel(kind: string | null | undefined): string {
  return ABSENCE_KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind ?? 'Отсутствие';
}

export function formatPresenceLabel(presence: UserPresenceInfo | null | undefined): string {
  if (!presence) return 'Доступен';
  if (presence.onAbsence) return absenceKindLabel(presence.absenceKind);
  switch (presence.status) {
    case 'available':
      return 'Доступен';
    case 'busy':
      return 'Занят';
    case 'dnd':
      return 'Не беспокоить';
    case 'meeting':
      return 'На совещании';
    case 'custom':
      return presence.customText?.trim() || 'Свой статус';
    case 'vacation':
      return 'В отпуске';
    default:
      return 'Доступен';
  }
}

export function presenceDotClass(presence: UserPresenceInfo | null | undefined): string {
  if (!presence || presence.status === 'available') return 'bg-emerald-500';
  if (presence.onAbsence || presence.status === 'vacation') return 'bg-amber-500';
  if (presence.status === 'busy' || presence.status === 'meeting') return 'bg-orange-500';
  if (presence.status === 'dnd') return 'bg-red-500';
  return 'bg-slate-400';
}

export function formatAbsenceRange(startDate: string, endDate: string): string {
  const fmt = (iso: string) => {
    try {
      return new Date(`${iso}T00:00:00`).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };
  return `${fmt(startDate)} — ${fmt(endDate)}`;
}

export function notifyPresenceUpdated() {
  window.dispatchEvent(new Event('lb-presence-updated'));
}

export function endOfTodayIso(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
