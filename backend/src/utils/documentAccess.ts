import { PrismaClient } from '@prisma/client';

export type UserDocAccess = {
  userId: string;
  departmentId: string | null;
  groupIds: string[];
};

/** Участник пространства или глобальный admin (с доступом к любому существующему workspace). */
export async function assertWorkspaceMember(
  prisma: PrismaClient,
  workspaceId: string,
  userId: string,
  userRole?: string
): Promise<boolean> {
  if (userRole === 'admin') {
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    return !!ws;
  }
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });
  if (!ws) {
    return false;
  }
  if (ws.ownerId === userId) {
    return true;
  }
  const m = await prisma.workspaceUser.findFirst({
    where: { workspaceId, userId },
  });
  return !!m;
}

export async function getUserDocumentAccess(
  prisma: PrismaClient,
  userId: string,
  workspaceId: string
): Promise<UserDocAccess> {
  const [user, groupRows] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.userGroup.findMany({
      where: { userId, group: { workspaceId } },
      select: { groupId: true },
    }),
  ]);
  return {
    userId,
    departmentId: user?.departmentId ?? null,
    groupIds: groupRows.map((r) => r.groupId),
  };
}

type VisibilityJson = {
  type?: string;
  departmentIds?: string[];
  groupIds?: string[];
  userIds?: string[];
};

function parseVis(raw: unknown): VisibilityJson {
  if (!raw || typeof raw !== 'object') return { type: 'workspace' };
  return raw as VisibilityJson;
}

/** Глобальные документы (записи Document). Вложения задач — в TaskAttachment, не здесь. */
export function canSeeDocument(
  visRaw: unknown,
  uploadedBy: string,
  access: UserDocAccess
): boolean {
  if (uploadedBy === access.userId) {
    return true;
  }
  const vis = parseVis(visRaw);
  const t = vis.type || 'workspace';

  if (t === 'task') {
    return false;
  }

  if (t === 'workspace') {
    return true;
  }

  if (t === 'department') {
    const ids = Array.isArray(vis.departmentIds) ? vis.departmentIds : [];
    if (!access.departmentId) return false;
    return ids.includes(access.departmentId);
  }

  if (t === 'group') {
    const ids = new Set(vis.groupIds || []);
    return access.groupIds.some((g) => ids.has(g));
  }

  if (t === 'custom') {
    const ids = vis.userIds || [];
    return ids.includes(access.userId);
  }

  return true;
}

type ValidateVis = {
  type?: string;
  departmentIds?: string[];
  groupIds?: string[];
  userIds?: string[];
};

export async function validateVisibilityPayload(
  prisma: PrismaClient,
  workspaceId: string,
  vis: ValidateVis
): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = vis.type || 'workspace';

  if (t === 'task') {
    return {
      ok: false,
      error: 'Вложения к задачам загружаются в карточке задачи, не в библиотеке',
    };
  }

  if (t === 'workspace') {
    return { ok: true };
  }

  if (t === 'department') {
    const ids = vis.departmentIds;
    if (!Array.isArray(ids) || ids.length === 0) {
      return { ok: false, error: 'Укажите хотя бы один отдел' };
    }
    const inWs = await prisma.department.findMany({
      where: { workspaceId, id: { in: ids } },
      select: { id: true },
    });
    if (inWs.length !== ids.length) {
      return { ok: false, error: 'Некорректные отделы' };
    }
    return { ok: true };
  }

  if (t === 'group') {
    const ids = vis.groupIds;
    if (!Array.isArray(ids) || ids.length === 0) {
      return { ok: false, error: 'Укажите хотя бы одну группу' };
    }
    const inWs = await prisma.group.findMany({
      where: { workspaceId, id: { in: ids } },
      select: { id: true },
    });
    if (inWs.length !== ids.length) {
      return { ok: false, error: 'Некорректные группы' };
    }
    return { ok: true };
  }

  if (t === 'custom') {
    const ids = vis.userIds;
    if (!Array.isArray(ids) || ids.length === 0) {
      return { ok: false, error: 'Укажите пользователей' };
    }
    return { ok: true };
  }

  return { ok: true };
}
