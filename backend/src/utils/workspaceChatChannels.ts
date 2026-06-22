import { PrismaClient } from '@prisma/client';
import type { UserDocAccess } from './documentAccess';

export const CHAT_SCOPE = {
  workspace: 'workspace',
  department: 'department',
  group: 'group',
  direct: 'direct',
} as const;

export function channelKeyWorkspace(workspaceId: string) {
  return `w:${workspaceId}`;
}

export function channelKeyDepartment(departmentId: string) {
  return `d:${departmentId}`;
}

export function channelKeyGroup(groupId: string) {
  return `g:${groupId}`;
}

export function channelKeyDirect(workspaceId: string, userIdA: string, userIdB: string) {
  const [a, b] = [userIdA, userIdB].sort();
  return `p:${workspaceId}:${a}:${b}`;
}

export function parseDirectUserIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

export function userIsDirectParticipant(userId: string, directUserIds: unknown): boolean {
  return parseDirectUserIds(directUserIds).includes(userId);
}

/** Создать отсутствующие каналы для пространства, всех отделов и групп (идемпотентно). */
export async function ensureChannelsForWorkspace(prisma: PrismaClient, workspaceId: string) {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws) return;

  await prisma.workspaceChatChannel.upsert({
    where: { channelKey: channelKeyWorkspace(workspaceId) },
    create: {
      channelKey: channelKeyWorkspace(workspaceId),
      workspaceId,
      scope: CHAT_SCOPE.workspace,
      title: `Общий чат: ${ws.name}`,
    },
    update: {},
  });

  const departments = await prisma.department.findMany({ where: { workspaceId } });
  for (const d of departments) {
    await prisma.workspaceChatChannel.upsert({
      where: { channelKey: channelKeyDepartment(d.id) },
      create: {
        channelKey: channelKeyDepartment(d.id),
        workspaceId,
        scope: CHAT_SCOPE.department,
        departmentId: d.id,
        title: `Отдел: ${d.name}`,
      },
      update: {},
    });
  }

  const groups = await prisma.group.findMany({ where: { workspaceId } });
  for (const g of groups) {
    await prisma.workspaceChatChannel.upsert({
      where: { channelKey: channelKeyGroup(g.id) },
      create: {
        channelKey: channelKeyGroup(g.id),
        workspaceId,
        scope: CHAT_SCOPE.group,
        groupId: g.id,
        title: `Группа: ${g.name}`,
      },
      update: {},
    });
  }
}

export async function ensureDirectChannel(
  prisma: PrismaClient,
  workspaceId: string,
  userIdA: string,
  userIdB: string,
) {
  const directUserIds = [userIdA, userIdB].sort();
  const channelKey = channelKeyDirect(workspaceId, userIdA, userIdB);

  const users = await prisma.user.findMany({
    where: { id: { in: directUserIds } },
    select: { id: true, name: true },
  });
  const nameA = users.find((u) => u.id === directUserIds[0])?.name ?? 'Участник';
  const nameB = users.find((u) => u.id === directUserIds[1])?.name ?? 'Участник';

  return prisma.workspaceChatChannel.upsert({
    where: { channelKey },
    create: {
      channelKey,
      workspaceId,
      scope: CHAT_SCOPE.direct,
      directUserIds,
      title: `${nameA} — ${nameB}`,
    },
    update: {
      directUserIds,
      title: `${nameA} — ${nameB}`,
    },
  });
}

export async function ensureChannelForNewDepartment(
  prisma: PrismaClient,
  workspaceId: string,
  departmentId: string,
  name: string
) {
  await prisma.workspaceChatChannel.upsert({
    where: { channelKey: channelKeyDepartment(departmentId) },
    create: {
      channelKey: channelKeyDepartment(departmentId),
      workspaceId,
      scope: CHAT_SCOPE.department,
      departmentId,
      title: `Отдел: ${name}`,
    },
    update: { title: `Отдел: ${name}` },
  });
}

export async function ensureChannelForNewGroup(
  prisma: PrismaClient,
  workspaceId: string,
  groupId: string,
  name: string
) {
  await prisma.workspaceChatChannel.upsert({
    where: { channelKey: channelKeyGroup(groupId) },
    create: {
      channelKey: channelKeyGroup(groupId),
      workspaceId,
      scope: CHAT_SCOPE.group,
      groupId,
      title: `Группа: ${name}`,
    },
    update: { title: `Группа: ${name}` },
  });
}

export async function ensureChannelForNewWorkspace(
  prisma: PrismaClient,
  workspaceId: string,
  name: string
) {
  await prisma.workspaceChatChannel.upsert({
    where: { channelKey: channelKeyWorkspace(workspaceId) },
    create: {
      channelKey: channelKeyWorkspace(workspaceId),
      workspaceId,
      scope: CHAT_SCOPE.workspace,
      title: `Общий чат: ${name}`,
    },
    update: { title: `Общий чат: ${name}` },
  });
}

export function userCanSeeChannel(
  access: UserDocAccess,
  channel: {
    scope: string;
    departmentId: string | null;
    groupId: string | null;
    directUserIds?: unknown;
  },
  userId?: string,
): boolean {
  if (channel.scope === CHAT_SCOPE.direct) {
    if (!userId) return false;
    return userIsDirectParticipant(userId, channel.directUserIds);
  }
  if (channel.scope === CHAT_SCOPE.workspace) {
    return true;
  }
  if (channel.scope === CHAT_SCOPE.department) {
    if (!channel.departmentId) return false;
    return access.departmentId === channel.departmentId;
  }
  if (channel.scope === CHAT_SCOPE.group) {
    if (!channel.groupId) return false;
    return access.groupIds.includes(channel.groupId);
  }
  return false;
}
