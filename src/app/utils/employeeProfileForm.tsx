import type { EmployeeProfileField, ProfileFieldMask } from '../types';

type ProfileValues = Record<string, string>;

export function profileValue(
  fields: ProfileValues | undefined,
  key: string,
): string {
  const v = fields?.[key];
  return typeof v === 'string' ? v : '';
}

export function buildProfileFormState(
  schema: EmployeeProfileField[],
  existing?: Record<string, unknown>,
): ProfileValues {
  const out: ProfileValues = {};
  for (const f of schema) {
    const raw = existing?.[f.key];
    out[f.key] = typeof raw === 'string' ? raw : '';
  }
  return out;
}

function onlyDigits(s: string): string {
  return s.replace(/\D+/g, '');
}

/** Форматирует ввод под выбранную маску (разрешены только цифры 0-9). */
export function applyMask(mask: ProfileFieldMask, raw: string): string {
  const d = onlyDigits(raw);

  if (mask === 'digits') return d;

  if (mask === 'passport') {
    const a = d.slice(0, 4);
    const b = d.slice(4, 10);
    return b ? `${a}-${b}` : a;
  }

  if (mask === 'departmentCode') {
    const a = d.slice(0, 3);
    const b = d.slice(3, 6);
    return b ? `${a}-${b}` : a;
  }

  if (mask === 'snils') {
    const a = d.slice(0, 3);
    const b = d.slice(3, 6);
    const c = d.slice(6, 9);
    const e = d.slice(9, 11);
    let out = a;
    if (b) out += `-${b}`;
    if (c) out += `-${c}`;
    if (e) out += ` ${e}`;
    return out;
  }

  if (mask === 'phone') {
    let nat = d;
    if (nat.startsWith('7') || nat.startsWith('8')) nat = nat.slice(1);
    nat = nat.slice(0, 10);
    if (!nat) return '';
    const g1 = nat.slice(0, 3);
    const g2 = nat.slice(3, 6);
    const g3 = nat.slice(6, 8);
    const g4 = nat.slice(8, 10);
    let out = `+7 ${g1}`;
    if (g2) out += ` ${g2}`;
    if (g3) out += `-${g3}`;
    if (g4) out += `-${g4}`;
    return out;
  }

  return raw;
}

function maskPlaceholder(mask: ProfileFieldMask): string {
  switch (mask) {
    case 'passport':
      return '0000-000000';
    case 'departmentCode':
      return '000-000';
    case 'snils':
      return '000-000-000 00';
    case 'phone':
      return '+7 999 999-99-99';
    case 'digits':
      return 'только цифры';
    default:
      return '';
  }
}

function moneyInput(raw: string): string {
  // Разрешаем цифры и один разделитель дробной части
  const cleaned = raw.replace(/[^\d.,]/g, '').replace(',', '.');
  const parts = cleaned.split('.');
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`;
}

export function renderProfileFieldInput(
  field: EmployeeProfileField,
  value: string,
  onChange: (key: string, value: string) => void,
  disabled?: boolean,
) {
  const common =
    'w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand text-sm disabled:bg-slate-50 disabled:text-slate-400';

  if (field.type === 'select') {
    return (
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(field.key, e.target.value)}
        className={common}
      >
        <option value="">—</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'date') {
    return (
      <input
        type="date"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(field.key, e.target.value)}
        className={common}
      />
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        value={value}
        disabled={disabled}
        rows={2}
        onChange={(e) => onChange(field.key, e.target.value)}
        className={common}
      />
    );
  }

  if (field.type === 'money') {
    return (
      <input
        type="text"
        inputMode="decimal"
        value={value}
        disabled={disabled}
        placeholder="0"
        onChange={(e) => onChange(field.key, moneyInput(e.target.value))}
        className={common}
      />
    );
  }

  if (field.mask) {
    const mask = field.mask;
    return (
      <input
        type="text"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        placeholder={maskPlaceholder(mask)}
        onChange={(e) => onChange(field.key, applyMask(mask, e.target.value))}
        className={common}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(field.key, e.target.value)}
      className={common}
    />
  );
}
