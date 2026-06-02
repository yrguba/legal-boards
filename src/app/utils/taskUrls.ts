/** Публичный ключ задачи: IT-19 */
export function formatTaskKey(boardCode: string, number: number): string {
  return `${boardCode}-${number}`;
}

export type TaskLinkSource = {
  id: string;
  key?: string | null;
  boardCode?: string | null;
  number?: number | null;
};

export function taskPath(task: TaskLinkSource): string {
  if (task.key) return `/task/${task.key}`;
  if (task.boardCode && task.number != null) {
    return `/task/${formatTaskKey(task.boardCode, task.number)}`;
  }
  return `/task/${task.id}`;
}

export function boardPath(board: { code: string }): string {
  return `/board/${board.code}`;
}

/** Cuid — legacy URL, после загрузки редиректим на key. */
export function isLegacyTaskIdRef(ref: string): boolean {
  return /^c[a-z0-9]{20,}$/i.test(ref) && !/^.+-\d+$/.test(ref);
}
