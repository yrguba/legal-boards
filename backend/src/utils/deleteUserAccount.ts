import fs from 'fs';
import path from 'path';
import type { PrismaClient } from '@prisma/client';
import { getUploadsPath } from '../uploadsPath';
import { verifyPassword } from './passwordAuth';
import { getWorkspaceMemberIds } from './workspaceMembers';
import { leaveWorkspace } from './workspaceOwnership';

function deleteStoredAvatarFile(avatarPath: string | null | undefined) {
  if (!avatarPath) return;
  const normalized = avatarPath.replace(/\\/g, '/');
  if (!normalized.includes('uploads/')) return;
  const fp = path.join(getUploadsPath(), path.basename(normalized));
  try {
    fs.unlinkSync(fp);
  } catch {
    /* ignore */
  }
}

async function detachUserReferences(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({ where: { createdBy: userId }, data: { createdBy: null } });
    await tx.task.updateMany({ where: { assigneeId: userId }, data: { assigneeId: null } });
    await tx.taskAttachment.updateMany({ where: { uploadedBy: userId }, data: { uploadedBy: null } });
    await tx.commentAttachment.deleteMany({ where: { uploadedBy: userId } });
    await tx.document.deleteMany({ where: { uploadedBy: userId } });
    await tx.workspaceChatMessageAttachment.deleteMany({ where: { uploadedBy: userId } });
  });
}

export type AccountDeletionPrecheck = {
  canDelete: boolean;
  email: string;
  ownedWorkspaces: {
    id: string;
    name: string;
    memberCount: number;
    soleMember: boolean;
    needsTransfer: boolean;
  }[];
  otherWorkspaceIds: string[];
  blockers: { code: string; message: string }[];
};

export async function getAccountDeletionPrecheck(
  prisma: PrismaClient,
  userId: string,
): Promise<AccountDeletionPrecheck | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
  if (!user) return null;

  const owned = await prisma.workspace.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const ownedWorkspaces = await Promise.all(
    owned.map(async (ws) => {
      const memberIds = await getWorkspaceMemberIds(prisma, ws.id);
      const memberCount = memberIds.size;
      const soleMember = memberCount === 1;
      return {
        id: ws.id,
        name: ws.name,
        memberCount,
        soleMember,
        needsTransfer: memberCount > 1,
      };
    }),
  );

  const memberships = await prisma.workspaceUser.findMany({
    where: { userId },
    select: { workspaceId: true },
  });
  const ownedIds = new Set(owned.map((w) => w.id));
  const otherWorkspaceIds = memberships
    .map((m) => m.workspaceId)
    .filter((id) => !ownedIds.has(id));

  const blockers: AccountDeletionPrecheck['blockers'] = [];

  for (const ws of ownedWorkspaces) {
    if (ws.needsTransfer) {
      blockers.push({
        code: 'TRANSFER_OWNERSHIP_REQUIRED',
        message: `Передайте владение пространством «${ws.name}» другому участнику`,
      });
    }
  }

  if (user.role === 'admin') {
    const adminCount = await prisma.user.count({ where: { role: 'admin' } });
    if (adminCount <= 1) {
      blockers.push({
        code: 'LAST_GLOBAL_ADMIN',
        message: 'Нельзя удалить единственного системного администратора',
      });
    }
  }

  return {
    canDelete: blockers.length === 0,
    email: user.email,
    ownedWorkspaces,
    otherWorkspaceIds,
    blockers,
  };
}

export async function deleteUserAccount(
  prisma: PrismaClient,
  userId: string,
  password: string,
): Promise<{ ok: true; email: string } | { ok: false; error: string; code?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, password: true, avatar: true, role: true },
  });
  if (!user) {
    return { ok: false, error: 'Пользователь не найден', code: 'NOT_FOUND' };
  }

  const passwordOk = await verifyPassword(password, user.password);
  if (!passwordOk) {
    return { ok: false, error: 'Неверный пароль', code: 'INVALID_PASSWORD' };
  }

  const precheck = await getAccountDeletionPrecheck(prisma, userId);
  if (!precheck) {
    return { ok: false, error: 'Пользователь не найден', code: 'NOT_FOUND' };
  }
  if (!precheck.canDelete) {
    return {
      ok: false,
      error: precheck.blockers[0]?.message ?? 'Невозможно удалить аккаунт',
      code: precheck.blockers[0]?.code ?? 'BLOCKED',
    };
  }

  const owned = await prisma.workspace.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });

  for (const ws of owned) {
    const left = await leaveWorkspace(prisma, userId, ws.id);
    if (!left.ok) {
      return { ok: false, error: left.error, code: left.code };
    }
  }

  const memberships = await prisma.workspaceUser.findMany({
    where: { userId },
    select: { workspaceId: true },
  });
  for (const m of memberships) {
    const left = await leaveWorkspace(prisma, userId, m.workspaceId);
    if (!left.ok && left.code !== 'NOT_MEMBER') {
      return { ok: false, error: left.error, code: left.code };
    }
  }

  deleteStoredAvatarFile(user.avatar);
  await detachUserReferences(prisma, userId);
  await prisma.user.delete({ where: { id: userId } });

  return { ok: true, email: user.email };
}
