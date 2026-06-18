import type { PrismaClient } from '@prisma/client';

const MANAGE_ROLES = new Set(['admin', 'manager']);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Роль пользователя в конкретном workspace (owner → admin). */
export async function resolveWorkspaceRole(
  prisma: PrismaClient,
  userId: string,
  workspaceId: string,
): Promise<string | null> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });
  if (!ws) return null;
  if (ws.ownerId === userId) return 'admin';

  const membership = await prisma.workspaceUser.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
  return membership?.role ?? null;
}

export async function isWorkspaceMember(
  prisma: PrismaClient,
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const role = await resolveWorkspaceRole(prisma, userId, workspaceId);
  return role !== null;
}

export async function assertCanManageWorkspace(
  prisma: PrismaClient,
  userId: string,
  workspaceId: string,
): Promise<{ ok: true; role: string } | { ok: false }> {
  const role = await resolveWorkspaceRole(prisma, userId, workspaceId);
  if (!role || !MANAGE_ROLES.has(role)) return { ok: false };
  return { ok: true, role };
}

export type WorkspaceMemberProfile = {
  role: string;
  departmentId: string | null;
  profileFields: unknown;
};

/** Профиль сотрудника в контексте workspace. */
export async function getWorkspaceMemberProfile(
  prisma: PrismaClient,
  userId: string,
  workspaceId: string,
  ownerId: string,
): Promise<WorkspaceMemberProfile | null> {
  if (userId === ownerId) {
    const membership = await prisma.workspaceUser.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true, departmentId: true, profileFields: true },
    });
    if (membership) {
      return {
        role: membership.role || 'admin',
        departmentId: membership.departmentId,
        profileFields: membership.profileFields,
      };
    }
    return { role: 'admin', departmentId: null, profileFields: {} };
  }

  const membership = await prisma.workspaceUser.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true, departmentId: true, profileFields: true },
  });
  if (!membership) return null;
  return {
    role: membership.role,
    departmentId: membership.departmentId,
    profileFields: membership.profileFields,
  };
}

export async function getWorkspaceGroupIdsForUser(
  prisma: PrismaClient,
  userId: string,
  workspaceId: string,
): Promise<string[]> {
  const rows = await prisma.userGroup.findMany({
    where: { userId, group: { workspaceId } },
    select: { groupId: true },
  });
  return rows.map((r) => r.groupId);
}

export async function isAlreadyWorkspaceMember(
  prisma: PrismaClient,
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });
  if (!ws) return false;
  if (ws.ownerId === userId) return true;
  const m = await prisma.workspaceUser.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { id: true },
  });
  return !!m;
}
