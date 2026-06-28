import type { PrismaClient } from '@prisma/client';
import { createAndBroadcastNotification } from './notifications';
import { getWorkspaceMemberIds } from './workspaceMembers';
import { removeUserFromWorkspace } from './removeWorkspaceMember';

export async function transferWorkspaceOwnership(
  prisma: PrismaClient,
  workspaceId: string,
  currentOwnerId: string,
  newOwnerId: string,
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  if (currentOwnerId === newOwnerId) {
    return { ok: false, error: 'Выберите другого пользователя', code: 'SAME_USER' };
  }

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, ownerId: true },
  });
  if (!ws) {
    return { ok: false, error: 'Рабочее пространство не найдено', code: 'NOT_FOUND' };
  }
  if (ws.ownerId !== currentOwnerId) {
    return { ok: false, error: 'Передать владение может только текущий владелец', code: 'NOT_OWNER' };
  }

  const memberIds = await getWorkspaceMemberIds(prisma, workspaceId);
  if (!memberIds.has(newOwnerId)) {
    return { ok: false, error: 'Новый владелец должен быть участником пространства', code: 'NOT_MEMBER' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.workspace.update({
      where: { id: workspaceId },
      data: { ownerId: newOwnerId },
    });

    await tx.workspaceUser.upsert({
      where: { workspaceId_userId: { workspaceId, userId: newOwnerId } },
      create: {
        workspaceId,
        userId: newOwnerId,
        role: 'admin',
      },
      update: { role: 'admin' },
    });
  });

  const actor = await prisma.user.findUnique({
    where: { id: currentOwnerId },
    select: { name: true },
  });

  await createAndBroadcastNotification(prisma, {
    type: 'workspace_ownership_transferred',
    title: 'Владение пространством',
    message: `${actor?.name ?? 'Пользователь'} передал(а) вам владение «${ws.name}»`,
    userId: newOwnerId,
    relatedId: workspaceId,
  });

  return { ok: true };
}

export async function leaveWorkspace(
  prisma: PrismaClient,
  userId: string,
  workspaceId: string,
): Promise<
  | { ok: true; left: true; workspaceDeleted?: boolean; workspaceName?: string }
  | { ok: false; error: string; code?: string }
> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, ownerId: true },
  });
  if (!ws) {
    return { ok: false, error: 'Рабочее пространство не найдено', code: 'NOT_FOUND' };
  }

  const memberIds = await getWorkspaceMemberIds(prisma, workspaceId);
  if (!memberIds.has(userId)) {
    return { ok: false, error: 'Вы не состоите в этом пространстве', code: 'NOT_MEMBER' };
  }

  const isOwner = ws.ownerId === userId;
  const soleMember = memberIds.size === 1;

  if (isOwner && !soleMember) {
    return {
      ok: false,
      error: 'Перед выходом передайте владение другому участнику',
      code: 'TRANSFER_OWNERSHIP_REQUIRED',
    };
  }

  if (isOwner && soleMember) {
    await prisma.workspace.delete({ where: { id: workspaceId } });
    return { ok: true, left: true, workspaceDeleted: true, workspaceName: ws.name };
  }

  const removed = await removeUserFromWorkspace(prisma, workspaceId, userId, { notify: false });
  if (!removed.ok) {
    return removed;
  }

  return { ok: true, left: true, workspaceName: ws.name };
}
