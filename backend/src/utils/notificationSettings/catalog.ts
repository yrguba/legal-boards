export type NotificationSettingGroupId = 'tasks' | 'documents' | 'workspace' | 'conferences';

export type NotificationSettingDefinition = {
  key: string;
  label: string;
  description: string;
  group: NotificationSettingGroupId;
  defaultEnabled: boolean;
};

export const NOTIFICATION_SETTING_GROUPS: { id: NotificationSettingGroupId; label: string }[] = [
  { id: 'tasks', label: 'Задачи' },
  { id: 'documents', label: 'Документы' },
  { id: 'workspace', label: 'Рабочее пространство' },
  { id: 'conferences', label: 'Конференции' },
];

export const NOTIFICATION_SETTINGS_CATALOG: NotificationSettingDefinition[] = [
  {
    key: 'task_assigned',
    label: 'Новые задачи',
    description: 'Уведомления при назначении новой задачи',
    group: 'tasks',
    defaultEnabled: true,
  },
  {
    key: 'task_comments',
    label: 'Комментарии',
    description: 'Комментарии и сообщения в чате задачи',
    group: 'tasks',
    defaultEnabled: true,
  },
  {
    key: 'task_status',
    label: 'Изменения статуса',
    description: 'Изменение статуса или колонки задачи',
    group: 'tasks',
    defaultEnabled: true,
  },
  {
    key: 'task_conclusion',
    label: 'Заключения',
    description: 'Обновление заключения по задаче',
    group: 'tasks',
    defaultEnabled: true,
  },
  {
    key: 'task_approval',
    label: 'Согласования',
    description: 'Решения и ожидание согласования задачи',
    group: 'tasks',
    defaultEnabled: true,
  },
  {
    key: 'task_column_action',
    label: 'Действия по задаче',
    description: 'Выполнение действий колонки доски',
    group: 'tasks',
    defaultEnabled: true,
  },
  {
    key: 'document_uploaded',
    label: 'Новые документы',
    description: 'Загрузка новых документов в пространство',
    group: 'documents',
    defaultEnabled: true,
  },
  {
    key: 'workspace_chat',
    label: 'Чаты пространства',
    description: 'Сообщения в каналах и личных чатах',
    group: 'workspace',
    defaultEnabled: true,
  },
  {
    key: 'workspace',
    label: 'Пространство',
    description: 'Приглашения, принятие и исключение из пространства',
    group: 'workspace',
    defaultEnabled: true,
  },
  {
    key: 'conferences',
    label: 'Конференции',
    description: 'Приглашения и изменения запланированных конференций',
    group: 'conferences',
    defaultEnabled: true,
  },
];

const VALID_KEYS = new Set(NOTIFICATION_SETTINGS_CATALOG.map((s) => s.key));

const EVENT_TYPE_TO_SETTING_KEY: Record<string, string | null> = {
  task_assigned: 'task_assigned',
  comment: 'task_comments',
  mention: 'task_comments',
  chat_message: 'task_comments',
  workspace_chat_message: 'workspace_chat',
  status_change: 'task_status',
  task_status_history: 'task_status',
  task_conclusion_updated: 'task_conclusion',
  task_approval_updated: 'task_approval',
  task_column_action_updated: 'task_column_action',
  document_uploaded: 'document_uploaded',
  workspace_invite: 'workspace',
  workspace_invite_accepted: 'workspace',
  workspace_invite_declined: 'workspace',
  workspace_member_removed: 'workspace',
  user_added: 'workspace',
  conference_invite: 'conferences',
  conference_cancelled: 'conferences',
  conference_updated: 'conferences',
  test: null,
};

export function isValidNotificationSettingKey(key: string): boolean {
  return VALID_KEYS.has(key);
}

export function getNotificationSettingDefinition(
  key: string,
): NotificationSettingDefinition | undefined {
  return NOTIFICATION_SETTINGS_CATALOG.find((s) => s.key === key);
}

export function eventTypeToNotificationSettingKey(eventType: string): string | null {
  return EVENT_TYPE_TO_SETTING_KEY[eventType] ?? null;
}

export function buildDefaultNotificationSettings(): Record<string, boolean> {
  return Object.fromEntries(NOTIFICATION_SETTINGS_CATALOG.map((s) => [s.key, s.defaultEnabled]));
}
