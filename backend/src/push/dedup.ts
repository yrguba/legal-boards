const recentKeys = new Map<string, number>();
/** Окно dedup: повтор той же категории + сущности одному user не уходит. */
const DEDUP_TTL_MS = 5000;

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

/** Dedup push одному user: категория настроек + id задачи/сущности. */
export function buildUserPushDedupKey(
  userId: string,
  category: string,
  entityId: string,
): string {
  return `user:${userId}:${category}:${entityId}`;
}

export function shouldSkipUserPushDedup(
  userId: string,
  category: string,
  entityId: string | undefined,
): boolean {
  if (!entityId) return false;
  return shouldSkipPushDedup(buildUserPushDedupKey(userId, category, entityId));
}
