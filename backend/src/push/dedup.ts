const recentKeys = new Map<string, number>();
const DEDUP_TTL_MS = 3000;

export function shouldSkipPushDedup(key: string | undefined): boolean {
  if (!key) return false;
  const now = Date.now();
  for (const [k, expiresAt] of recentKeys) {
    if (expiresAt <= now) recentKeys.delete(k);
  }
  const existing = recentKeys.get(key);
  if (existing && existing > now) return true;
  recentKeys.set(key, now + DEDUP_TTL_MS);
  return false;
}

export function markNotificationPushSent(userId: string, notificationId: string): void {
  recentKeys.set(`notification:${userId}:${notificationId}`, Date.now() + DEDUP_TTL_MS);
}

export function markTaskStatusNotification(taskId: string, userId: string): void {
  recentKeys.set(`status_task:${taskId}:${userId}`, Date.now() + DEDUP_TTL_MS);
}

export function wasRecentTaskStatusNotification(taskId: string, userId: string): boolean {
  const key = `status_task:${taskId}:${userId}`;
  const expiresAt = recentKeys.get(key);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    recentKeys.delete(key);
    return false;
  }
  return true;
}
