import type { PushMessagePayload } from './types';

export function resolvePushTaskId(payload: PushMessagePayload): string | undefined {
  const id = payload.relatedId ?? payload.taskId;
  return typeof id === 'string' && id.trim() ? id.trim() : undefined;
}

/** Custom data для APNS/FCM: type, relatedId, taskId (UUID задачи). */
export function buildPushCustomData(payload: PushMessagePayload): Record<string, string> {
  const data: Record<string, string> = {
    type: payload.eventType,
  };

  const taskId = resolvePushTaskId(payload);
  if (taskId) {
    data.relatedId = taskId;
    data.taskId = taskId;
  }

  if (payload.route) data.route = payload.route;
  return data;
}

export function buildApnsRawPayload(payload: PushMessagePayload): Record<string, unknown> {
  return {
    aps: {
      alert: {
        title: payload.title,
        body: payload.body,
      },
      sound: 'default',
    },
    ...buildPushCustomData(payload),
  };
}
