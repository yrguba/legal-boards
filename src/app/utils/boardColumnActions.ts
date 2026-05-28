import { mergeBoardAdvanced } from '../features/board-settings/boardAdvancedSettings.defaults';
import type {
  BoardColumnActionRule,
  ColumnActionTrigger,
} from '../features/board-settings/boardAdvancedSettings.types';
import type { Board, TaskField } from '../types';
import { getDescriptionFieldId, getTitleFieldId } from '../pages/task/utils/taskFieldIds';
import { isEmptyValue } from '../pages/task/utils/customFieldValue';

export type TaskColumnActionCompletionRow = {
  id: string;
  ruleId: string;
  columnId: string;
  ruleName?: string;
  actionKind: string;
  payload?: Record<string, unknown>;
  completedByUserId: string;
  createdAt: string;
  completer?: { id: string; name: string; email?: string; avatar?: string | null };
};

export type TaskForColumnChecks = {
  title?: string | null;
  assigneeId?: string | null;
  description?: string | null;
  conclusionText?: string | null;
  customFields?: Record<string, unknown>;
  taskAttachments?: unknown[];
  columnActionCompletions?: TaskColumnActionCompletionRow[];
};

export type ColumnTransitionCheckError = {
  ruleName: string;
  messages: string[];
  phase: 'exit' | 'enter';
};

export type ColumnTransitionInteractiveStep = {
  rule: BoardColumnActionRule;
  forColumnId: string;
  phase: 'exit' | 'enter';
};

export type ColumnTransitionPlan = {
  checkErrors: ColumnTransitionCheckError[];
  interactiveSteps: ColumnTransitionInteractiveStep[];
};

export function getBoardColumnActionRules(board: Board | null | undefined): BoardColumnActionRule[] {
  if (!board) return [];
  return mergeBoardAdvanced(board.advancedSettings ?? {}).columnActions?.rules ?? [];
}

function rulesFor(
  rules: BoardColumnActionRule[],
  columnId: string,
  trigger: ColumnActionTrigger,
): BoardColumnActionRule[] {
  return rules.filter((r) => r.columnId === columnId && r.trigger === trigger && r.blocking !== false);
}

function completionIdsForColumn(
  completions: TaskColumnActionCompletionRow[],
  columnId: string,
): Set<string> {
  return new Set(completions.filter((c) => c.columnId === columnId).map((c) => c.ruleId));
}

function getCheckFieldValue(
  task: TaskForColumnChecks,
  fieldId: string,
  titleFieldId: string,
  descriptionFieldId: string,
): unknown {
  if (titleFieldId && fieldId === titleFieldId) return task.title;
  if (descriptionFieldId && fieldId === descriptionFieldId) return task.description;
  return task.customFields?.[fieldId];
}

function runCheckTaskRule(
  task: TaskForColumnChecks,
  rule: BoardColumnActionRule,
  taskFields: TaskField[] = [],
): string[] {
  const checks = rule.config.checks ?? [];
  if (checks.length === 0) return [];

  const messages: string[] = [];
  const titleFieldId = getTitleFieldId(taskFields);
  const descriptionFieldId = getDescriptionFieldId(taskFields);
  const attachmentCount = Array.isArray(task.taskAttachments) ? task.taskAttachments.length : 0;

  for (const check of checks) {
    switch (check.type) {
      case 'assignee_set':
        if (!task.assigneeId) messages.push('назначен исполнитель');
        break;
      case 'description_set':
        if (isEmptyValue(task.description)) messages.push('заполнено описание');
        break;
      case 'conclusion_set':
        if (isEmptyValue(task.conclusionText)) messages.push('заполнено заключение');
        break;
      case 'attachment_present':
        if (attachmentCount < 1) messages.push('есть вложение');
        break;
      case 'custom_field_set': {
        const fieldId = check.fieldId ?? '';
        const val = getCheckFieldValue(task, fieldId, titleFieldId, descriptionFieldId);
        if (isEmptyValue(val)) {
          const field = taskFields.find((f) => f.id === fieldId);
          messages.push(`заполнено поле «${field?.name || check.label || fieldId}»`);
        }
        break;
      }
    }
  }
  return messages;
}

export function buildColumnTransitionPlan(
  board: Board | null | undefined,
  task: TaskForColumnChecks,
  fromColumnId: string,
  toColumnId: string,
): ColumnTransitionPlan {
  const rules = getBoardColumnActionRules(board);
  const completions = task.columnActionCompletions ?? [];
  const taskFields = board?.taskFields ?? [];
  const checkErrors: ColumnTransitionCheckError[] = [];
  const interactiveSteps: ColumnTransitionInteractiveStep[] = [];

  const exitRules = rulesFor(rules, fromColumnId, 'on_exit');
  const exitCompleted = completionIdsForColumn(completions, fromColumnId);

  for (const rule of exitRules) {
    if (rule.actionKind === 'check_task') {
      const messages = runCheckTaskRule(task, rule, taskFields);
      if (messages.length) {
        checkErrors.push({ ruleName: rule.name || 'Проверка', messages, phase: 'exit' });
      }
    } else if (!exitCompleted.has(rule.id)) {
      interactiveSteps.push({ rule, forColumnId: fromColumnId, phase: 'exit' });
    }
  }

  const enterRules = rulesFor(rules, toColumnId, 'on_enter');
  const enterCompleted = completionIdsForColumn(completions, toColumnId);

  for (const rule of enterRules) {
    if (rule.actionKind === 'check_task') {
      const messages = runCheckTaskRule(task, rule, taskFields);
      if (messages.length) {
        checkErrors.push({ ruleName: rule.name || 'Проверка', messages, phase: 'enter' });
      }
    } else if (!enterCompleted.has(rule.id)) {
      interactiveSteps.push({ rule, forColumnId: toColumnId, phase: 'enter' });
    }
  }

  return { checkErrors, interactiveSteps };
}

export function formatColumnTransitionCheckErrors(errors: ColumnTransitionCheckError[]): string {
  if (errors.length === 0) return '';
  return errors
    .map((e) => {
      const phase = e.phase === 'exit' ? 'перед выходом' : 'перед входом';
      return `${e.ruleName} (${phase}): ${e.messages.join(', ')}`;
    })
    .join('; ');
}

export function mergeActionCompletion(
  completions: TaskColumnActionCompletionRow[],
  row: TaskColumnActionCompletionRow,
): TaskColumnActionCompletionRow[] {
  const idx = completions.findIndex((c) => c.ruleId === row.ruleId);
  if (idx >= 0) {
    const next = [...completions];
    next[idx] = row;
    return next;
  }
  return [...completions, row];
}
