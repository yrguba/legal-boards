import type { Task } from '../types';

/** Подмешивает ответ PUT /tasks/:id в карточку на доске */
export function mergeTaskFromUpdateResponse(
  prev: Task,
  api: Record<string, unknown>,
  columnName?: string,
): Task {
  const merged = { ...prev };
  if (typeof api.columnId === 'string') {
    merged.columnId = api.columnId;
    merged.sourceColumnId = api.columnId;
    if (columnName) merged.sourceColumnName = columnName;
  }
  if (typeof api.trackedTimeSeconds === 'number') merged.trackedTimeSeconds = api.trackedTimeSeconds;
  if (Object.prototype.hasOwnProperty.call(api, 'timeTrackingActiveSince')) {
    const v = api.timeTrackingActiveSince;
    merged.timeTrackingActiveSince =
      v === null || v === undefined ? null : typeof v === 'string' ? v : String(v);
  }
  if (Object.prototype.hasOwnProperty.call(api, 'assigneeId')) {
    merged.assigneeId =
      api.assigneeId === null || api.assigneeId === undefined
        ? undefined
        : String(api.assigneeId);
  }
  if (api.assignee !== undefined) merged.assignee = api.assignee as Task['assignee'];
  if (typeof api.updatedAt === 'string') merged.updatedAt = api.updatedAt;
  if (typeof api.position === 'number') merged.position = api.position;
  if (Array.isArray(api.columnApprovals)) {
    (merged as Task & { columnApprovals?: unknown[] }).columnApprovals = api.columnApprovals;
  }
  if (Array.isArray(api.columnActionCompletions)) {
    (merged as Task & { columnActionCompletions?: unknown[] }).columnActionCompletions =
      api.columnActionCompletions;
  }
  return merged;
}
