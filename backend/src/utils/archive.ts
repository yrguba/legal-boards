import type { Board, PrismaClient, Task } from '@prisma/client';
import { assertWorkspaceMember } from './documentAccess';

export type ArchiveActor = { userId: string; userRole?: string };

export async function assertCanManageBoardArchive(
  prisma: PrismaClient,
  board: Pick<Board, 'workspaceId'>,
  actor: ArchiveActor,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (actor.userRole !== 'admin' && actor.userRole !== 'manager') {
    return { ok: false, error: 'Недостаточно прав' };
  }
  const member = await assertWorkspaceMember(
    prisma,
    board.workspaceId,
    actor.userId,
    actor.userRole,
  );
  if (!member) {
    return { ok: false, error: 'Нет доступа к этому пространству' };
  }
  return { ok: true };
}

export async function assertCanManageTaskArchive(
  prisma: PrismaClient,
  task: Pick<Task, 'createdBy' | 'boardId'>,
  actor: ArchiveActor,
): Promise<{ ok: true; workspaceId: string } | { ok: false; error: string }> {
  const board = await prisma.board.findUnique({
    where: { id: task.boardId },
    select: { workspaceId: true },
  });
  if (!board) {
    return { ok: false, error: 'Доска не найдена' };
  }

  const member = await assertWorkspaceMember(
    prisma,
    board.workspaceId,
    actor.userId,
    actor.userRole,
  );
  if (!member) {
    return { ok: false, error: 'Нет доступа к этому пространству' };
  }

  if (actor.userRole === 'admin' || actor.userRole === 'manager') {
    return { ok: true, workspaceId: board.workspaceId };
  }
  if (task.createdBy === actor.userId) {
    return { ok: true, workspaceId: board.workspaceId };
  }
  return { ok: false, error: 'Недостаточно прав' };
}

export async function archiveBoard(
  prisma: PrismaClient,
  boardId: string,
  actorUserId: string,
): Promise<void> {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.board.update({
      where: { id: boardId },
      data: { archivedAt: now, archivedById: actorUserId },
    });
    await tx.aggregatedBoardSource.deleteMany({ where: { sourceBoardId: boardId } });
    await tx.task.updateMany({
      where: { boardId, archivedAt: null },
      data: {
        archivedAt: now,
        archivedById: actorUserId,
        archivedWithBoardId: boardId,
      },
    });
  });
}

export async function restoreBoard(prisma: PrismaClient, boardId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.board.update({
      where: { id: boardId },
      data: { archivedAt: null, archivedById: null },
    });
    await tx.task.updateMany({
      where: { archivedWithBoardId: boardId },
      data: { archivedAt: null, archivedById: null, archivedWithBoardId: null },
    });
  });
}

export async function permanentDeleteBoard(prisma: PrismaClient, boardId: string): Promise<void> {
  await prisma.board.delete({ where: { id: boardId } });
}

export async function archiveTask(
  prisma: PrismaClient,
  taskId: string,
  actorUserId: string,
): Promise<void> {
  await prisma.task.update({
    where: { id: taskId },
    data: {
      archivedAt: new Date(),
      archivedById: actorUserId,
      archivedWithBoardId: null,
    },
  });
}

export async function restoreTask(
  prisma: PrismaClient,
  taskId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { board: { select: { archivedAt: true } } },
  });
  if (!task) {
    return { ok: false, error: 'Задача не найдена' };
  }
  if (task.board.archivedAt) {
    return { ok: false, error: 'Сначала восстановите доску' };
  }
  await prisma.task.update({
    where: { id: taskId },
    data: { archivedAt: null, archivedById: null, archivedWithBoardId: null },
  });
  return { ok: true };
}

export async function permanentDeleteTask(prisma: PrismaClient, taskId: string): Promise<void> {
  await prisma.task.delete({ where: { id: taskId } });
}
