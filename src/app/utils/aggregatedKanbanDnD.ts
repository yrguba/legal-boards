import type { AggregatedBoardSource, Task } from '../types';
import { getColumnTaskIds, sortTasksByPosition } from './kanbanTaskOrder';

export function aggDropZoneId(sourceBoardId: string, columnId: string): string {
  return `agg:${sourceBoardId}:${columnId}`;
}

export function parseAggDropZoneId(
  id: string,
): { sourceBoardId: string; columnId: string } | null {
  if (!id.startsWith('agg:')) return null;
  const [, sourceBoardId, columnId] = id.split(':');
  if (!sourceBoardId || !columnId) return null;
  return { sourceBoardId, columnId };
}

export function taskSourceBoardId(task: Task): string {
  return task.sourceBoardId ?? task.boardId;
}

export function taskStatusColumnId(task: Task): string {
  return task.sourceColumnId ?? task.columnId;
}

export function getStatusColumnTaskIds(tasks: Task[], columnId: string): string[] {
  return tasks
    .filter((t) => taskStatusColumnId(t) === columnId)
    .sort(sortTasksByPosition)
    .map((t) => t.id);
}

export function columnNameById(sources: AggregatedBoardSource[], columnId: string): string | undefined {
  for (const source of sources) {
    const col = source.columns.find((c) => c.id === columnId);
    if (col) return col.name;
  }
  return undefined;
}

export function columnIdsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** Оптимистичное перемещение между статусами и сортировка (columnId уникален глобально). */
export function applyAggregatedDragReorder(
  tasks: Task[],
  activeId: string,
  overId: string,
  allColumnIds: string[],
  sources: AggregatedBoardSource[],
): Task[] {
  const activeTask = tasks.find((t) => t.id === activeId);
  if (!activeTask) return tasks;

  const drop = parseAggDropZoneId(overId);
  const overTask = tasks.find((t) => t.id === overId);
  const overColumnId = drop?.columnId ?? (overTask ? taskStatusColumnId(overTask) : null);
  if (!overColumnId) return tasks;

  const activeColumnId = taskStatusColumnId(activeTask);
  const columnIdSet = new Set(allColumnIds);

  const orderByColumn = new Map<string, string[]>();
  for (const colId of columnIdSet) {
    orderByColumn.set(colId, getStatusColumnTaskIds(tasks, colId));
  }

  const sourceIds = [...(orderByColumn.get(activeColumnId) ?? [])];
  const sourceIndex = sourceIds.indexOf(activeId);
  if (sourceIndex < 0) return tasks;
  sourceIds.splice(sourceIndex, 1);

  let targetIds: string[];
  let insertIndex: number;

  if (activeColumnId === overColumnId) {
    targetIds = sourceIds;
    if (overTask) {
      const overIndex = (orderByColumn.get(overColumnId) ?? []).indexOf(overId);
      insertIndex = overIndex >= 0 ? overIndex : targetIds.length;
      if (insertIndex > sourceIndex) insertIndex -= 1;
    } else {
      insertIndex = targetIds.length;
    }
    targetIds.splice(insertIndex, 0, activeId);
    orderByColumn.set(activeColumnId, targetIds);
  } else {
    orderByColumn.set(activeColumnId, sourceIds);
    targetIds = [...(orderByColumn.get(overColumnId) ?? [])].filter((id) => id !== activeId);
    if (overTask) {
      insertIndex = (orderByColumn.get(overColumnId) ?? []).indexOf(overId);
      if (insertIndex < 0) insertIndex = targetIds.length;
    } else {
      insertIndex = targetIds.length;
    }
    targetIds.splice(insertIndex, 0, activeId);
    orderByColumn.set(overColumnId, targetIds);
  }

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const next: Task[] = [];

  for (const colId of allColumnIds) {
    const ids = orderByColumn.get(colId);
    if (!ids) continue;
    const colName = columnNameById(sources, colId);
    ids.forEach((id, position) => {
      const row = taskById.get(id);
      if (row) {
        next.push({
          ...row,
          columnId: colId,
          sourceColumnId: colId,
          sourceColumnName: colName ?? row.sourceColumnName,
          position,
        });
      }
    });
  }

  return next;
}

export function resolveAggregatedDrop(
  overId: string,
  tasks: Task[],
): { sourceBoardId: string; columnId: string } | null {
  const drop = parseAggDropZoneId(overId);
  if (drop) return drop;
  const overTask = tasks.find((t) => t.id === overId);
  if (!overTask) return null;
  return {
    sourceBoardId: taskSourceBoardId(overTask),
    columnId: taskStatusColumnId(overTask),
  };
}
