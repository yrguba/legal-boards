/** Соответствие типов событий ключам настроек (см. backend notificationSettings/catalog). */
const WS_EVENT_TO_SETTING_KEY: Record<string, string> = {
  chat_message: 'task_comments',
  workspace_chat_message: 'workspace_chat',
  task_approval_updated: 'task_approval',
  task_column_action_updated: 'task_column_action',
  document_uploaded: 'document_uploaded',
  task_conclusion_updated: 'task_conclusion',
  task_status_history: 'task_status',
};

const NOTIFICATION_TYPE_TO_SETTING_KEY: Record<string, string> = {
  task_assigned: 'task_assigned',
  comment: 'task_comments',
  mention: 'task_comments',
  status_change: 'task_status',
  document: 'document_uploaded',
  user_added: 'workspace',
  conference_invite: 'conferences',
  conference_updated: 'conferences',
  conference_cancelled: 'conferences',
};

export function resolveNotificationSettingKey(
  wsEventType: string,
  notificationType?: string,
): string | null {
  if (wsEventType === 'notification' && notificationType) {
    return NOTIFICATION_TYPE_TO_SETTING_KEY[notificationType] ?? null;
  }
  return WS_EVENT_TO_SETTING_KEY[wsEventType] ?? null;
}
