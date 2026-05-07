import type { BoardAdvancedSettings, BoardAutoAssignRule } from './boardAdvancedSettings.types';

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
    timeTracking: {
      startColumnId: '',
      stopColumnId: '',
      ignoreColumnIds: [],
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

export function mergeBoardAdvanced(raw: unknown): BoardAdvancedSettings {
  const d = defaultBoardAdvancedSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<BoardAdvancedSettings>;

  const aa = r.autoAssignment;
  const tt = r.timeTracking;

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
    timeTracking: normalizeTimeTracking(tt, d.timeTracking!),
    iframeServices: Array.isArray(r.iframeServices) ? r.iframeServices : d.iframeServices,
  };
}
