import type { AggregatedBoardSource, Task } from '../types';
import { sortTasksByPosition } from './kanbanTaskOrder';

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

/** Уникальный id карточки на сводной (задача может быть на нескольких досках). */
export function aggTaskDragId(sourceBoardId: string, taskId: string): string {
  return `task:${sourceBoardId}:${taskId}`;
}

export function parseAggTaskDragId(
  dragId: string,
): { sourceBoardId: string; taskId: string } | null {
  if (!dragId.startsWith('task:')) return null;
  const rest = dragId.slice('task:'.length);
  const sep = rest.indexOf(':');
  if (sep <= 0) return null;
  return {
    sourceBoardId: rest.slice(0, sep),
    taskId: rest.slice(sep + 1),
  };
}

export function taskDragId(task: Task): string {
  return aggTaskDragId(taskSourceBoardId(task), task.id);
}

export function aggregatedTaskCardKey(task: Task): string {
  return `${taskSourceBoardId(task)}:${task.id}`;
}

export function findAggregatedTaskByDragId(tasks: Task[], dragId: string): Task | undefined {
  const parsed = parseAggTaskDragId(dragId);
  if (parsed) {
    return tasks.find(
      (t) => t.id === parsed.taskId && taskSourceBoardId(t) === parsed.sourceBoardId,
    );
  }
  return tasks.find((t) => t.id === dragId);
}

export function taskSourceBoardId(task: Task): string {
  return task.sourceBoardId ?? task.boardId;
}

export function taskStatusColumnId(task: Task): string {
  return task.sourceColumnId ?? task.columnId;
}

export function getStatusColumnDragIds(tasks: Task[], columnId: string): string[] {
  return tasks
    .filter((t) => taskStatusColumnId(t) === columnId)
    .sort(sortTasksByPosition)
    .map((t) => taskDragId(t));
}

/** Id задач в колонке на конкретной доске (для API reorder). */
export function getStatusColumnTaskIdsForBoard(
  tasks: Task[],
  columnId: string,
  sourceBoardId: string,
): string[] {
  return tasks
    .filter((t) => taskSourceBoardId(t) === sourceBoardId && taskStatusColumnId(t) === columnId)
    .sort(sortTasksByPosition)
    .map((t) => t.id);
}

/** @deprecated используйте getStatusColumnTaskIdsForBoard */
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
  activeDragId: string,
  overDragId: string,
  allColumnIds: string[],
  sources: AggregatedBoardSource[],
): Task[] {
  const activeTask = findAggregatedTaskByDragId(tasks, activeDragId);
  if (!activeTask) return tasks;

  const activeId = taskDragId(activeTask);
  const drop = parseAggDropZoneId(overDragId);
  const overTask = findAggregatedTaskByDragId(tasks, overDragId);
  const overColumnId = drop?.columnId ?? (overTask ? taskStatusColumnId(overTask) : null);
  if (!overColumnId) return tasks;

  const activeColumnId = taskStatusColumnId(activeTask);
  const columnIdSet = new Set(allColumnIds);

  const orderByColumn = new Map<string, string[]>();
  for (const colId of columnIdSet) {
    orderByColumn.set(colId, getStatusColumnDragIds(tasks, colId));
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
      const overDragIdResolved = taskDragId(overTask);
      const overIndex = (orderByColumn.get(overColumnId) ?? []).indexOf(overDragIdResolved);
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
      const overDragIdResolved = taskDragId(overTask);
      insertIndex = (orderByColumn.get(overColumnId) ?? []).indexOf(overDragIdResolved);
      if (insertIndex < 0) insertIndex = targetIds.length;
    } else {
      insertIndex = targetIds.length;
    }
    targetIds.splice(insertIndex, 0, activeId);
    orderByColumn.set(overColumnId, targetIds);
  }

  const taskByCard = new Map(tasks.map((t) => [aggregatedTaskCardKey(t), t]));
  const next: Task[] = [];
  const included = new Set<string>();

  for (const colId of allColumnIds) {
    const dragIds = orderByColumn.get(colId);
    if (!dragIds) continue;
    const colName = columnNameById(sources, colId);
    dragIds.forEach((dragId, position) => {
      const parsed = parseAggTaskDragId(dragId);
      if (!parsed) return;
      const cardKey = `${parsed.sourceBoardId}:${parsed.taskId}`;
      const row = taskByCard.get(cardKey);
      if (!row) return;
      included.add(cardKey);
      next.push({
        ...row,
        columnId: colId,
        sourceColumnId: colId,
        sourceColumnName: colName ?? row.sourceColumnName,
        position,
      });
    });
  }

  for (const row of tasks) {
    const key = aggregatedTaskCardKey(row);
    if (!included.has(key)) next.push(row);
  }

  return next;
}

export function resolveAggregatedDrop(
  overId: string,
  tasks: Task[],
): { sourceBoardId: string; columnId: string } | null {
  const drop = parseAggDropZoneId(overId);
  if (drop) return drop;
  const overTask = findAggregatedTaskByDragId(tasks, overId);
  if (!overTask) return null;
  return {
    sourceBoardId: taskSourceBoardId(overTask),
    columnId: taskStatusColumnId(overTask),
  };
}

export function resolveActiveAggregatedDrag(
  activeDragId: string,
  tasks: Task[],
): { task: Task; taskId: string; sourceBoardId: string } | null {
  const task = findAggregatedTaskByDragId(tasks, activeDragId);
  if (!task) return null;
  return {
    task,
    taskId: task.id,
    sourceBoardId: taskSourceBoardId(task),
  };
}
