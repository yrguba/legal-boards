import type { EmployeeProfileField, PrismaClient } from '@prisma/client';

type DefaultField = {
  key: string;
  name: string;
  type: string;
  required: boolean;
  filterable: boolean;
  confidential: boolean;
  mask?: string;
  options?: string[];
  section: string;
  position: number;
};

export const SECTION_PERSONAL = 'Личные данные';
export const SECTION_STATUS = 'Статус и работа';
export const SECTION_CONTRACT = 'Данные договора';
export const SECTION_BANK = 'Банковские данные';

export const PROFILE_SECTION_ORDER = [
  SECTION_PERSONAL,
  SECTION_STATUS,
  SECTION_CONTRACT,
  SECTION_BANK,
];

export const DEFAULT_EMPLOYEE_PROFILE_FIELDS: DefaultField[] = [
  // Личные данные
  { key: 'fullName', name: 'ФИО', type: 'text', required: true, filterable: true, confidential: false, section: SECTION_PERSONAL, position: 0 },
  { key: 'birthDate', name: 'Дата рождения', type: 'date', required: false, filterable: false, confidential: true, section: SECTION_PERSONAL, position: 1 },
  { key: 'passport', name: 'Серия и номер паспорта', type: 'text', mask: 'passport', required: false, filterable: false, confidential: true, section: SECTION_PERSONAL, position: 2 },
  { key: 'passportIssueDate', name: 'Дата выдачи паспорта', type: 'date', required: false, filterable: false, confidential: true, section: SECTION_PERSONAL, position: 3 },
  { key: 'departmentCode', name: 'Код подразделения', type: 'text', mask: 'departmentCode', required: false, filterable: false, confidential: true, section: SECTION_PERSONAL, position: 4 },
  { key: 'registrationAddress', name: 'Адрес регистрации', type: 'textarea', required: false, filterable: false, confidential: true, section: SECTION_PERSONAL, position: 5 },
  { key: 'inn', name: 'ИНН', type: 'text', mask: 'digits', required: false, filterable: false, confidential: true, section: SECTION_PERSONAL, position: 6 },
  { key: 'snils', name: 'СНИЛС', type: 'text', mask: 'snils', required: false, filterable: false, confidential: true, section: SECTION_PERSONAL, position: 7 },
  { key: 'ogrnip', name: 'ОГРНИП', type: 'text', mask: 'digits', required: false, filterable: false, confidential: true, section: SECTION_PERSONAL, position: 8 },
  { key: 'personalEmail', name: 'Адрес электронной почты', type: 'text', required: false, filterable: false, confidential: true, section: SECTION_PERSONAL, position: 9 },
  { key: 'phone', name: 'Номер телефона', type: 'text', mask: 'phone', required: false, filterable: false, confidential: true, section: SECTION_PERSONAL, position: 10 },

  // Статус и работа
  {
    key: 'contractorStatus',
    name: 'Статус',
    type: 'select',
    required: false,
    filterable: true,
    confidential: false,
    options: ['Самозанятый', 'ФЛ', 'ЮЛ'],
    section: SECTION_STATUS,
    position: 11,
  },
  { key: 'jobTitle', name: 'Роль (должность)', type: 'text', required: false, filterable: true, confidential: false, section: SECTION_STATUS, position: 12 },
  {
    key: 'vatPayer',
    name: 'Является ли плательщиком НДС',
    type: 'select',
    required: false,
    filterable: false,
    confidential: false,
    options: ['Да', 'Нет'],
    section: SECTION_STATUS,
    position: 13,
  },

  // Данные договора
  { key: 'contractNumber', name: 'Номер договора', type: 'text', required: false, filterable: true, confidential: false, section: SECTION_CONTRACT, position: 14 },
  { key: 'contractStartDate', name: 'Срок действия: дата начала', type: 'date', required: false, filterable: true, confidential: false, section: SECTION_CONTRACT, position: 15 },
  { key: 'contractEndDate', name: 'Срок действия: дата окончания', type: 'date', required: false, filterable: true, confidential: false, section: SECTION_CONTRACT, position: 16 },
  { key: 'contractLimit', name: 'Лимит по договору', type: 'money', required: false, filterable: false, confidential: false, section: SECTION_CONTRACT, position: 17 },
  { key: 'maxServiceCost', name: 'Максимальная стоимость услуг', type: 'money', required: false, filterable: false, confidential: false, section: SECTION_CONTRACT, position: 18 },

  // Банковские данные (конфиденциально)
  { key: 'bankAccount', name: 'Расчётный счёт', type: 'text', mask: 'digits', required: false, filterable: false, confidential: true, section: SECTION_BANK, position: 19 },
  { key: 'bankName', name: 'Наименование банка', type: 'text', required: false, filterable: false, confidential: true, section: SECTION_BANK, position: 20 },
  { key: 'bik', name: 'БИК', type: 'text', mask: 'digits', required: false, filterable: false, confidential: true, section: SECTION_BANK, position: 21 },
  { key: 'corrAccount', name: 'Корреспондентский счёт', type: 'text', mask: 'digits', required: false, filterable: false, confidential: true, section: SECTION_BANK, position: 22 },
];

/** Ключи из предыдущей версии схемы, которые больше не используются. */
const OBSOLETE_KEYS = ['contractDate', 'contractValidUntil', 'contractTerminatedAt', 'city'];

/** Конфиденциальные ключи по умолчанию (страховка, если схема ещё не синхронизирована в БД). */
export const DEFAULT_CONFIDENTIAL_KEYS = new Set(
  DEFAULT_EMPLOYEE_PROFILE_FIELDS.filter((f) => f.confidential).map((f) => f.key),
);

export function canManageEmployeeProfile(role?: string, isWorkspaceOwner?: boolean): boolean {
  return isWorkspaceOwner === true || role === 'admin' || role === 'manager';
}

export async function ensureEmployeeProfileSchema(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<EmployeeProfileField[]> {
  for (const f of DEFAULT_EMPLOYEE_PROFILE_FIELDS) {
    await prisma.employeeProfileField.upsert({
      where: { workspaceId_key: { workspaceId, key: f.key } },
      create: {
        workspaceId,
        key: f.key,
        name: f.name,
        type: f.type,
        required: f.required,
        filterable: f.filterable,
        confidential: f.confidential,
        mask: f.mask ?? null,
        options: f.options ?? undefined,
        section: f.section,
        position: f.position,
      },
      update: {
        name: f.name,
        type: f.type,
        required: f.required,
        filterable: f.filterable,
        confidential: f.confidential,
        mask: f.mask ?? null,
        options: f.options ?? undefined,
        section: f.section,
        position: f.position,
      },
    });
  }

  await prisma.employeeProfileField.deleteMany({
    where: { workspaceId, key: { in: OBSOLETE_KEYS } },
  });

  return prisma.employeeProfileField.findMany({
    where: { workspaceId },
    orderBy: { position: 'asc' },
  });
}

export function profileFieldsToObject(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

export function getConfidentialKeys(schema: EmployeeProfileField[]): Set<string> {
  return new Set(schema.filter((f) => f.confidential).map((f) => f.key));
}

/** Убирает конфиденциальные ключи, если просматривающий не имеет к ним доступа. */
export function filterConfidentialFields(
  values: Record<string, unknown>,
  confidentialKeys: Set<string>,
  canSeeConfidential: boolean,
): Record<string, unknown> {
  if (canSeeConfidential) return values;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (!confidentialKeys.has(k)) out[k] = v;
  }
  return out;
}

const MASK_PATTERNS: Record<string, { re: RegExp; hint: string }> = {
  passport: { re: /^\d{4}-\d{6}$/, hint: 'формат 0000-000000' },
  departmentCode: { re: /^\d{3}-\d{3}$/, hint: 'формат 000-000' },
  snils: { re: /^\d{3}-\d{3}-\d{3} \d{2}$/, hint: 'формат 000-000-000 00' },
  phone: { re: /^\+7 \d{3} \d{3}-\d{2}-\d{2}$/, hint: 'формат +7 999 999-99-99' },
  digits: { re: /^\d+$/, hint: 'только цифры' },
};

export function validateProfileFields(
  schema: EmployeeProfileField[],
  values: Record<string, unknown>,
): { ok: true; sanitized: Record<string, unknown> } | { ok: false; error: string } {
  const sanitized: Record<string, unknown> = {};
  const byKey = new Map(schema.map((f) => [f.key, f]));

  for (const key of Object.keys(values)) {
    if (!byKey.has(key)) {
      return { ok: false, error: `Неизвестное поле профиля: ${key}` };
    }
  }

  for (const field of schema) {
    const raw = values[field.key];
    const empty =
      raw === undefined ||
      raw === null ||
      (typeof raw === 'string' && raw.trim() === '');

    if (empty) {
      if (field.required) {
        return { ok: false, error: `Поле «${field.name}» обязательно` };
      }
      continue;
    }

    if (field.mask) {
      const s = typeof raw === 'string' ? raw.trim() : '';
      const pattern = MASK_PATTERNS[field.mask];
      if (pattern && !pattern.re.test(s)) {
        return { ok: false, error: `Поле «${field.name}»: ${pattern.hint}` };
      }
      sanitized[field.key] = s;
      continue;
    }

    switch (field.type) {
      case 'text':
      case 'textarea':
        if (typeof raw !== 'string') {
          return { ok: false, error: `Поле «${field.name}» должно быть текстом` };
        }
        sanitized[field.key] = raw.trim();
        break;
      case 'money': {
        const s = typeof raw === 'string' ? raw.trim().replace(/\s/g, '') : String(raw);
        if (!/^\d+([.,]\d{1,2})?$/.test(s)) {
          return { ok: false, error: `Поле «${field.name}»: сумма (только цифры)` };
        }
        sanitized[field.key] = s.replace(',', '.');
        break;
      }
      case 'date': {
        const s = typeof raw === 'string' ? raw.trim() : '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
          return { ok: false, error: `Поле «${field.name}»: дата в формате YYYY-MM-DD` };
        }
        sanitized[field.key] = s;
        break;
      }
      case 'select': {
        const s = typeof raw === 'string' ? raw.trim() : '';
        const opts = Array.isArray(field.options) ? (field.options as string[]) : [];
        if (!opts.includes(s)) {
          return { ok: false, error: `Поле «${field.name}»: недопустимое значение` };
        }
        sanitized[field.key] = s;
        break;
      }
      default:
        sanitized[field.key] = raw;
    }
  }

  return { ok: true, sanitized };
}

export function stripProfileForMember<T extends { profileFields?: unknown }>(
  user: T,
): Omit<T, 'profileFields'> & { profileFields?: undefined } {
  const { profileFields: _p, ...rest } = user;
  return rest;
}

function profileText(v: unknown): string {
  return typeof v === 'string' ? v.toLowerCase() : '';
}

function profileDate(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export type CatalogFilters = {
  q?: string;
  role?: string;
  departmentId?: string;
  groupId?: string;
  fullName?: string;
  contractNumber?: string;
  contractorStatus?: string;
  jobTitle?: string;
  contractStartFrom?: string;
  contractStartTo?: string;
  contractEndFrom?: string;
  contractEndTo?: string;
  expiringWithinDays?: number;
};

export function matchesCatalogFilters(
  user: {
    name: string;
    email: string;
    role: string;
    departmentId: string | null;
    groupIds: string[];
    profileFields: Record<string, unknown>;
  },
  filters: CatalogFilters,
): boolean {
  if (filters.role && user.role !== filters.role) return false;
  if (filters.departmentId && user.departmentId !== filters.departmentId) return false;
  if (filters.groupId && !user.groupIds.includes(filters.groupId)) return false;

  const pf = user.profileFields;
  if (filters.q) {
    const q = filters.q.toLowerCase();
    const hay = [
      user.name,
      user.email,
      profileText(pf.fullName),
      profileText(pf.contractNumber),
      profileText(pf.jobTitle),
    ].join(' ');
    if (!hay.includes(q)) return false;
  }
  if (filters.fullName && !profileText(pf.fullName).includes(filters.fullName.toLowerCase())) return false;
  if (filters.contractNumber && !profileText(pf.contractNumber).includes(filters.contractNumber.toLowerCase())) {
    return false;
  }
  if (filters.contractorStatus && pf.contractorStatus !== filters.contractorStatus) return false;
  if (filters.jobTitle && !profileText(pf.jobTitle).includes(filters.jobTitle.toLowerCase())) return false;

  const cd = profileDate(pf.contractStartDate);
  if (filters.contractStartFrom && (!cd || cd < filters.contractStartFrom)) return false;
  if (filters.contractStartTo && (!cd || cd > filters.contractStartTo)) return false;

  const vu = profileDate(pf.contractEndDate);
  if (filters.contractEndFrom && (!vu || vu < filters.contractEndFrom)) return false;
  if (filters.contractEndTo && (!vu || vu > filters.contractEndTo)) return false;

  if (filters.expiringWithinDays != null && Number.isFinite(filters.expiringWithinDays)) {
    if (!vu) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(today);
    limit.setDate(limit.getDate() + filters.expiringWithinDays);
    const end = new Date(`${vu}T00:00:00`);
    if (end < today || end > limit) return false;
  }

  return true;
}

export async function assertUserGroupsMatchDepartment(
  prisma: PrismaClient,
  _userId: string,
  departmentId: string | null | undefined,
  groupIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (groupIds.length === 0) return { ok: true };
  if (!departmentId) {
    return { ok: false, error: 'Назначьте отдел перед добавлением в группу направления' };
  }

  const groups = await prisma.group.findMany({
    where: { id: { in: groupIds } },
    select: { id: true, name: true, departmentId: true },
  });

  if (groups.length !== groupIds.length) {
    return { ok: false, error: 'Одна или несколько групп не найдены' };
  }

  for (const g of groups) {
    if (g.departmentId !== departmentId) {
      return {
        ok: false,
        error: `Группа «${g.name}» не относится к выбранному отделу`,
      };
    }
  }

  return { ok: true };
}
