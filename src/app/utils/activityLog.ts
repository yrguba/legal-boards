export type TaskActivityItem = {
  id: string;
  eventType: string;
  occurredAt: string;
  source: string;
  payload: Record<string, unknown>;
  snapshot: Record<string, unknown> | null;
  actor: { id: string; name: string; email?: string; avatar?: string | null } | null;
  summary: string;
};

export function activityEventIconKind(eventType: string): 'status' | 'user' | 'approval' | 'action' | 'legacy' {
  if (eventType === 'task.column_changed' || eventType === 'legacy.status_event') return 'status';
  if (eventType === 'task.assignee_changed') return 'user';
  if (eventType === 'task.priority_changed') return 'status';
  if (eventType === 'task.approval_decided') return 'approval';
  if (eventType === 'task.column_action_completed') return 'action';
  return 'legacy';
}

export function activityEventLabel(eventType: string): string {
  switch (eventType) {
    case 'task.column_changed':
      return 'Статус';
    case 'task.assignee_changed':
      return 'Исполнитель';
    case 'task.priority_changed':
      return 'Приоритет';
    case 'task.approval_decided':
      return 'Согласование';
    case 'task.column_action_completed':
      return 'Действие';
    case 'legacy.status_event':
      return 'История';
    default:
      return 'Событие';
  }
}
