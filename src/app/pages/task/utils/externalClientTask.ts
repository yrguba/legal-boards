import type { TaskRecord } from '../types';

/** Задача поступила извне (LEXPRO и др.), а не создана сотрудником в Legal Boards. */
export function isExternalClientTask(task: TaskRecord | null | undefined): boolean {
  return Boolean(task?.lexCreatorId ?? task?.lexClientProfile?.id);
}
