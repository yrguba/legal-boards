import type { Prisma, PrismaClient } from '@prisma/client';
import { ACTIVITY_EVENT_TYPES, writeActivityLog } from './activityLog';
import { TaskPositionError } from './taskPosition';
import {
  TASK_BOARD_TRANSITION_KIND,
  writeTaskBoardTransition,
} from './taskBoardTransitions';
import { formatTaskKey } from './taskKeys';

type DbClient = PrismaClient | Prisma.TransactionClient;

const placementInclude = {
  board: { select: { id: true, code: true, name: true, workspaceId: true } },
  column: { select: { id: true, name: true } },
  type: { select: { id: true, name: true, color: true, icon: true } },
} as const;

export type TaskBoardPlacementDto = {
  id: string;
  taskId: string;
  boardId: string;
  boardCode: string;
  boardName: string;
  columnId: string;
  columnName: string;
  typeId: string;
  type: { id: string; name: string; color: string; icon: string | null };
  position: number;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export function mapPlacementDto(
  row: {
    id: string;
    taskId: string;
    boardId: string;
    columnId: string;
    typeId: string;
    position: number;
    isPrimary: boolean;
    createdAt: Date;
    updatedAt: Date;
    board: { id: string; code: string; name: string; workspaceId: string };
    column: { id: string; name: string };
    type: { id: string; name: string; color: string; icon: string | null };
  },
): TaskBoardPlacementDto {
  return {
    id: row.id,
    taskId: row.taskId,
    boardId: row.boardId,
    boardCode: row.board.code,
    boardName: row.board.name,
    columnId: row.columnId,
    columnName: row.column.name,
    typeId: row.typeId,
    type: row.type,
    position: row.position,
    isPrimary: row.isPrimary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getTaskPlacements(
  db: DbClient,
  taskId: string,
): Promise<TaskBoardPlacementDto[]> {
  const rows = await db.taskBoardPlacement.findMany({
    where: { taskId },
    include: placementInclude,
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  });
  return rows.map(mapPlacementDto);
}

export async function getPlacementForBoard(
  db: DbClient,
  taskId: string,
  boardId: string,
) {
  return db.taskBoardPlacement.findUnique({
    where: { taskId_boardId: { taskId, boardId } },
    include: placementInclude,
  });
}

export async function syncPrimaryTaskFields(
  db: DbClient,
  taskId: string,
  data: {
    boardId: string;
    columnId: string;
    typeId: string;
    position: number;
  },
) {
  await db.task.update({
    where: { id: taskId },
    data: {
      boardId: data.boardId,
      columnId: data.columnId,
      typeId: data.typeId,
      position: data.position,
    },
  });
}

export async function createPrimaryPlacement(
  db: DbClient,
  args: {
    taskId: string;
    boardId: string;
    columnId: string;
    typeId: string;
    position: number;
    actorUserId?: string | null;
  },
) {
  const board = await db.board.findUnique({
    where: { id: args.boardId },
    select: { id: true, name: true, workspaceId: true, code: true },
  });
  if (!board) throw new Error('BOARD_NOT_FOUND');

  const placement = await db.taskBoardPlacement.create({
    data: {
      taskId: args.taskId,
      boardId: args.boardId,
      columnId: args.columnId,
      typeId: args.typeId,
      position: args.position,
      isPrimary: true,
    },
    include: placementInclude,
  });

  await writeTaskBoardTransition(db, {
    taskId: args.taskId,
    workspaceId: board.workspaceId,
    eventKind: TASK_BOARD_TRANSITION_KIND.PLACEMENT_CREATED,
    boardId: args.boardId,
    columnId: args.columnId,
    actorUserId: args.actorUserId,
    payload: { boardName: board.name, isPrimary: true },
  });

  return placement;
}

function resolveTargetTypeId(
  sourceTypeId: string,
  targetTypes: { id: string; name: string }[],
  sourceTypes: { id: string; name: string }[],
  explicitTypeId?: string | null,
): string | null {
  if (explicitTypeId && targetTypes.some((t) => t.id === explicitTypeId)) {
    return explicitTypeId;
  }
  const sourceName = sourceTypes.find((t) => t.id === sourceTypeId)?.name?.trim().toLowerCase();
  if (sourceName) {
    const byName = targetTypes.find((t) => t.name.trim().toLowerCase() === sourceName);
    if (byName) return byName.id;
  }
  return targetTypes[0]?.id ?? null;
}

export async function addTaskToBoard(
  prisma: PrismaClient,
  args: {
    taskId: string;
    boardId: string;
    columnId?: string | null;
    typeId?: string | null;
    actorUserId?: string | null;
    forwardLink?: {
      sourceBoardId: string;
      sourceColumnId: string;
      ruleId: string;
      ruleName?: string;
    };
  },
): Promise<{ placement: TaskBoardPlacementDto; created: boolean }> {
  const existing = await getPlacementForBoard(prisma, args.taskId, args.boardId);
  if (existing) {
    return { placement: mapPlacementDto(existing), created: false };
  }

  const [task, targetBoard] = await Promise.all([
    prisma.task.findUnique({
      where: { id: args.taskId },
      select: {
        id: true,
        boardId: true,
        typeId: true,
        board: { select: { workspaceId: true, taskTypes: true } },
      },
    }),
    prisma.board.findUnique({
      where: { id: args.boardId },
      include: {
        columns: { orderBy: { position: 'asc' } },
        taskTypes: true,
      },
    }),
  ]);

  if (!task) throw new Error('TASK_NOT_FOUND');
  if (!targetBoard) throw new Error('BOARD_NOT_FOUND');
  if (targetBoard.kind === 'aggregated') throw new Error('AGGREGATED_BOARD');
  if (targetBoard.workspaceId !== task.board.workspaceId) throw new Error('WORKSPACE_MISMATCH');

  const sourceBoard = await prisma.board.findUnique({
    where: { id: task.boardId },
    select: { taskTypes: true },
  });

  const targetTypeId = resolveTargetTypeId(
    task.typeId,
    targetBoard.taskTypes,
    sourceBoard?.taskTypes ?? [],
    args.typeId,
  );
  if (!targetTypeId) throw new Error('TARGET_TYPE_NOT_FOUND');

  const targetColumnId =
    args.columnId && targetBoard.columns.some((c) => c.id === args.columnId)
      ? args.columnId
      : targetBoard.columns[0]?.id;
  if (!targetColumnId) throw new Error('TARGET_COLUMN_NOT_FOUND');

  const result = await prisma.$transaction(async (tx) => {
    await tx.taskBoardPlacement.updateMany({
      where: { columnId: targetColumnId },
      data: { position: { increment: 1 } },
    });

    const placement = await tx.taskBoardPlacement.create({
      data: {
        taskId: args.taskId,
        boardId: args.boardId,
        columnId: targetColumnId,
        typeId: targetTypeId,
        position: 0,
        isPrimary: false,
        linkedFromBoardId: args.forwardLink?.sourceBoardId ?? null,
        linkedFromColumnId: args.forwardLink?.sourceColumnId ?? null,
        linkedByRuleId: args.forwardLink?.ruleId ?? null,
      },
      include: placementInclude,
    });

    await writeTaskBoardTransition(tx, {
      taskId: args.taskId,
      workspaceId: targetBoard.workspaceId,
      eventKind: TASK_BOARD_TRANSITION_KIND.PLACEMENT_CREATED,
      boardId: args.boardId,
      columnId: targetColumnId,
      actorUserId: args.actorUserId,
      source: args.forwardLink ? 'rule' : 'api',
      payload: {
        boardName: targetBoard.name,
        columnName: placement.column.name,
        isPrimary: false,
        autoForward: Boolean(args.forwardLink),
        ruleName: args.forwardLink?.ruleName ?? null,
      },
    });

    await writeActivityLog(tx, {
      workspaceId: targetBoard.workspaceId,
      boardId: args.boardId,
      taskId: args.taskId,
      eventType: ACTIVITY_EVENT_TYPES.BOARD_PLACEMENT_CREATED,
      actorUserId: args.actorUserId,
      payload: {
        boardId: args.boardId,
        boardName: targetBoard.name,
        columnId: targetColumnId,
        columnName: placement.column.name,
      },
    });

    return placement;
  });

  return { placement: mapPlacementDto(result), created: true };
}

export async function removeTaskFromBoard(
  prisma: PrismaClient,
  args: { taskId: string; boardId: string; actorUserId?: string | null },
): Promise<void> {
  const placement = await getPlacementForBoard(prisma, args.taskId, args.boardId);
  if (!placement) throw new Error('PLACEMENT_NOT_FOUND');
  if (placement.isPrimary) throw new Error('CANNOT_REMOVE_PRIMARY');

  const count = await prisma.taskBoardPlacement.count({ where: { taskId: args.taskId } });
  if (count <= 1) throw new Error('LAST_PLACEMENT');

  await prisma.$transaction(async (tx) => {
    await tx.taskBoardPlacement.delete({
      where: { taskId_boardId: { taskId: args.taskId, boardId: args.boardId } },
    });

    await compactPlacementColumnPositions(tx, args.boardId, placement.columnId);

    await writeTaskBoardTransition(tx, {
      taskId: args.taskId,
      workspaceId: placement.board.workspaceId,
      eventKind: TASK_BOARD_TRANSITION_KIND.PLACEMENT_REMOVED,
      boardId: args.boardId,
      columnId: placement.columnId,
      actorUserId: args.actorUserId,
      payload: { boardName: placement.board.name },
    });

    await writeActivityLog(tx, {
      workspaceId: placement.board.workspaceId,
      boardId: args.boardId,
      taskId: args.taskId,
      eventType: ACTIVITY_EVENT_TYPES.BOARD_PLACEMENT_REMOVED,
      actorUserId: args.actorUserId,
      payload: {
        boardId: args.boardId,
        boardName: placement.board.name,
      },
    });
  });
}

async function compactPlacementColumnPositions(
  db: DbClient,
  boardId: string,
  columnId: string,
) {
  const rows = await db.taskBoardPlacement.findMany({
    where: { boardId, columnId },
    orderBy: [{ position: 'asc' }, { updatedAt: 'asc' }],
    select: { id: true },
  });
  await Promise.all(
    rows.map((row, position) =>
      db.taskBoardPlacement.update({ where: { id: row.id }, data: { position } }),
    ),
  );
}

export async function movePlacementInColumn(
  db: DbClient,
  args: {
    taskId: string;
    boardId: string;
    fromColumnId: string;
    toColumnId: string;
    targetPosition?: number;
  },
): Promise<{ placementId: string; columnId: string; position: number; isPrimary: boolean }> {
  const placement = await db.taskBoardPlacement.findUnique({
    where: { taskId_boardId: { taskId: args.taskId, boardId: args.boardId } },
  });
  if (!placement) throw new TaskPositionError('PLACEMENT_NOT_FOUND', 'Задача не на этой доске');
  if (placement.columnId !== args.fromColumnId) {
    throw new TaskPositionError('COLUMN_MISMATCH', 'Задача уже в другой колонке');
  }

  const clampedTarget =
    typeof args.targetPosition === 'number' && Number.isFinite(args.targetPosition)
      ? Math.max(0, Math.floor(args.targetPosition))
      : null;

  if (args.fromColumnId === args.toColumnId && clampedTarget !== null) {
    const columnRows = await db.taskBoardPlacement.findMany({
      where: { boardId: args.boardId, columnId: args.fromColumnId },
      orderBy: [{ position: 'asc' }, { updatedAt: 'asc' }],
      select: { id: true },
    });
    const ids = columnRows.map((r) => r.id);
    const oldIndex = ids.indexOf(placement.id);
    if (oldIndex < 0) throw new TaskPositionError('TASK_NOT_FOUND', 'Задача не найдена в колонке');
    const newIndex = Math.min(clampedTarget, ids.length - 1);
    if (oldIndex !== newIndex) {
      ids.splice(oldIndex, 1);
      ids.splice(newIndex, 0, placement.id);
      await Promise.all(
        ids.map((id, position) => db.taskBoardPlacement.update({ where: { id }, data: { position } })),
      );
    }
    if (placement.isPrimary) {
      await syncPrimaryTaskFields(db, args.taskId, {
        boardId: args.boardId,
        columnId: args.toColumnId,
        typeId: placement.typeId,
        position: newIndex,
      });
    }
    return {
      placementId: placement.id,
      columnId: args.toColumnId,
      position: newIndex,
      isPrimary: placement.isPrimary,
    };
  }

  const sourcePos = placement.position;

  await db.taskBoardPlacement.updateMany({
    where: {
      boardId: args.boardId,
      columnId: args.fromColumnId,
      position: { gt: sourcePos },
    },
    data: { position: { decrement: 1 } },
  });

  const targetCount = await db.taskBoardPlacement.count({
    where: { boardId: args.boardId, columnId: args.toColumnId },
  });
  const insertAt =
    clampedTarget !== null ? Math.min(clampedTarget, targetCount) : targetCount;

  await db.taskBoardPlacement.updateMany({
    where: {
      boardId: args.boardId,
      columnId: args.toColumnId,
      position: { gte: insertAt },
    },
    data: { position: { increment: 1 } },
  });

  await db.taskBoardPlacement.update({
    where: { id: placement.id },
    data: { columnId: args.toColumnId, position: insertAt },
  });

  if (placement.isPrimary) {
    await syncPrimaryTaskFields(db, args.taskId, {
      boardId: args.boardId,
      columnId: args.toColumnId,
      typeId: placement.typeId,
      position: insertAt,
    });
  }

  return {
    placementId: placement.id,
    columnId: args.toColumnId,
    position: insertAt,
    isPrimary: placement.isPrimary,
  };
}

export async function applyPlacementOrderInColumn(
  db: DbClient,
  boardId: string,
  columnId: string,
  orderedTaskIds: string[],
): Promise<void> {
  const existing = await db.taskBoardPlacement.findMany({
    where: { boardId, columnId },
    select: { id: true, taskId: true },
    orderBy: [{ position: 'asc' }, { updatedAt: 'asc' }],
  });
  const existingIds = existing.map((r) => r.taskId);
  if (orderedTaskIds.length !== existingIds.length) {
    throw new TaskPositionError('INVALID_ORDER_LENGTH', 'Некорректный список задач для сортировки');
  }
  const existingSet = new Set(existingIds);
  for (const id of orderedTaskIds) {
    if (!existingSet.has(id)) {
      throw new TaskPositionError('INVALID_TASK', 'Задача не принадлежит колонке');
    }
  }
  const idByTaskId = new Map(existing.map((r) => [r.taskId, r.id]));
  await Promise.all(
    orderedTaskIds.map((taskId, position) =>
      db.taskBoardPlacement.update({
        where: { id: idByTaskId.get(taskId)! },
        data: { position },
      }),
    ),
  );

  for (const taskId of orderedTaskIds) {
    const row = existing.find((r) => r.taskId === taskId);
    if (!row) continue;
    const placement = await db.taskBoardPlacement.findUnique({
      where: { id: row.id },
      select: { isPrimary: true, typeId: true },
    });
    if (placement?.isPrimary) {
      const pos = orderedTaskIds.indexOf(taskId);
      await syncPrimaryTaskFields(db, taskId, {
        boardId,
        columnId,
        typeId: placement.typeId,
        position: pos,
      });
    }
  }
}

export async function reserveTopPlacementInColumn(
  db: DbClient,
  boardId: string,
  columnId: string,
): Promise<number> {
  await db.taskBoardPlacement.updateMany({
    where: { boardId, columnId },
    data: { position: { increment: 1 } },
  });
  return 0;
}

export function applyPlacementToTaskRow<T extends Record<string, unknown>>(
  task: T,
  placement: {
    boardId: string;
    columnId: string;
    typeId: string;
    position: number;
    isPrimary: boolean;
    type?: { id: string; name: string; color: string; icon: string | null };
  },
  opts: {
    boardCode: string;
    primaryBoardCode: string;
    taskNumber: number;
    boardPlacementsCount?: number;
  },
): T & {
  boardId: string;
  columnId: string;
  typeId: string;
  position: number;
  isPrimaryPlacement: boolean;
  boardPlacementsCount: number;
  key: string;
  boardCode: string;
} {
  return {
    ...task,
    boardId: placement.boardId,
    columnId: placement.columnId,
    typeId: placement.typeId,
    position: placement.position,
    isPrimaryPlacement: placement.isPrimary,
    boardPlacementsCount: opts.boardPlacementsCount ?? 1,
    key: formatTaskKey(opts.primaryBoardCode, opts.taskNumber),
    boardCode: opts.boardCode,
    ...(placement.type ? { type: placement.type } : {}),
  };
}

export const taskIncludeForBoardList = {
  type: true,
  assignee: {
    select: { id: true, name: true, email: true, avatar: true },
  },
  creator: {
    select: { id: true, name: true, email: true },
  },
  lexCreator: {
    select: {
      id: true,
      name: true,
      email: true,
      clientKind: true,
      companyName: true,
    },
  },
  board: { select: { id: true, code: true, name: true } },
  _count: {
    select: { comments: true, chatMessages: true, boardPlacements: true },
  },
  columnApprovals: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      ruleId: true,
      columnId: true,
      ruleName: true,
      approvedByUserId: true,
      status: true,
      reason: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  columnActionCompletions: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      ruleId: true,
      columnId: true,
      ruleName: true,
      actionKind: true,
      payload: true,
      completedByUserId: true,
      createdAt: true,
    },
  },
} as const;
