import { PrismaClient } from '@prisma/client';
import { assertWorkspaceMember } from './documentAccess';

export async function assertUserCanAccessTask(
  prisma: PrismaClient,
  taskId: string,
  userId: string,
  userRole?: string
): Promise<{ ok: true; workspaceId: string } | { ok: false }> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { board: { select: { workspaceId: true } } },
  });
  if (!task) {
    return { ok: false };
  }
  const member = await assertWorkspaceMember(
    prisma,
    task.board.workspaceId,
    userId,
    userRole
  );
  if (!member) {
    return { ok: false };
  }
  return { ok: true, workspaceId: task.board.workspaceId };
}
