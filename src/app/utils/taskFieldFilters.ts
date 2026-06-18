import type { TaskField } from '../types';

/** Кастомное поле «Приоритет» заменено системным Task.priority */
export function isLegacyPriorityTaskField(field: { name?: string }): boolean {
  return String(field.name ?? '').trim().toLowerCase() === 'приоритет';
}

export function withoutLegacyPriorityFields(fields: TaskField[]): TaskField[] {
  return fields.filter((f) => !isLegacyPriorityTaskField(f));
}
