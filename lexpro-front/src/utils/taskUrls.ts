export function taskPath(task: { id: string; key?: string | null; boardCode?: string | null; number?: number | null }): string {
  if (task.key) return `/r/${task.key}`;
  if (task.boardCode && task.number != null) return `/r/${task.boardCode}-${task.number}`;
  return `/r/${task.id}`;
}

export function taskDisplayRef(task: { key?: string | null; id: string; createdAt: string }): string {
  if (task.key) return task.key;
  const d = new Date(task.createdAt);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const suf = task.id.replace(/-/g, '').slice(-6).toUpperCase();
  return `${y}-${m}-${day}-${suf}`;
}
