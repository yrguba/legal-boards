import type { Prisma, PrismaClient } from '@prisma/client';

type DbClient = PrismaClient | Prisma.TransactionClient;

export class TaskPositionError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Новая задача вставляется сверху колонки (position 0). */
export async function reserveTopPositionInColumn(db: DbClient, columnId: string): Promise<number> {
  await db.task.updateMany({
    where: { columnId },
    data: { position: { increment: 1 } },
  });
  return 0;
}

export async function applyTaskOrderInColumn(
  db: DbClient,
  boardId: string,
  columnId: string,
  orderedTaskIds: string[],
): Promise<void> {
  const existing = await db.task.findMany({
    where: { boardId, columnId },
    select: { id: true },
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
  });
  const existingIds = existing.map((t) => t.id);
  if (orderedTaskIds.length !== existingIds.length) {
    throw new TaskPositionError('INVALID_ORDER_LENGTH', 'Некорректный список задач для сортировки');
  }
  const existingSet = new Set(existingIds);
  for (const id of orderedTaskIds) {
    if (!existingSet.has(id)) {
      throw new TaskPositionError('INVALID_TASK', 'Задача не принадлежит колонке');
    }
  }
  await Promise.all(
    orderedTaskIds.map((id, position) => db.task.update({ where: { id }, data: { position } })),
  );
}

/** Перенос задачи в другую колонку на указанную позицию (0 — сверху). */
export async function moveTaskToColumnAtPosition(
  db: DbClient,
  taskId: string,
  fromColumnId: string,
  toColumnId: string,
  targetPosition: number,
): Promise<void> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { position: true, columnId: true },
  });
  if (!task) {
    throw new TaskPositionError('TASK_NOT_FOUND', 'Задача не найдена');
  }
  if (task.columnId !== fromColumnId) {
    throw new TaskPositionError('COLUMN_MISMATCH', 'Задача уже в другой колонке');
  }

  const clampedTarget = Math.max(0, Math.floor(targetPosition));

  if (fromColumnId === toColumnId) {
    const columnTasks = await db.task.findMany({
      where: { columnId: fromColumnId },
      select: { id: true, position: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    });
    const ids = columnTasks.map((t) => t.id);
    const oldIndex = ids.indexOf(taskId);
    if (oldIndex < 0) {
      throw new TaskPositionError('TASK_NOT_FOUND', 'Задача не найдена в колонке');
    }
    const newIndex = Math.min(clampedTarget, ids.length - 1);
    if (oldIndex === newIndex) return;
    ids.splice(oldIndex, 1);
    ids.splice(newIndex, 0, taskId);
    await Promise.all(ids.map((id, position) => db.task.update({ where: { id }, data: { position } })));
    return;
  }

  const sourcePos = task.position;

  await db.task.updateMany({
    where: { columnId: fromColumnId, position: { gt: sourcePos } },
    data: { position: { decrement: 1 } },
  });

  const targetCount = await db.task.count({ where: { columnId: toColumnId } });
  const insertAt = Math.min(clampedTarget, targetCount);

  await db.task.updateMany({
    where: { columnId: toColumnId, position: { gte: insertAt } },
    data: { position: { increment: 1 } },
  });

  await db.task.update({
    where: { id: taskId },
    data: { columnId: toColumnId, position: insertAt },
  });
}

/** Вставка в конец целевой колонки при смене статуса без явной позиции. */
export async function appendTaskToColumn(
  db: DbClient,
  taskId: string,
  fromColumnId: string,
  toColumnId: string,
): Promise<void> {
  const targetCount = await db.task.count({
    where: { columnId: toColumnId, NOT: { id: taskId } },
  });
  await moveTaskToColumnAtPosition(db, taskId, fromColumnId, toColumnId, targetCount);
}
