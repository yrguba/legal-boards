/** UUID задачи, открытой на странице /task/… (для подавления дублирующих уведомлений). */
let activeTaskId: string | null = null;

export function setActiveTaskFocus(taskId: string | null): void {
  activeTaskId = taskId;
}

export function isTaskFocused(taskId: string): boolean {
  return activeTaskId === taskId;
}
