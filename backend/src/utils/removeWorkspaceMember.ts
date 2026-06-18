import type { PrismaClient } from '@prisma/client';
import { createAndBroadcastNotification } from './notifications';

export async function removeUserFromWorkspace(
  prisma: PrismaClient,
  workspaceId: string,
  targetUserId: string,
  opts?: {
    notify?: boolean;
    actorName?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, ownerId: true },
  });
  if (!ws) return { ok: false, error: 'Рабочее пространство не найдено' };

  if (ws.ownerId === targetUserId) {
    return { ok: false, error: 'Нельзя исключить владельца пространства', code: 'OWNER' };
  }

  const membership = await prisma.workspaceUser.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    select: { id: true },
  });
  if (!membership) {
    return { ok: false, error: 'Пользователь не состоит в этом пространстве', code: 'NOT_MEMBER' };
  }

  const workspaceGroupIds = (
    await prisma.group.findMany({
      where: { workspaceId },
      select: { id: true },
    })
  ).map((g) => g.id);

  await prisma.$transaction(async (tx) => {
    if (workspaceGroupIds.length > 0) {
      await tx.userGroup.deleteMany({
        where: { userId: targetUserId, groupId: { in: workspaceGroupIds } },
      });
    }

    await tx.workspaceInvite.updateMany({
      where: { workspaceId, userId: targetUserId, status: 'pending' },
      data: { status: 'cancelled', respondedAt: new Date() },
    });

    await tx.workspaceUser.delete({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
  });

  if (opts?.notify !== false) {
    const message = opts?.actorName
      ? `${opts.actorName} исключил(а) вас из «${ws.name}»`
      : `Вас исключили из «${ws.name}»`;
    await createAndBroadcastNotification(prisma, {
      type: 'workspace_member_removed',
      title: 'Исключение из пространства',
      message,
      userId: targetUserId,
      relatedId: workspaceId,
    });
  }

  return { ok: true };
}
