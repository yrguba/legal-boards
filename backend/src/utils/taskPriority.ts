export const TASK_PRIORITY_KEYS = [
  'trivial',
  'low',
  'medium',
  'high',
  'critical',
] as const;

export type TaskPriorityKey = (typeof TASK_PRIORITY_KEYS)[number];

export const DEFAULT_TASK_PRIORITY: TaskPriorityKey = 'medium';

export const TASK_PRIORITY_LABELS: Record<TaskPriorityKey, string> = {
  trivial: 'Незначительный',
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критичный',
};

const PRIORITY_KEY_SET = new Set<string>(TASK_PRIORITY_KEYS);

const LEGACY_TO_KEY: Record<string, TaskPriorityKey> = {
  Незначительный: 'trivial',
  Низкий: 'low',
  Средний: 'medium',
  Высокий: 'high',
  Критичный: 'critical',
  Критический: 'critical',
  trivial: 'trivial',
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'critical',
  Trivial: 'trivial',
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  Critical: 'critical',
};

export function isValidTaskPriorityKey(value: string): value is TaskPriorityKey {
  return PRIORITY_KEY_SET.has(value);
}

export function taskPriorityLabel(key: string | null | undefined): string {
  if (key && isValidTaskPriorityKey(key)) return TASK_PRIORITY_LABELS[key];
  if (key && key in LEGACY_TO_KEY) return TASK_PRIORITY_LABELS[LEGACY_TO_KEY[key]];
  return TASK_PRIORITY_LABELS[DEFAULT_TASK_PRIORITY];
}

export function normalizeLegacyPriority(raw: unknown): TaskPriorityKey | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (isValidTaskPriorityKey(trimmed)) return trimmed;
  return LEGACY_TO_KEY[trimmed] ?? null;
}

export function parseIncomingPriority(raw: unknown): TaskPriorityKey {
  if (typeof raw !== 'string') return DEFAULT_TASK_PRIORITY;
  const trimmed = raw.trim();
  if (isValidTaskPriorityKey(trimmed)) return trimmed;
  return normalizeLegacyPriority(trimmed) ?? DEFAULT_TASK_PRIORITY;
}

export function taskPriorityValidationError(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return 'Некорректный приоритет';
  const trimmed = raw.trim();
  if (!trimmed) return 'Укажите приоритет';
  if (!isValidTaskPriorityKey(trimmed) && !normalizeLegacyPriority(trimmed)) {
    return `Приоритет должен быть одним из: ${TASK_PRIORITY_KEYS.join(', ')}`;
  }
  return null;
}

/** @deprecated use TASK_PRIORITY_KEYS */
export const TASK_PRIORITIES = TASK_PRIORITY_KEYS;
/** @deprecated use TaskPriorityKey */
export type TaskPriority = TaskPriorityKey;
export function isValidTaskPriority(value: string): value is TaskPriorityKey {
  return isValidTaskPriorityKey(value);
}
