import { isPushEnabled } from './config';
import { shouldSkipPushDedup } from './dedup';
import { pushLog } from './logger';
import { resolvePushJobs } from './recipients';
import { sendPushToUsers } from './sender';

export function dispatchPushFromRealtimeEvent(data: unknown): void {
  if (!isPushEnabled()) return;
  if (!data || typeof data !== 'object') return;

  const eventType =
    typeof (data as Record<string, unknown>).type === 'string'
      ? (data as Record<string, unknown>).type
      : 'unknown';

  void (async () => {
    try {
      const jobs = await resolvePushJobs(data as Record<string, unknown>);
      if (jobs.length === 0) {
        pushLog('no recipients', { eventType });
        return;
      }

      pushLog('dispatch', { eventType, jobs: jobs.length });

      for (const job of jobs) {
        const userIds = job.excludeUserIds?.length
          ? job.userIds.filter((id) => !job.excludeUserIds!.includes(id))
          : job.userIds;
        if (userIds.length === 0) {
          pushLog('skip empty recipients', {
            eventType: job.payload.eventType,
            dedupKey: job.dedupKey,
          });
          continue;
        }
        if (shouldSkipPushDedup(job.dedupKey)) {
          pushLog('skip dedup', {
            eventType: job.payload.eventType,
            dedupKey: job.dedupKey,
            userIds: userIds.length,
          });
          continue;
        }

        await sendPushToUsers(userIds, job.payload);
      }
    } catch (error) {
      console.error('[push] dispatch error:', error);
    }
  })();
}
