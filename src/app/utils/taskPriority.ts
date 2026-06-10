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

const LEGACY_TO_KEY: Record<string, TaskPriorityKey> = {
  Незначительный: 'trivial',
  Низкий: 'low',
  Средний: 'medium',
  Высокий: 'high',
  Критичный: 'critical',
  Критический: 'critical',
};

const PRIORITY_WEIGHT: Record<TaskPriorityKey, number> = {
  trivial: 1,
  low: 2,
  medium: 3,
  high: 4,
  critical: 5,
};

type PriorityStyle = {
  bg: string;
  text: string;
  border: string;
};

const PRIORITY_STYLES: Record<TaskPriorityKey, PriorityStyle> = {
  trivial: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  low: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  high: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
  critical: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
};

export function normalizeTaskPriority(
  priority: string | undefined | null,
): TaskPriorityKey {
  if (!priority) return DEFAULT_TASK_PRIORITY;
  const trimmed = priority.trim();
  if ((TASK_PRIORITY_KEYS as readonly string[]).includes(trimmed)) {
    return trimmed as TaskPriorityKey;
  }
  return LEGACY_TO_KEY[trimmed] ?? DEFAULT_TASK_PRIORITY;
}

export function taskPriorityLabel(priority: string | undefined | null): string {
  return TASK_PRIORITY_LABELS[normalizeTaskPriority(priority)];
}

export function priorityWeight(priority: string | undefined | null): number {
  return PRIORITY_WEIGHT[normalizeTaskPriority(priority)];
}

export function priorityStyle(priority: string | undefined | null): PriorityStyle {
  return PRIORITY_STYLES[normalizeTaskPriority(priority)];
}

/** @deprecated use TASK_PRIORITY_KEYS */
export const TASK_PRIORITIES = TASK_PRIORITY_KEYS;
/** @deprecated use TaskPriorityKey */
export type TaskPriority = TaskPriorityKey;
