import type { Notification } from '../types';
import { isLawyerClientChannelMessage } from '../pages/task/utils/chatMessages';
import { isTaskFocused } from '../utils/activeTaskFocus';

function truncate(text: string, max = 120): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function taskRoute(taskId: string): string {
  return `/task/${taskId}`;
}

export type BrowserNotificationPayload = {
  title: string;
  body: string;
  tag?: string;
  route?: string;
};

export type BrowserNotificationContext = {
  currentUserId: string;
  currentWorkspaceId?: string;
  currentPathname: string;
};

export function resolveBrowserNotificationFromWs(
  data: Record<string, unknown>,
  ctx: BrowserNotificationContext,
): BrowserNotificationPayload | null {
  const { currentUserId, currentWorkspaceId, currentPathname } = ctx;
  const type = typeof data.type === 'string' ? data.type : '';

  if (type === 'notification') {
    const userId = typeof data.userId === 'string' ? data.userId : '';
    if (userId !== currentUserId) return null;

    const notification = data.notification as Notification | undefined;
    if (!notification) return null;

    let route: string | undefined;
    if (notification.relatedId) {
      if (
        notification.type === 'task_assigned' ||
        notification.type === 'comment' ||
        notification.type === 'status_change' ||
        notification.type === 'document' ||
        notification.type === 'mention'
      ) {
        route = taskRoute(notification.relatedId);
      } else if (notification.type === 'user_added') {
        route = '/';
      } else if (
        notification.type === 'conference_invite' ||
        notification.type === 'conference_updated'
      ) {
        route = `/conferences/${notification.relatedId}`;
      } else if (notification.type === 'conference_cancelled') {
        route = '/conferences';
      }
    }

    return {
      title: notification.title,
      body: notification.message,
      tag: `notification:${notification.id}`,
      route,
    };
  }

  if (type === 'chat_message') {
    const taskId = typeof data.taskId === 'string' ? data.taskId : '';
    if (!taskId || isTaskFocused(taskId)) return null;

    const authorUserId = typeof data.authorUserId === 'string' ? data.authorUserId : '';
    if (authorUserId && authorUserId === currentUserId) return null;

    const message = asRecord(data.message);
    if (!message || !isLawyerClientChannelMessage(message)) return null;

    const content = typeof message.content === 'string' ? message.content : 'Новое сообщение';
    const messageId = typeof message.id === 'string' ? message.id : undefined;
    const fromClient =
      String(message.type ?? '').trim().toLowerCase() === 'client' ||
      (typeof message.lexClientUserId === 'string' && message.lexClientUserId.length > 0);

    return {
      title: fromClient ? 'Сообщение от клиента' : 'Сообщение в задаче',
      body: truncate(content),
      tag: messageId ? `chat:${messageId}` : undefined,
      route: taskRoute(taskId),
    };
  }

  if (type === 'workspace_chat_message') {
    const authorUserId = typeof data.authorUserId === 'string' ? data.authorUserId : '';
    if (authorUserId === currentUserId) return null;

    const channelId = typeof data.channelId === 'string' ? data.channelId : '';
    if (!channelId) return null;

    const workspaceId = typeof data.workspaceId === 'string' ? data.workspaceId : '';
    if (currentWorkspaceId && workspaceId && workspaceId !== currentWorkspaceId) return null;

    const scope = typeof data.scope === 'string' ? data.scope : '';
    const message = asRecord(data.message);
    if (!message) return null;

    if (scope === 'direct') {
      const directUserIds = Array.isArray(data.directUserIds)
        ? data.directUserIds.filter((id): id is string => typeof id === 'string')
        : [];
      if (!directUserIds.includes(currentUserId)) return null;
    }

    if (
      currentPathname === `/chat/${channelId}` ||
      currentPathname === `/chat/${channelId}/`
    ) {
      return null;
    }

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
    const messageId = typeof message.id === 'string' ? message.id : undefined;

    const title =
      scope === 'direct'
        ? authorName
          ? `Сообщение от ${authorName}`
          : 'Личное сообщение'
        : 'Новое сообщение в чате';

    return {
      title,
      body: truncate(content),
      tag: messageId ? `workspace_chat:${messageId}` : undefined,
      route: `/chat/${channelId}`,
    };
  }

  if (type === 'task_approval_updated') {
    const taskId = typeof data.taskId === 'string' ? data.taskId : '';
    const approval = asRecord(data.approval);
    if (!taskId || !approval || isTaskFocused(taskId)) return null;

    const approvedBy =
      typeof approval.approvedByUserId === 'string' ? approval.approvedByUserId : '';
    if (approvedBy === currentUserId) return null;

    const ruleName = typeof approval.ruleName === 'string' ? approval.ruleName : 'Согласование';
    return {
      title: 'Согласование задачи',
      body: truncate(ruleName),
      tag: `approval:${taskId}:${approval.ruleId ?? ''}`,
      route: taskRoute(taskId),
    };
  }

  if (type === 'task_column_action_updated') {
    const taskId = typeof data.taskId === 'string' ? data.taskId : '';
    const completion = asRecord(data.completion);
    if (!taskId || !completion || isTaskFocused(taskId)) return null;

    const completedBy =
      typeof completion.completedByUserId === 'string' ? completion.completedByUserId : '';
    if (completedBy === currentUserId) return null;

    const ruleName = typeof completion.ruleName === 'string' ? completion.ruleName : 'Действие';
    return {
      title: 'Действие по задаче',
      body: truncate(ruleName),
      tag: `column_action:${taskId}:${completion.ruleId ?? ''}`,
      route: taskRoute(taskId),
    };
  }

  if (type === 'document_uploaded') {
    const workspaceId = typeof data.workspaceId === 'string' ? data.workspaceId : '';
    if (currentWorkspaceId && workspaceId && workspaceId !== currentWorkspaceId) return null;

    const document = asRecord(data.document);
    if (!document) return null;

    const uploadedBy = typeof document.uploadedBy === 'string' ? document.uploadedBy : '';
    if (uploadedBy === currentUserId) return null;

    const name = typeof document.name === 'string' ? document.name : 'Документ';
    const docId = typeof document.id === 'string' ? document.id : undefined;

    return {
      title: 'Новый документ',
      body: truncate(name),
      tag: docId ? `document:${docId}` : undefined,
      route: '/documents',
    };
  }

  return null;
}
