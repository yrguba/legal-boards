import type { PrismaClient } from '@prisma/client';

export type ColumnActionTrigger = 'on_enter' | 'on_exit';
export type ColumnActionKind = 'confirm' | 'form' | 'check_task';

export type ParsedCheckTaskItem =
  | { type: 'assignee_set' }
  | { type: 'description_set' }
  | { type: 'custom_field_set'; fieldId: string; label?: string }
  | { type: 'attachment_present' }
  | { type: 'conclusion_set' };

export type ParsedColumnActionRule = {
  id: string;
  name: string;
  columnId: string;
  trigger: ColumnActionTrigger;
  blocking: boolean;
  actionKind: ColumnActionKind;
  config: Record<string, unknown>;
};

type TaskForChecks = {
  title: string | null;
  assigneeId: string | null;
  description: string | null;
  conclusionText: string | null;
  customFields: unknown;
  _count?: { taskAttachments?: number };
  taskAttachments?: unknown[];
};

export type BoardTaskFieldLite = {
  id: string;
  name: string;
  type: string;
  required: boolean;
};

function getTitleFieldId(fields: BoardTaskFieldLite[]): string {
  const byName = fields.find(
    (f) => f.type === 'text' && String(f.name || '').trim().toLowerCase() === 'название',
  );
  if (byName) return byName.id;
  const requiredText = fields.find((f) => f.type === 'text' && f.required);
  return requiredText?.id ?? '';
}

function getDescriptionFieldId(fields: BoardTaskFieldLite[]): string {
  const byName = fields.find(
    (f) =>
      (f.type === 'textarea' || f.type === 'text') &&
      String(f.name || '').trim().toLowerCase() === 'описание',
  );
  return byName?.id ?? '';
}

function isEmptyCheckValue(val: unknown): boolean {
  if (val === undefined || val === null || val === false) return true;
  if (typeof val === 'string') return !val.trim();
  if (Array.isArray(val)) return val.length === 0;
  return false;
}

function getCheckFieldValue(
  task: TaskForChecks,
  fieldId: string,
  titleFieldId: string,
  descriptionFieldId: string,
): unknown {
  if (titleFieldId && fieldId === titleFieldId) return task.title;
  if (descriptionFieldId && fieldId === descriptionFieldId) return task.description;
  const cf =
    task.customFields && typeof task.customFields === 'object' && !Array.isArray(task.customFields)
      ? (task.customFields as Record<string, unknown>)
      : {};
  return cf[fieldId];
}

export function parseBoardColumnActionRules(advancedSettings: unknown): ParsedColumnActionRule[] {
  if (!advancedSettings || typeof advancedSettings !== 'object') return [];
  const root = advancedSettings as Record<string, unknown>;
  const ca = root.columnActions;
  if (!ca || typeof ca !== 'object') return [];
  const rawList = Array.isArray((ca as { rules?: unknown }).rules)
    ? (ca as { rules: unknown[] }).rules
    : [];

  const out: ParsedColumnActionRule[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const rule = item as Record<string, unknown>;
    const id = typeof rule.id === 'string' ? rule.id.trim() : '';
    const columnId = typeof rule.columnId === 'string' ? rule.columnId.trim() : '';
    if (!id || !columnId) continue;

    const name = typeof rule.name === 'string' ? rule.name.trim() : '';
    const trigger: ColumnActionTrigger =
      rule.trigger === 'on_exit' ? 'on_exit' : 'on_enter';
    const blocking = rule.blocking !== false;
    const actionKindRaw = typeof rule.actionKind === 'string' ? rule.actionKind : 'confirm';
    const actionKind: ColumnActionKind =
      actionKindRaw === 'form' || actionKindRaw === 'check_task' ? actionKindRaw : 'confirm';
    const config =
      rule.config && typeof rule.config === 'object' && !Array.isArray(rule.config)
        ? (rule.config as Record<string, unknown>)
        : {};

    out.push({ id, name, columnId, trigger, blocking, actionKind, config });
  }
  return out;
}

export function getColumnActionRulesFor(
  rules: ParsedColumnActionRule[],
  columnId: string,
  trigger: ColumnActionTrigger,
): ParsedColumnActionRule[] {
  return rules.filter((r) => r.columnId === columnId && r.trigger === trigger && r.blocking);
}

function parseCheckItems(config: Record<string, unknown>): ParsedCheckTaskItem[] {
  const raw = Array.isArray(config.checks) ? config.checks : [];
  const out: ParsedCheckTaskItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const c = item as Record<string, unknown>;
    const type = typeof c.type === 'string' ? c.type : '';
    if (type === 'assignee_set') out.push({ type: 'assignee_set' });
    else if (type === 'description_set') out.push({ type: 'description_set' });
    else if (type === 'attachment_present') out.push({ type: 'attachment_present' });
    else if (type === 'conclusion_set') out.push({ type: 'conclusion_set' });
    else if (type === 'custom_field_set' && typeof c.fieldId === 'string' && c.fieldId.trim()) {
      out.push({
        type: 'custom_field_set',
        fieldId: c.fieldId.trim(),
        label: typeof c.label === 'string' ? c.label : undefined,
      });
    }
  }
  return out;
}

export function runCheckTaskRule(
  task: TaskForChecks,
  rule: ParsedColumnActionRule,
  boardTaskFields: BoardTaskFieldLite[] = [],
): { ok: true } | { ok: false; messages: string[] } {
  const checks = parseCheckItems(rule.config);
  if (checks.length === 0) return { ok: true };

  const messages: string[] = [];
  const titleFieldId = getTitleFieldId(boardTaskFields);
  const descriptionFieldId = getDescriptionFieldId(boardTaskFields);
  const attachmentCount =
    task._count?.taskAttachments ??
    (Array.isArray(task.taskAttachments) ? task.taskAttachments.length : 0);

  for (const check of checks) {
    switch (check.type) {
      case 'assignee_set':
        if (!task.assigneeId) messages.push('назначен исполнитель');
        break;
      case 'description_set':
        if (isEmptyCheckValue(task.description)) messages.push('заполнено описание');
        break;
      case 'conclusion_set':
        if (isEmptyCheckValue(task.conclusionText)) messages.push('заполнено заключение');
        break;
      case 'attachment_present':
        if (attachmentCount < 1) messages.push('есть вложение');
        break;
      case 'custom_field_set': {
        const val = getCheckFieldValue(task, check.fieldId, titleFieldId, descriptionFieldId);
        if (isEmptyCheckValue(val)) {
          const field = boardTaskFields.find((f) => f.id === check.fieldId);
          messages.push(`заполнено поле «${field?.name || check.label || check.fieldId}»`);
        }
        break;
      }
    }
  }

  if (messages.length === 0) return { ok: true };
  return { ok: false, messages };
}

export async function getActionCompletionRuleIds(
  prisma: PrismaClient,
  taskId: string,
  columnId: string,
): Promise<Set<string>> {
  const rows = await prisma.taskColumnActionCompletion.findMany({
    where: { taskId, columnId },
    select: { ruleId: true },
  });
  return new Set(rows.map((r) => r.ruleId));
}

function interactiveRules(rules: ParsedColumnActionRule[]): ParsedColumnActionRule[] {
  return rules.filter((r) => r.actionKind === 'confirm' || r.actionKind === 'form');
}

export async function assertColumnExitActionsComplete(
  prisma: PrismaClient,
  task: TaskForChecks & { id: string; columnId: string },
  advancedSettings: unknown,
  boardTaskFields: BoardTaskFieldLite[] = [],
): Promise<{ ok: true } | { ok: false; message: string; code?: string }> {
  const allRules = parseBoardColumnActionRules(advancedSettings);
  const exitRules = getColumnActionRulesFor(allRules, task.columnId, 'on_exit');

  for (const rule of exitRules) {
    if (rule.actionKind === 'check_task') {
      const check = runCheckTaskRule(task, rule, boardTaskFields);
      if (!check.ok) {
        const label = rule.name || 'Проверка задачи';
        return {
          ok: false,
          code: 'column_actions_check_failed',
          message: `${label}: требуется ${check.messages.join(', ')}`,
        };
      }
    }
  }

  const completed = await getActionCompletionRuleIds(prisma, task.id, task.columnId);
  const pendingInteractive = interactiveRules(exitRules).filter((r) => !completed.has(r.id));
  if (pendingInteractive.length === 0) return { ok: true };

  const names = pendingInteractive.map((r) => r.name || 'Действие').join(', ');
  return {
    ok: false,
    code: 'column_actions_pending',
    message: `Перед сменой статуса выполните действия: ${names}`,
  };
}

export async function assertColumnEnterActionsComplete(
  prisma: PrismaClient,
  task: TaskForChecks & { id: string },
  targetColumnId: string,
  advancedSettings: unknown,
  boardTaskFields: BoardTaskFieldLite[] = [],
): Promise<{ ok: true } | { ok: false; message: string; code?: string }> {
  const allRules = parseBoardColumnActionRules(advancedSettings);
  const enterRules = getColumnActionRulesFor(allRules, targetColumnId, 'on_enter');

  for (const rule of enterRules) {
    if (rule.actionKind === 'check_task') {
      const check = runCheckTaskRule(task, rule, boardTaskFields);
      if (!check.ok) {
        const label = rule.name || 'Проверка задачи';
        return {
          ok: false,
          code: 'column_actions_check_failed',
          message: `${label}: требуется ${check.messages.join(', ')}`,
        };
      }
    }
  }

  const completed = await getActionCompletionRuleIds(prisma, task.id, targetColumnId);
  const pendingInteractive = interactiveRules(enterRules).filter((r) => !completed.has(r.id));
  if (pendingInteractive.length === 0) return { ok: true };

  const names = pendingInteractive.map((r) => r.name || 'Действие').join(', ');
  return {
    ok: false,
    code: 'column_actions_pending',
    message: `Для входа в статус выполните действия: ${names}`,
  };
}

export function findColumnActionRuleById(
  rules: ParsedColumnActionRule[],
  ruleId: string,
): ParsedColumnActionRule | undefined {
  return rules.find((r) => r.id === ruleId);
}

export function validateConfirmPayload(
  rule: ParsedColumnActionRule,
  payload: unknown,
): { ok: true } | { ok: false; message: string } {
  const obj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  if (obj.confirmed !== true) {
    return { ok: false, message: 'Подтвердите выполнение действия' };
  }
  const requireCheckbox = rule.config.requireCheckbox === true;
  if (requireCheckbox && obj.checkboxConfirmed !== true) {
    return { ok: false, message: 'Отметьте обязательный пункт' };
  }
  return { ok: true };
}

export function validateFormPayload(
  rule: ParsedColumnActionRule,
  payload: unknown,
): { ok: true; data: Record<string, unknown> } | { ok: false; message: string } {
  const fields = Array.isArray(rule.config.fields) ? rule.config.fields : [];
  const obj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const data: Record<string, unknown> = {};

  for (const raw of fields) {
    if (!raw || typeof raw !== 'object') continue;
    const f = raw as Record<string, unknown>;
    const key = typeof f.key === 'string' ? f.key.trim() : '';
    if (!key) continue;
    const label = typeof f.label === 'string' ? f.label : key;
    const required = f.required !== false;
    const val = obj[key];

    if (f.type === 'checkbox') {
      data[key] = val === true;
      if (required && val !== true) {
        return { ok: false, message: `Отметьте: ${label}` };
      }
      continue;
    }

    const str = val === undefined || val === null ? '' : String(val).trim();
    if (required && !str) {
      return { ok: false, message: `Заполните поле: ${label}` };
    }
    data[key] = str;
  }

  return { ok: true, data };
}
