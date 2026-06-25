import { mergeBoardAdvanced } from '../features/board-settings/boardAdvancedSettings.defaults';
import type {
  BoardColumnActionRule,
  ColumnActionTrigger,
} from '../features/board-settings/boardAdvancedSettings.types';
import type { Board, TaskField } from '../types';
import { isFormsMicroAppEnabled } from '../qiankun/formsMicroAppFeature';
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

function pushInteractiveStepOrLegalFormsDisabled(
  rule: BoardColumnActionRule,
  forColumnId: string,
  phase: 'exit' | 'enter',
  checkErrors: ColumnTransitionCheckError[],
  interactiveSteps: ColumnTransitionInteractiveStep[],
) {
  if (rule.actionKind === 'legal_forms' && !isFormsMicroAppEnabled()) {
    checkErrors.push({
      ruleName: rule.name || 'Legal Forms',
      messages: ['Модуль Legal Forms временно отключён на сервере.'],
      phase,
    });
    return;
  }
  interactiveSteps.push({ rule, forColumnId, phase });
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

export type ForwardRuleLabels = {
  boardName: string;
  columnName?: string;
};

export function getForwardToBoardRulesForTransition(
  board: Board | null | undefined,
  fromColumnId: string,
  toColumnId: string,
): BoardColumnActionRule[] {
  const rules = getBoardColumnActionRules(board);
  const seen = new Set<string>();
  const out: BoardColumnActionRule[] = [];

  for (const rule of rules) {
    if (rule.actionKind !== 'forward_to_board' || !rule.config.targetBoardId) continue;
    const matchesEnter = rule.columnId === toColumnId && rule.trigger === 'on_enter';
    const matchesExit = rule.columnId === fromColumnId && rule.trigger === 'on_exit';
    if (!matchesEnter && !matchesExit) continue;
    if (seen.has(rule.id)) continue;
    seen.add(rule.id);
    out.push(rule);
  }

  return out;
}

export async function resolveForwardRuleLabels(
  rule: BoardColumnActionRule,
  fetchBoard: (
    boardId: string,
  ) => Promise<{ name: string; columns?: { id: string; name: string }[] } | null>,
): Promise<ForwardRuleLabels> {
  let boardName = rule.config.targetBoardName?.trim() ?? '';
  let columnName = rule.config.targetColumnName?.trim() ?? '';

  if (rule.config.targetBoardId) {
    const targetBoard = await fetchBoard(rule.config.targetBoardId);
    if (targetBoard) {
      if (!boardName) boardName = targetBoard.name;
      if (!columnName && rule.config.targetColumnId) {
        columnName =
          targetBoard.columns?.find((c) => c.id === rule.config.targetColumnId)?.name ?? '';
      }
    }
  }

  return {
    boardName: boardName || '—',
    columnName: columnName || undefined,
  };
}

export function forwardToBoardConfirmMessage(
  rule: BoardColumnActionRule,
  labels?: ForwardRuleLabels,
): string {
  const custom = rule.config.message?.trim();
  if (custom) return custom;

  const boardName =
    labels?.boardName?.trim() ||
    rule.config.targetBoardName?.trim() ||
    '—';
  const columnName = labels?.columnName?.trim() || rule.config.targetColumnName?.trim();
  const columnPart = columnName ? ` в колонку «${columnName}»` : '';
  return `Задача будет также добавлена на доску «${boardName}»${columnPart}. Задача останется на текущей доске.`;
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
    } else if (rule.actionKind !== 'forward_to_board' && !exitCompleted.has(rule.id)) {
      pushInteractiveStepOrLegalFormsDisabled(rule, fromColumnId, 'exit', checkErrors, interactiveSteps);
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
    } else if (rule.actionKind !== 'forward_to_board' && !enterCompleted.has(rule.id)) {
      pushInteractiveStepOrLegalFormsDisabled(rule, toColumnId, 'enter', checkErrors, interactiveSteps);
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
