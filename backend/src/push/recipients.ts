import { PrismaClient } from '@prisma/client';
import { formatTaskKey } from '../utils/taskKeys';
import { canSeeDocument, getUserDocumentAccess } from '../utils/documentAccess';
import { getWorkspaceMemberIds } from '../utils/workspaceMembers';
import { CHAT_SCOPE, parseDirectUserIds, userCanSeeChannel } from '../utils/workspaceChatChannels';
import {
  getApprovalRulesForColumn,
  getApprovedRuleIdsForTask,
  parseBoardApprovalRules,
} from '../utils/boardApprovals';
import type { PushDispatchJob, PushMessagePayload } from './types';

const prisma = new PrismaClient();

function uniq(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

function exclude(ids: string[], excludeIds: string[] | undefined): string[] {
  if (!excludeIds?.length) return ids;
  const block = new Set(excludeIds);
  return ids.filter((id) => !block.has(id));
}

async function loadTaskContext(taskId: string) {
  return prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      number: true,
      title: true,
      assigneeId: true,
      createdBy: true,
      columnId: true,
      boardId: true,
      board: { select: { code: true, advancedSettings: true } },
    },
  });
}

async function taskStaffWatchers(taskId: string): Promise<string[]> {
  const task = await loadTaskContext(taskId);
  if (!task) return [];
  return uniq([task.assigneeId ?? '', task.createdBy ?? '']);
}

async function buildTaskRoute(taskId: string): Promise<string | undefined> {
  const task = await loadTaskContext(taskId);
  if (!task) return undefined;
  return `/task/${formatTaskKey(task.board.code, task.number)}`;
}

function truncate(text: string, max = 120): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

export async function resolvePushJobs(event: Record<string, unknown>): Promise<PushDispatchJob[]> {
  const type = typeof event.type === 'string' ? event.type : '';

  if (type === 'notification') {
    const userId = typeof event.userId === 'string' ? event.userId : '';
    const notification = asRecord(event.notification);
    if (!userId || !notification) return [];

    const title = typeof notification.title === 'string' ? notification.title : 'Уведомление';
    const body = typeof notification.message === 'string' ? notification.message : '';
    const eventTaskId = typeof event.taskId === 'string' ? event.taskId : undefined;
    const relatedId =
      (typeof notification.relatedId === 'string' ? notification.relatedId : undefined) ??
      eventTaskId;
    const notificationId = typeof notification.id === 'string' ? notification.id : '';
    const notificationType = typeof notification.type === 'string' ? notification.type : 'notification';

    const isTaskNotification =
      notificationType === 'task_assigned' ||
      notificationType === 'comment' ||
      notificationType === 'mention' ||
      notificationType === 'status_change' ||
      notificationType.includes('task');
    const taskUuid = isTaskNotification ? relatedId : undefined;

    let route: string | undefined;
    if (relatedId && (notificationType.includes('task') || notificationType === 'status_change' || notificationType === 'comment' || notificationType === 'mention')) {
      route = await buildTaskRoute(relatedId);
    } else if (relatedId && notificationType === 'document') {
      route = '/documents';
    } else if (relatedId && notificationType.startsWith('workspace')) {
      route = '/workspaces';
    } else if (relatedId && notificationType.startsWith('conference')) {
      route = `/conferences/${relatedId}`;
    }

    const payload: PushMessagePayload = {
      title,
      body,
      eventType: notificationType,
      route,
      relatedId: taskUuid ?? relatedId,
      taskId: taskUuid ?? eventTaskId,
    };

    return [{
      userIds: [userId],
      payload,
      dedupKey: notificationId ? `notification:${notificationId}:${userId}` : undefined,
    }];
  }

  if (type === 'chat_message') {
    const taskId = typeof event.taskId === 'string' ? event.taskId : '';
    if (!taskId) return [];

    const message = asRecord(event.message);
    if (message?.type === 'assistant') {
      return [];
    }
    const content = typeof message?.content === 'string' ? message.content : 'Новое сообщение';
    const authorUserId = typeof event.authorUserId === 'string' ? event.authorUserId : null;

    const task = await loadTaskContext(taskId);
    const route = await buildTaskRoute(taskId);
    const watchers = await taskStaffWatchers(taskId);
    const userIds = exclude(watchers, authorUserId ? [authorUserId] : undefined);
    if (userIds.length === 0) return [];

    return [{
      userIds,
      excludeUserIds: authorUserId ? [authorUserId] : undefined,
      payload: {
        title: task?.title ? `Сообщение: ${task.title}` : 'Новое сообщение',
        body: truncate(content),
        eventType: 'chat_message',
        route,
        taskId,
        relatedId: taskId,
      },
      dedupKey: typeof message?.id === 'string' ? `chat:${message.id}` : undefined,
    }];
  }

  if (type === 'workspace_chat_message') {
    const channelId = typeof event.channelId === 'string' ? event.channelId : '';
    const workspaceId = typeof event.workspaceId === 'string' ? event.workspaceId : '';
    const authorUserId = typeof event.authorUserId === 'string' ? event.authorUserId : '';
    const scope = typeof event.scope === 'string' ? event.scope : '';
    const message = asRecord(event.message);
    if (!channelId || !workspaceId || !message) return [];

    const attachments = message.attachments;
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
    const content =
      typeof message.content === 'string' && message.content.trim()
        ? message.content.trim()
        : hasAttachments
          ? 'Вложение'
          : 'Новое сообщение';

    const author = asRecord(message.user);
    const authorName = typeof author?.name === 'string' ? author.name : undefined;

    let recipientIds: string[] = [];

    if (scope === CHAT_SCOPE.direct) {
      const directUserIds = Array.isArray(event.directUserIds)
        ? parseDirectUserIds(event.directUserIds)
        : [];
      recipientIds = directUserIds.filter((id) => id !== authorUserId);
    } else {
      const channel = await prisma.workspaceChatChannel.findUnique({
        where: { id: channelId },
      });
      if (!channel) return [];

      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { ownerId: true },
      });

      const memberIds = await getWorkspaceMemberIds(prisma, workspaceId);
      memberIds.delete(authorUserId);

      for (const userId of memberIds) {
        if (workspace?.ownerId === userId) {
          recipientIds.push(userId);
          continue;
        }
        const access = await getUserDocumentAccess(prisma, userId, workspaceId);
        if (userCanSeeChannel(access, channel, userId)) {
          recipientIds.push(userId);
        }
      }
    }

    recipientIds = exclude(recipientIds, authorUserId ? [authorUserId] : undefined);
    if (recipientIds.length === 0) return [];

    const channelTitle =
      scope === CHAT_SCOPE.direct
        ? undefined
        : (
            await prisma.workspaceChatChannel.findUnique({
              where: { id: channelId },
              select: { title: true },
            })
          )?.title;

    const title =
      scope === CHAT_SCOPE.direct
        ? authorName
          ? `Сообщение от ${authorName}`
          : 'Личное сообщение'
        : channelTitle || 'Новое сообщение в чате';

    return [{
      userIds: recipientIds,
      excludeUserIds: authorUserId ? [authorUserId] : undefined,
      payload: {
        title,
        body: truncate(content),
        eventType: 'workspace_chat_message',
        route: `/chat/${channelId}`,
        relatedId: channelId,
      },
      dedupKey: typeof message.id === 'string' ? `workspace_chat:${message.id}` : undefined,
    }];
  }

  if (type === 'task_status_history') {
    // Push не нужен: staff уже получает status_change; WS-событие — для LEXPRO.
    return [];
  }

  if (type === 'task_conclusion_updated') {
    const taskId = typeof event.taskId === 'string' ? event.taskId : '';
    if (!taskId) return [];

    const task = await loadTaskContext(taskId);
    const userIds = uniq([task?.assigneeId ?? '', task?.createdBy ?? '']);
    if (userIds.length === 0) return [];

    const route = await buildTaskRoute(taskId);
    return [{
      userIds,
      payload: {
        title: 'Заключение обновлено',
        body: task?.title ? `Задача «${task.title}»` : 'Обновлено заключение по задаче',
        eventType: 'task_conclusion_updated',
        route,
        taskId,
        relatedId: taskId,
      },
      dedupKey: `task_conclusion:${taskId}`,
    }];
  }

  if (type === 'task_approval_updated') {
    const taskId = typeof event.taskId === 'string' ? event.taskId : '';
    const approval = asRecord(event.approval);
    if (!taskId || !approval) return [];

    const approvedBy =
      typeof approval.approvedByUserId === 'string' ? approval.approvedByUserId : undefined;

    const task = await loadTaskContext(taskId);
    if (!task) return [];

    const rules = getApprovalRulesForColumn(
      parseBoardApprovalRules(task.board.advancedSettings ?? {}),
      task.columnId,
    );
    const approved = await getApprovedRuleIdsForTask(prisma, taskId, task.columnId);
    const pendingApprovers = rules
      .filter((r) => !approved.has(r.id))
      .flatMap((r) => [r.approverUserId, ...r.substituteUserIds]);

    const userIds = exclude(
      uniq([...pendingApprovers, task.assigneeId ?? '']),
      approvedBy ? [approvedBy] : undefined,
    );
    if (userIds.length === 0) return [];

    const route = await buildTaskRoute(taskId);
    const ruleName = typeof approval.ruleName === 'string' ? approval.ruleName : 'Согласование';

    return [{
      userIds,
      payload: {
        title: 'Согласование задачи',
        body: truncate(`${ruleName}: ${task.title}`),
        eventType: 'task_approval_updated',
        route,
        taskId,
        relatedId: taskId,
      },
      dedupKey: `approval:${taskId}:${approval.ruleId ?? ''}:${approval.status ?? ''}`,
    }];
  }

  if (type === 'task_column_action_updated') {
    const taskId = typeof event.taskId === 'string' ? event.taskId : '';
    const completion = asRecord(event.completion);
    if (!taskId || !completion) return [];

    const completedBy =
      typeof completion.completedByUserId === 'string' ? completion.completedByUserId : undefined;

    const task = await loadTaskContext(taskId);
    const userIds = exclude(uniq([task?.assigneeId ?? '']), completedBy ? [completedBy] : undefined);
    if (userIds.length === 0) return [];

    const route = await buildTaskRoute(taskId);
    const ruleName = typeof completion.ruleName === 'string' ? completion.ruleName : 'Действие';

    return [{
      userIds,
      payload: {
        title: 'Действие по задаче',
        body: truncate(`${ruleName}: ${task?.title ?? 'Задача'}`),
        eventType: 'task_column_action_updated',
        route,
        taskId,
        relatedId: taskId,
      },
      dedupKey: `column_action:${taskId}:${completion.ruleId ?? ''}`,
    }];
  }

  if (type === 'document_uploaded') {
    const workspaceId = typeof event.workspaceId === 'string' ? event.workspaceId : '';
    const document = asRecord(event.document);
    if (!workspaceId || !document) return [];

    const uploadedBy = typeof document.uploadedBy === 'string' ? document.uploadedBy : '';
    const name = typeof document.name === 'string' ? document.name : 'Документ';
    const visibility = document.visibility;

    const memberIds = await getWorkspaceMemberIds(prisma, workspaceId);
    memberIds.delete(uploadedBy);

    const recipients: string[] = [];
    for (const userId of memberIds) {
      const access = await getUserDocumentAccess(prisma, userId, workspaceId);
      if (canSeeDocument(visibility, uploadedBy, access)) {
        recipients.push(userId);
      }
    }

    if (recipients.length === 0) return [];

    const docId = typeof document.id === 'string' ? document.id : undefined;
    return [{
      userIds: recipients,
      payload: {
        title: 'Новый документ',
        body: truncate(name),
        eventType: 'document_uploaded',
        route: '/documents',
        relatedId: docId,
      },
      dedupKey: docId ? `document:${docId}` : undefined,
    }];
  }

  return [];
}
