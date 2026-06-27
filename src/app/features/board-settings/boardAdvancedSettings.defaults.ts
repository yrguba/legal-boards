import type {
  BoardAdvancedSettings,
  BoardAutoAssignRule,
  BoardApprovalRule,
  BoardColumnActionRule,
  ColumnActionCheckItem,
  ColumnActionFormField,
  ColumnActionKind,
  ColumnActionTrigger,
} from './boardAdvancedSettings.types';

export function newLocalId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeTimeTracking(
  tt: unknown,
  fallback: NonNullable<BoardAdvancedSettings['timeTracking']>,
): NonNullable<BoardAdvancedSettings['timeTracking']> {
  const obj = tt && typeof tt === 'object' ? (tt as Record<string, unknown>) : {};

  let startColumnId = typeof obj.startColumnId === 'string' ? obj.startColumnId : '';
  let stopColumnId = typeof obj.stopColumnId === 'string' ? obj.stopColumnId : '';

  if (!startColumnId && Array.isArray(obj.startColumnIds) && typeof obj.startColumnIds[0] === 'string') {
    startColumnId = obj.startColumnIds[0];
  }
  if (!stopColumnId && Array.isArray(obj.stopColumnIds) && typeof obj.stopColumnIds[0] === 'string') {
    stopColumnId = obj.stopColumnIds[0];
  }

  const ignoreColumnIds = Array.isArray(obj.ignoreColumnIds)
    ? obj.ignoreColumnIds.filter((x): x is string => typeof x === 'string')
    : fallback.ignoreColumnIds;

  return {
    startColumnId,
    stopColumnId,
    ignoreColumnIds,
  };
}

export function defaultBoardAdvancedSettings(): BoardAdvancedSettings {
  return {
    autoAssignment: {
      rules: [],
    },
    approvals: {
      rules: [],
    },
    columnActions: {
      rules: [],
    },
    timeTracking: {
      startColumnId: '',
      stopColumnId: '',
      ignoreColumnIds: [],
    },
    reporting: {
      doneColumnId: '',
    },
    iframeServices: [],
  };
}

function normalizeAutoAssignRules(
  rawRules: unknown,
  legacyAssignOnLoad?: boolean,
  legacyLawyerPriorityUserIds?: unknown,
): BoardAutoAssignRule[] {
  const lp =
    Array.isArray(legacyLawyerPriorityUserIds) &&
    legacyLawyerPriorityUserIds.every((x) => typeof x === 'string')
      ? [...legacyLawyerPriorityUserIds]
      : [];
  const list = Array.isArray(rawRules) ? rawRules : [];

  return list.map((rule: Record<string, unknown>) => {
    const id = typeof rule.id === 'string' ? rule.id : newLocalId();
    const taskTypeId = typeof rule.taskTypeId === 'string' ? rule.taskTypeId : '';
    const targetKind =
      rule.targetKind === 'department' || rule.targetKind === 'group' || rule.targetKind === 'user'
        ? rule.targetKind
        : 'department';
    const targetId = typeof rule.targetId === 'string' ? rule.targetId : '';

    let assignmentMode: BoardAutoAssignRule['assignmentMode'] = 'on_load';
    if (rule.assignmentMode === 'by_priority' || rule.assignmentMode === 'on_load') {
      assignmentMode = rule.assignmentMode;
    } else if (legacyAssignOnLoad === true) {
      assignmentMode = 'on_load';
    } else if (lp.length > 0) {
      assignmentMode = 'by_priority';
    }

    let priorityUserIds =
      Array.isArray(rule.priorityUserIds) && rule.priorityUserIds.every((x) => typeof x === 'string')
        ? [...rule.priorityUserIds]
        : [];
    if (assignmentMode === 'by_priority' && priorityUserIds.length === 0 && lp.length > 0) {
      priorityUserIds = [...lp];
    }

    return {
      id,
      taskTypeId,
      targetKind,
      targetId,
      assignmentMode,
      priorityUserIds,
    };
  });
}

function normalizeApprovalRules(rawRules: unknown): BoardApprovalRule[] {
  const list = Array.isArray(rawRules) ? rawRules : [];
  return list.map((item: Record<string, unknown>) => {
    const id = typeof item.id === 'string' ? item.id : newLocalId();
    const name = typeof item.name === 'string' ? item.name : '';
    const columnId = typeof item.columnId === 'string' ? item.columnId : '';
    const approverUserId = typeof item.approverUserId === 'string' ? item.approverUserId : '';
    const substituteUserIds =
      Array.isArray(item.substituteUserIds) &&
      item.substituteUserIds.every((x) => typeof x === 'string')
        ? [...item.substituteUserIds]
        : [];
    return { id, name, columnId, approverUserId, substituteUserIds };
  });
}

function composeLegacyFormsPath(cfgRaw: Record<string, unknown>): string {
  if (typeof cfgRaw.formsPath === 'string' && cfgRaw.formsPath.trim()) {
    return cfgRaw.formsPath.trim();
  }

  const version =
    typeof cfgRaw.formsProjectVersion === 'string' ? cfgRaw.formsProjectVersion.trim() : '';
  const session = typeof cfgRaw.formsSessionId === 'string' ? cfgRaw.formsSessionId.trim() : '';
  const flowId = typeof cfgRaw.formsFlowId === 'string' ? cfgRaw.formsFlowId.trim() : '';
  const flowKey = typeof cfgRaw.formsFlowKey === 'string' ? cfgRaw.formsFlowKey.trim() : '';
  const suffix = typeof cfgRaw.formsFlowSuffix === 'string' ? cfgRaw.formsFlowSuffix.trim() : '';
  if (!version || !session || !flowId || !flowKey) return '';

  const hostRaw = typeof cfgRaw.formsHost === 'string' ? cfgRaw.formsHost.trim() : '';
  const tail = suffix ? `/${encodeURIComponent(suffix)}` : '';
  const path = `/docstream/expertise/${session}/flows/${flowId}/${encodeURIComponent(flowKey)}${tail}`;

  if (!hostRaw) return path;
  const host = /^https?:\/\//i.test(hostRaw) ? hostRaw.replace(/\/+$/, '') : `https://${hostRaw.replace(/\/+$/, '')}`;
  return `${host}${path}`;
}

function normalizeColumnActionRules(rawRules: unknown): BoardColumnActionRule[] {
  const list = Array.isArray(rawRules) ? rawRules : [];
  return list.map((item: Record<string, unknown>) => {
    const id = typeof item.id === 'string' ? item.id : newLocalId();
    const name = typeof item.name === 'string' ? item.name : '';
    const columnId = typeof item.columnId === 'string' ? item.columnId : '';
    const trigger: ColumnActionTrigger = item.trigger === 'on_exit' ? 'on_exit' : 'on_enter';
    const blocking = item.blocking !== false;
    const kindRaw = typeof item.actionKind === 'string' ? item.actionKind : 'confirm';
    const actionKind: ColumnActionKind =
      kindRaw === 'form' ||
      kindRaw === 'check_task' ||
      kindRaw === 'forward_to_board' ||
      kindRaw === 'legal_forms'
        ? kindRaw
        : 'confirm';
    const cfgRaw =
      item.config && typeof item.config === 'object' && !Array.isArray(item.config)
        ? (item.config as Record<string, unknown>)
        : {};

    const config: BoardColumnActionRule['config'] = {
      message: typeof cfgRaw.message === 'string' ? cfgRaw.message : '',
      requireCheckbox: cfgRaw.requireCheckbox === true,
      checkboxLabel: typeof cfgRaw.checkboxLabel === 'string' ? cfgRaw.checkboxLabel : '',
      targetBoardId: typeof cfgRaw.targetBoardId === 'string' ? cfgRaw.targetBoardId : '',
      targetColumnId: typeof cfgRaw.targetColumnId === 'string' ? cfgRaw.targetColumnId : '',
      targetBoardName: typeof cfgRaw.targetBoardName === 'string' ? cfgRaw.targetBoardName : '',
      targetColumnName: typeof cfgRaw.targetColumnName === 'string' ? cfgRaw.targetColumnName : '',
      skipIfAlreadyOnBoard: cfgRaw.skipIfAlreadyOnBoard !== false,
      formsPath: composeLegacyFormsPath(cfgRaw),
      formsAccessTokenFieldId:
        typeof cfgRaw.formsAccessTokenFieldId === 'string' ? cfgRaw.formsAccessTokenFieldId : '',
      fields: Array.isArray(cfgRaw.fields)
        ? cfgRaw.fields.map((f: Record<string, unknown>) => ({
            key: typeof f.key === 'string' ? f.key : '',
            label: typeof f.label === 'string' ? f.label : '',
            type:
              f.type === 'textarea' ||
              f.type === 'select' ||
              f.type === 'date' ||
              f.type === 'checkbox'
                ? f.type
                : 'text',
            required: f.required !== false,
            options: Array.isArray(f.options)
              ? f.options.filter((x): x is string => typeof x === 'string')
              : [],
          }))
        : [],
      checks: Array.isArray(cfgRaw.checks)
        ? cfgRaw.checks
            .map((c: Record<string, unknown>): ColumnActionCheckItem | null => {
              const type = c.type;
              if (
                type === 'assignee_set' ||
                type === 'description_set' ||
                type === 'attachment_present' ||
                type === 'conclusion_set'
              ) {
                return { type };
              }
              if (type === 'custom_field_set' && typeof c.fieldId === 'string') {
                return {
                  type: 'custom_field_set',
                  fieldId: c.fieldId,
                  label: typeof c.label === 'string' ? c.label : undefined,
                };
              }
              return null;
            })
            .filter((x): x is ColumnActionCheckItem => x !== null)
        : [],
    };

    return { id, name, columnId, trigger, blocking, actionKind, config };
  });
}

export function mergeBoardAdvanced(raw: unknown): BoardAdvancedSettings {
  const d = defaultBoardAdvancedSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<BoardAdvancedSettings>;

  const aa = r.autoAssignment;
  const ap = r.approvals;
  const ca = r.columnActions;
  const tt = r.timeTracking;
  const rep = r.reporting;

  const legacyAssignOnLoad =
    aa && typeof aa === 'object' && 'assignOnLoad' in aa ? (aa as { assignOnLoad?: boolean }).assignOnLoad : undefined;
  const legacyLp =
    aa && typeof aa === 'object' && 'lawyerPriorityUserIds' in aa
      ? (aa as { lawyerPriorityUserIds?: unknown }).lawyerPriorityUserIds
      : undefined;

  return {
    autoAssignment: {
      rules: normalizeAutoAssignRules(aa && typeof aa === 'object' ? (aa as { rules?: unknown }).rules : [], legacyAssignOnLoad, legacyLp),
    },
    approvals: {
      rules: normalizeApprovalRules(ap && typeof ap === 'object' ? (ap as { rules?: unknown }).rules : []),
    },
    columnActions: {
      rules: normalizeColumnActionRules(
        ca && typeof ca === 'object' ? (ca as { rules?: unknown }).rules : [],
      ),
    },
    timeTracking: normalizeTimeTracking(tt, d.timeTracking!),
    reporting: {
      doneColumnId:
        rep && typeof rep === 'object' && typeof (rep as { doneColumnId?: unknown }).doneColumnId === 'string'
          ? (rep as { doneColumnId: string }).doneColumnId
          : d.reporting!.doneColumnId,
    },
    iframeServices: Array.isArray(r.iframeServices) ? r.iframeServices : d.iframeServices,
  };
}
