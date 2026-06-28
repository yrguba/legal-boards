import { PrismaClient } from '@prisma/client';
import { assertWorkspaceMember } from './documentAccess';
import { isArchived } from './archiveScope';

export async function assertUserCanAccessTask(
  prisma: PrismaClient,
  taskId: string,
  ctx: { userId?: string; userRole?: string; lexClientId?: string },
  opts?: { allowArchived?: boolean },
): Promise<{ ok: true; workspaceId: string } | { ok: false }> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { board: { select: { workspaceId: true, archivedAt: true } } },
  });
  if (!task) {
    return { ok: false };
  }

  if (!opts?.allowArchived && (isArchived(task) || isArchived(task.board))) {
    return { ok: false };
  }

  if (ctx.lexClientId) {
    if (task.lexCreatorId === ctx.lexClientId) {
      return { ok: true, workspaceId: task.board.workspaceId };
    }
    return { ok: false };
  }

  if (!ctx.userId) {
    return { ok: false };
  }

  const member = await assertWorkspaceMember(
    prisma,
    task.board.workspaceId,
    ctx.userId,
    ctx.userRole,
  );
  if (!member) {
    return { ok: false };
  }
  return { ok: true, workspaceId: task.board.workspaceId };
}
