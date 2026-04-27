import { PrismaClient } from '@prisma/client';
import type { UserDocAccess } from './documentAccess';

export const CHAT_SCOPE = {
  workspace: 'workspace',
  department: 'department',
  group: 'group',
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
  channel: { scope: string; departmentId: string | null; groupId: string | null }
): boolean {
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
