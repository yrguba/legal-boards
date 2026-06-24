import type { Prisma, PrismaClient } from '@prisma/client';
import { assertColumnApprovalsComplete } from './boardApprovals';
import { ACTIVITY_EVENT_TYPES, writeActivityLog } from './activityLog';
import { formatTaskKey, nextTaskNumber } from './taskKeys';
import {
  addTaskToBoard,
  getPlacementForBoard,
  removeTaskFromBoard,
  reserveTopPlacementInColumn,
  syncPrimaryTaskFields,
} from './taskPlacements';
import { TASK_BOARD_TRANSITION_KIND, writeTaskBoardTransition } from './taskBoardTransitions';

type DbClient = PrismaClient | Prisma.TransactionClient;

export type TransferMode = 'move' | 'mirror';

export type TransferTasksInput = {
  sourceBoardId: string;
  targetBoardId: string;
  targetColumnId?: string;
  taskIds: string[];
  typeMapping?: Record<string, string>;
  defaultTargetTypeId?: string;
  force?: boolean;
  mode?: TransferMode;
  actorUserId: string;
};

export type TransferTaskWarning = {
  taskId: string;
  code: string;
  message: string;
};

export type TransferTaskMoved = {
  taskId: string;
  oldKey: string;
  newKey: string;
  assigneeCleared?: boolean;
};

export type TransferTaskAdded = {
  taskId: string;
  key: string;
  created: boolean;
};

export type TransferTaskSkipped = {
  taskId: string;
  reason: string;
  code?: string;
};

export type TransferTasksResult = {
  mode: TransferMode;
  moved: TransferTaskMoved[];
  added: TransferTaskAdded[];
  skipped: TransferTaskSkipped[];
  warnings: TransferTaskWarning[];
};

async function isUserInWorkspace(
  db: DbClient,
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });
  if (!ws) return false;
  if (ws.ownerId === userId) return true;
  const m = await db.workspaceUser.findFirst({
    where: { workspaceId, userId },
  });
  return !!m;
}

function mapCustomFieldsByName(
  sourceFields: { id: string; name: string }[],
  targetFields: { id: string; name: string }[],
  customFields: unknown,
): Record<string, unknown> {
  if (!customFields || typeof customFields !== 'object' || Array.isArray(customFields)) {
    return {};
  }
  const raw = customFields as Record<string, unknown>;
  const targetByName = new Map(
    targetFields.map((f) => [f.name.trim().toLowerCase(), f.id]),
  );
  const sourceNameById = new Map(sourceFields.map((f) => [f.id, f.name.trim().toLowerCase()]));
  const result: Record<string, unknown> = {};
  for (const [sourceId, value] of Object.entries(raw)) {
    const nameKey = sourceNameById.get(sourceId);
    if (!nameKey) continue;
    const targetId = targetByName.get(nameKey);
    if (targetId) result[targetId] = value;
  }
  return result;
}

function resolveTargetTypeId(
  sourceTypeId: string,
  typeMapping: Record<string, string> | undefined,
  defaultTargetTypeId: string | undefined,
  targetTypeIds: string[],
): string | null {
  const mapped = typeMapping?.[sourceTypeId];
  if (mapped && targetTypeIds.includes(mapped)) return mapped;
  if (defaultTargetTypeId && targetTypeIds.includes(defaultTargetTypeId)) {
    return defaultTargetTypeId;
  }
  return targetTypeIds[0] ?? null;
}

async function movePrimaryPlacement(
  prisma: PrismaClient,
  args: {
    task: {
      id: string;
      number: number;
      columnId: string;
      typeId: string;
      assigneeId: string | null;
      customFields: unknown;
      board: { code: string };
    };
    sourceBoardId: string;
    sourceBoardCode: string;
    sourceColumnId: string;
    targetBoardId: string;
    targetBoardCode: string;
    targetBoardName: string;
    targetColumnId: string;
    targetColumnName: string;
    targetTypeId: string;
    newAssigneeId: string | null;
    mappedCustomFields: Record<string, unknown>;
    actorUserId: string;
  },
): Promise<{ oldKey: string; newKey: string }> {
  const oldKey = formatTaskKey(args.sourceBoardCode, args.task.number);

  return prisma.$transaction(async (tx) => {
    const sourcePlacement = await tx.taskBoardPlacement.findUnique({
      where: { taskId_boardId: { taskId: args.task.id, boardId: args.sourceBoardId } },
    });
    if (!sourcePlacement) throw new Error('SOURCE_PLACEMENT_NOT_FOUND');

    await tx.taskBoardPlacement.delete({
      where: { taskId_boardId: { taskId: args.task.id, boardId: args.sourceBoardId } },
    });

    await tx.taskBoardPlacement.updateMany({
      where: {
        boardId: args.sourceBoardId,
        columnId: sourcePlacement.columnId,
        position: { gt: sourcePlacement.position },
      },
      data: { position: { decrement: 1 } },
    });

    const newNumber = await nextTaskNumber(tx, args.targetBoardId);
    const newKey = formatTaskKey(args.targetBoardCode, newNumber);
    const position = await reserveTopPlacementInColumn(
      tx,
      args.targetBoardId,
      args.targetColumnId,
    );

    const existingTarget = await tx.taskBoardPlacement.findUnique({
      where: { taskId_boardId: { taskId: args.task.id, boardId: args.targetBoardId } },
    });

    if (existingTarget) {
      await tx.taskBoardPlacement.update({
        where: { id: existingTarget.id },
        data: {
          isPrimary: true,
          columnId: args.targetColumnId,
          typeId: args.targetTypeId,
          position,
        },
      });
    } else {
      await tx.taskBoardPlacement.create({
        data: {
          taskId: args.task.id,
          boardId: args.targetBoardId,
          columnId: args.targetColumnId,
          typeId: args.targetTypeId,
          position,
          isPrimary: true,
        },
      });
    }

    await tx.taskBoardPlacement.updateMany({
      where: { taskId: args.task.id, boardId: { not: args.targetBoardId } },
      data: { isPrimary: false },
    });

    await tx.task.update({
      where: { id: args.task.id },
      data: {
        boardId: args.targetBoardId,
        columnId: args.targetColumnId,
        typeId: args.targetTypeId,
        number: newNumber,
        position,
        assigneeId: args.newAssigneeId,
        customFields: args.mappedCustomFields as Prisma.InputJsonValue,
        trackedTimeSeconds: 0,
        timeTrackingActiveSince: null,
        timeTrackingCycleOpen: false,
      },
    });

    await syncPrimaryTaskFields(tx, args.task.id, {
      boardId: args.targetBoardId,
      columnId: args.targetColumnId,
      typeId: args.targetTypeId,
      position,
    });

    await tx.taskColumnApproval.deleteMany({ where: { taskId: args.task.id } });
    await tx.taskColumnActionCompletion.deleteMany({ where: { taskId: args.task.id } });

    const sourceBoard = await tx.board.findUnique({
      where: { id: args.sourceBoardId },
      select: { workspaceId: true, name: true },
    });

    await writeTaskBoardTransition(tx, {
      taskId: args.task.id,
      workspaceId: sourceBoard?.workspaceId ?? '',
      eventKind: TASK_BOARD_TRANSITION_KIND.PLACEMENT_REMOVED,
      boardId: args.sourceBoardId,
      columnId: sourcePlacement.columnId,
      actorUserId: args.actorUserId,
      source: 'transfer',
      payload: { boardName: sourceBoard?.name, mode: 'move' },
    });

    await writeTaskBoardTransition(tx, {
      taskId: args.task.id,
      workspaceId: sourceBoard?.workspaceId ?? '',
      eventKind: TASK_BOARD_TRANSITION_KIND.PLACEMENT_CREATED,
      boardId: args.targetBoardId,
      columnId: args.targetColumnId,
      actorUserId: args.actorUserId,
      source: 'transfer',
      payload: {
        boardName: args.targetBoardName,
        columnName: args.targetColumnName,
        isPrimary: true,
        mode: 'move',
      },
    });

    await writeActivityLog(tx, {
      workspaceId: sourceBoard?.workspaceId ?? '',
      boardId: args.targetBoardId,
      taskId: args.task.id,
      eventType: ACTIVITY_EVENT_TYPES.TRANSFERRED,
      actorUserId: args.actorUserId,
      payload: {
        mode: 'move',
        fromBoardId: args.sourceBoardId,
        fromBoardCode: args.sourceBoardCode,
        toBoardId: args.targetBoardId,
        toBoardCode: args.targetBoardCode,
        oldKey,
        newKey,
        targetColumnId: args.targetColumnId,
        targetColumnName: args.targetColumnName,
        isPrimary: true,
      },
    });

    return { oldKey, newKey };
  });
}

export async function transferTasks(
  prisma: PrismaClient,
  input: TransferTasksInput,
): Promise<TransferTasksResult> {
  const {
    sourceBoardId,
    targetBoardId,
    targetColumnId,
    taskIds,
    typeMapping,
    defaultTargetTypeId,
    force = false,
    mode = 'move',
    actorUserId,
  } = input;

  const result: TransferTasksResult = {
    mode,
    moved: [],
    added: [],
    skipped: [],
    warnings: [],
  };

  if (!taskIds.length) {
    return result;
  }

  if (sourceBoardId === targetBoardId) {
    throw new Error('SAME_BOARD');
  }

  const uniqueTaskIds = [...new Set(taskIds)];

  const [sourceBoard, targetBoard] = await Promise.all([
    prisma.board.findUnique({
      where: { id: sourceBoardId },
      include: {
        taskFields: { orderBy: { position: 'asc' } },
        taskTypes: true,
      },
    }),
    prisma.board.findUnique({
      where: { id: targetBoardId },
      include: {
        columns: { orderBy: { position: 'asc' } },
        taskFields: { orderBy: { position: 'asc' } },
        taskTypes: true,
      },
    }),
  ]);

  if (!sourceBoard) throw new Error('SOURCE_BOARD_NOT_FOUND');
  if (!targetBoard) throw new Error('TARGET_BOARD_NOT_FOUND');
  if (targetBoard.kind === 'aggregated') throw new Error('AGGREGATED_BOARD');

  const resolvedColumnId =
    targetColumnId ?? targetBoard.columns[0]?.id ?? null;
  if (!resolvedColumnId) throw new Error('TARGET_COLUMN_NOT_FOUND');

  const targetColumn = targetBoard.columns.find((c) => c.id === resolvedColumnId);
  if (!targetColumn) throw new Error('TARGET_COLUMN_NOT_FOUND');

  const targetTypeIds = targetBoard.taskTypes.map((t) => t.id);
  if (targetTypeIds.length === 0) throw new Error('TARGET_TYPES_EMPTY');

  const placements = await prisma.taskBoardPlacement.findMany({
    where: {
      boardId: sourceBoardId,
      taskId: { in: uniqueTaskIds },
    },
    include: {
      task: {
        include: {
          board: { select: { id: true, code: true } },
          assignee: { select: { id: true, name: true } },
        },
      },
    },
  });

  const foundIds = new Set(placements.map((p) => p.taskId));
  for (const id of uniqueTaskIds) {
    if (!foundIds.has(id)) {
      result.skipped.push({
        taskId: id,
        reason: 'Задача не найдена на исходной доске',
        code: 'not_found',
      });
    }
  }

  for (const placement of placements) {
    const task = placement.task;
    const placementTypeId = placement.typeId;

    const targetTypeId = resolveTargetTypeId(
      placementTypeId,
      typeMapping,
      defaultTargetTypeId,
      targetTypeIds,
    );
    if (!targetTypeId) {
      result.skipped.push({
        taskId: task.id,
        reason: 'Не удалось определить тип на целевой доске',
        code: 'type_unmapped',
      });
      continue;
    }

    if (!force) {
      const approvalCheck = await assertColumnApprovalsComplete(
        prisma,
        task.id,
        placement.columnId,
        sourceBoard.advancedSettings,
      );
      if (!approvalCheck.ok) {
        result.skipped.push({
          taskId: task.id,
          reason: approvalCheck.message,
          code: 'approvals_pending',
        });
        continue;
      }
    }

    let newAssigneeId = task.assigneeId;
    let assigneeCleared = false;

    if (task.assigneeId) {
      const inWorkspace = await isUserInWorkspace(
        prisma,
        targetBoard.workspaceId,
        task.assigneeId,
      );
      if (!inWorkspace) {
        newAssigneeId = null;
        assigneeCleared = true;
        const name = task.assignee?.name ?? task.assigneeId;
        result.warnings.push({
          taskId: task.id,
          code: 'assignee_cleared',
          message: `Исполнитель «${name}» не состоит в целевом пространстве — назначение снято`,
        });
      }
    }

    const taskKey = formatTaskKey(task.board.code, task.number);

    if (mode === 'mirror') {
      try {
        const existing = await getPlacementForBoard(prisma, task.id, targetBoardId);
        if (existing) {
          result.added.push({ taskId: task.id, key: taskKey, created: false });
          continue;
        }

        const addResult = await addTaskToBoard(prisma, {
          taskId: task.id,
          boardId: targetBoardId,
          columnId: resolvedColumnId,
          typeId: targetTypeId,
          actorUserId,
        });

        result.added.push({
          taskId: task.id,
          key: taskKey,
          created: addResult.created,
        });

        await writeActivityLog(prisma, {
          workspaceId: targetBoard.workspaceId,
          boardId: targetBoardId,
          taskId: task.id,
          eventType: ACTIVITY_EVENT_TYPES.TRANSFERRED,
          actorUserId,
          payload: {
            mode: 'mirror',
            fromBoardId: sourceBoardId,
            fromBoardCode: sourceBoard.code,
            toBoardId: targetBoardId,
            toBoardCode: targetBoard.code,
            key: taskKey,
            targetColumnId: resolvedColumnId,
            targetColumnName: targetColumn.name,
          },
        });
      } catch (err) {
        result.skipped.push({
          taskId: task.id,
          reason: err instanceof Error ? err.message : 'Не удалось добавить на доску',
          code: 'mirror_failed',
        });
      }
      continue;
    }

    // mode === 'move'
    try {
      if (placement.isPrimary) {
        const mappedCustomFields = mapCustomFieldsByName(
          sourceBoard.taskFields,
          targetBoard.taskFields,
          task.customFields,
        );

        const keys = await movePrimaryPlacement(prisma, {
          task: {
            id: task.id,
            number: task.number,
            columnId: placement.columnId,
            typeId: placementTypeId,
            assigneeId: task.assigneeId,
            customFields: task.customFields,
            board: task.board,
          },
          sourceBoardId,
          sourceBoardCode: sourceBoard.code,
          sourceColumnId: placement.columnId,
          targetBoardId,
          targetBoardCode: targetBoard.code,
          targetBoardName: targetBoard.name,
          targetColumnId: resolvedColumnId,
          targetColumnName: targetColumn.name,
          targetTypeId,
          newAssigneeId,
          mappedCustomFields,
          actorUserId,
        });

        result.moved.push({
          taskId: task.id,
          oldKey: keys.oldKey,
          newKey: keys.newKey,
          ...(assigneeCleared ? { assigneeCleared: true } : {}),
        });
      } else {
        await removeTaskFromBoard(prisma, {
          taskId: task.id,
          boardId: sourceBoardId,
          actorUserId,
        });

        await addTaskToBoard(prisma, {
          taskId: task.id,
          boardId: targetBoardId,
          columnId: resolvedColumnId,
          typeId: targetTypeId,
          actorUserId,
        });

        await writeActivityLog(prisma, {
          workspaceId: targetBoard.workspaceId,
          boardId: targetBoardId,
          taskId: task.id,
          eventType: ACTIVITY_EVENT_TYPES.TRANSFERRED,
          actorUserId,
          payload: {
            mode: 'move',
            fromBoardId: sourceBoardId,
            fromBoardCode: sourceBoard.code,
            toBoardId: targetBoardId,
            toBoardCode: targetBoard.code,
            oldKey: taskKey,
            newKey: taskKey,
            targetColumnId: resolvedColumnId,
            targetColumnName: targetColumn.name,
            isPrimary: false,
          },
        });

        result.moved.push({
          taskId: task.id,
          oldKey: taskKey,
          newKey: taskKey,
          ...(assigneeCleared ? { assigneeCleared: true } : {}),
        });
      }
    } catch (err) {
      result.skipped.push({
        taskId: task.id,
        reason: err instanceof Error ? err.message : 'Не удалось перенести задачу',
        code: 'move_failed',
      });
    }
  }

  return result;
}
