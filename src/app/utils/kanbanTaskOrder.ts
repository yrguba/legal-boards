import { arrayMove } from '@dnd-kit/sortable';
import type { Task } from '../types';

export function sortTasksByPosition(a: Task, b: Task): number {
  const pa = typeof a.position === 'number' ? a.position : 0;
  const pb = typeof b.position === 'number' ? b.position : 0;
  if (pa !== pb) return pa - pb;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export function getColumnTaskOrder(tasks: Task[], columnId: string): Task[] {
  return tasks.filter((t) => t.columnId === columnId).sort(sortTasksByPosition);
}

export function getColumnTaskIds(tasks: Task[], columnId: string): string[] {
  return getColumnTaskOrder(tasks, columnId).map((t) => t.id);
}

export function columnIdsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** Оптимистичное изменение порядка при drag over (внутри колонки и между колонками). */
export function applyDragReorder(
  tasks: Task[],
  activeId: string,
  overId: string,
  boardColumnIds: string[],
): Task[] {
  const activeTask = tasks.find((t) => t.id === activeId);
  if (!activeTask) return tasks;

  const overTask = tasks.find((t) => t.id === overId);
  const overColumnId = overTask?.columnId ?? (boardColumnIds.includes(overId) ? overId : null);
  if (!overColumnId) return tasks;

  const activeColumnId = activeTask.columnId;
  const columnIdSet = new Set(boardColumnIds);

  const orderByColumn = new Map<string, string[]>();
  for (const colId of columnIdSet) {
    orderByColumn.set(colId, getColumnTaskIds(tasks, colId));
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

  for (const colId of boardColumnIds) {
    const ids = orderByColumn.get(colId);
    if (!ids) continue;
    ids.forEach((id, position) => {
      const row = taskById.get(id);
      if (row) next.push({ ...row, columnId: colId, position });
    });
  }

  return next;
}

export { arrayMove };
