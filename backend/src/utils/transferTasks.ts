import type { Prisma, PrismaClient } from '@prisma/client';
import { assertColumnApprovalsComplete } from './boardApprovals';
import { writeActivityLog } from './activityLog';
import { formatTaskKey, nextTaskNumber } from './taskKeys';

type DbClient = PrismaClient | Prisma.TransactionClient;

export type TransferTasksInput = {
  sourceBoardId: string;
  targetBoardId: string;
  targetColumnId?: string;
  taskIds: string[];
  typeMapping?: Record<string, string>;
  defaultTargetTypeId?: string;
  force?: boolean;
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

export type TransferTaskSkipped = {
  taskId: string;
  reason: string;
  code?: string;
};

export type TransferTasksResult = {
  moved: TransferTaskMoved[];
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
    actorUserId,
  } = input;

  const result: TransferTasksResult = { moved: [], skipped: [], warnings: [] };

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

  const resolvedColumnId =
    targetColumnId ?? targetBoard.columns[0]?.id ?? null;
  if (!resolvedColumnId) throw new Error('TARGET_COLUMN_NOT_FOUND');

  const targetColumn = targetBoard.columns.find((c) => c.id === resolvedColumnId);
  if (!targetColumn) throw new Error('TARGET_COLUMN_NOT_FOUND');

  const targetTypeIds = targetBoard.taskTypes.map((t) => t.id);
  if (targetTypeIds.length === 0) throw new Error('TARGET_TYPES_EMPTY');

  const tasks = await prisma.task.findMany({
    where: { id: { in: uniqueTaskIds }, boardId: sourceBoardId },
    include: {
      assignee: { select: { id: true, name: true } },
    },
  });

  const foundIds = new Set(tasks.map((t) => t.id));
  for (const id of uniqueTaskIds) {
    if (!foundIds.has(id)) {
      result.skipped.push({
        taskId: id,
        reason: 'Задача не найдена на исходной доске',
        code: 'not_found',
      });
    }
  }

  type PendingMove = {
    task: (typeof tasks)[number];
    targetTypeId: string;
    newAssigneeId: string | null;
    assigneeCleared: boolean;
    assigneeWarning?: TransferTaskWarning;
  };

  const pending: PendingMove[] = [];

  for (const task of tasks) {
    const targetTypeId = resolveTargetTypeId(
      task.typeId,
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
        task.columnId,
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
    let assigneeWarning: TransferTaskWarning | undefined;

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
        assigneeWarning = {
          taskId: task.id,
          code: 'assignee_cleared',
          message: `Исполнитель «${name}» не состоит в целевом пространстве — назначение снято`,
        };
        result.warnings.push(assigneeWarning);
      }
    }

    pending.push({
      task,
      targetTypeId,
      newAssigneeId,
      assigneeCleared,
      assigneeWarning,
    });
  }

  if (pending.length === 0) {
    return result;
  }

  await prisma.$transaction(async (tx) => {
    let nextNum = await nextTaskNumber(tx, targetBoardId);
    let nextPosition = await tx.task.count({ where: { columnId: resolvedColumnId } });

    for (const item of pending) {
      const { task, targetTypeId, newAssigneeId, assigneeCleared } = item;
      const oldKey = formatTaskKey(sourceBoard.code, task.number);
      const newNumber = nextNum++;
      const newKey = formatTaskKey(targetBoard.code, newNumber);

      const mappedCustomFields = mapCustomFieldsByName(
        sourceBoard.taskFields,
        targetBoard.taskFields,
        task.customFields,
      );

      await tx.task.update({
        where: { id: task.id },
        data: {
          boardId: targetBoardId,
          columnId: resolvedColumnId,
          typeId: targetTypeId,
          number: newNumber,
          position: nextPosition++,
          assigneeId: newAssigneeId,
          customFields: mappedCustomFields as Prisma.InputJsonValue,
          trackedTimeSeconds: 0,
          timeTrackingActiveSince: null,
          timeTrackingCycleOpen: false,
        },
      });

      await tx.taskColumnApproval.deleteMany({ where: { taskId: task.id } });
      await tx.taskColumnActionCompletion.deleteMany({ where: { taskId: task.id } });

      await writeActivityLog(tx, {
        workspaceId: targetBoard.workspaceId,
        boardId: targetBoardId,
        taskId: task.id,
        eventType: 'task_transferred',
        actorUserId,
        payload: {
          fromBoardId: sourceBoardId,
          fromBoardCode: sourceBoard.code,
          toBoardId: targetBoardId,
          toBoardCode: targetBoard.code,
          fromWorkspaceId: sourceBoard.workspaceId,
          toWorkspaceId: targetBoard.workspaceId,
          oldKey,
          newKey,
          targetColumnId: resolvedColumnId,
          targetColumnName: targetColumn.name,
          assigneeCleared,
          fromAssigneeId: task.assigneeId,
          toAssigneeId: newAssigneeId,
        },
      });

      result.moved.push({
        taskId: task.id,
        oldKey,
        newKey,
        ...(assigneeCleared ? { assigneeCleared: true } : {}),
      });
    }
  });

  return result;
}
