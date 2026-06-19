import { PrismaClient } from '@prisma/client';
import { sendApnsToToken } from './apns';
import { sendFcmToToken } from './fcm';
import { isPushEnabled } from './config';
import { maskToken, pushLog, pushWarn } from './logger';
import type { PushMessagePayload } from './types';

const prisma = new PrismaClient();

export type PushSendStats = {
  ok: number;
  invalid: number;
  error: number;
  skipped: number;
  devices: number;
};

export async function sendPushToUsers(
  userIds: string[],
  payload: PushMessagePayload,
): Promise<PushSendStats> {
  const empty: PushSendStats = { ok: 0, invalid: 0, error: 0, skipped: 0, devices: 0 };
  if (!isPushEnabled() || userIds.length === 0) return empty;

  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const devices = await prisma.pushDevice.findMany({
    where: {
      userId: { in: uniqueUserIds },
      isActive: true,
    },
  });

  if (devices.length === 0) {
    pushLog('no active devices', {
      eventType: payload.eventType,
      userIds: uniqueUserIds.length,
    });
    return empty;
  }

  pushLog('send batch', {
    eventType: payload.eventType,
    title: payload.title,
    userIds: uniqueUserIds.length,
    devices: devices.length,
    route: payload.route,
  });

  const stats: PushSendStats = { ok: 0, invalid: 0, error: 0, skipped: 0, devices: devices.length };

  await Promise.all(
    devices.map(async (device) => {
      let result: 'ok' | 'invalid' | 'error' | 'skipped' = 'skipped';
      if (device.platform === 'android' && device.provider === 'fcm') {
        result = await sendFcmToToken(device.token, payload);
      } else if (device.platform === 'ios' && device.provider === 'apns') {
        result = await sendApnsToToken(device.token, payload);
      } else {
        pushWarn('unsupported device', {
          deviceId: device.id,
          platform: device.platform,
          provider: device.provider,
        });
        stats.skipped += 1;
        return;
      }

      if (result === 'invalid') {
        stats.invalid += 1;
        pushWarn('token invalid, deactivated', {
          userId: device.userId,
          platform: device.platform,
          token: maskToken(device.token),
        });
        await prisma.pushDevice.update({
          where: { id: device.id },
          data: { isActive: false },
        });
      } else if (result === 'ok') {
        stats.ok += 1;
        pushLog('sent', {
          userId: device.userId,
          platform: device.platform,
          provider: device.provider,
          token: maskToken(device.token),
          eventType: payload.eventType,
        });
        await prisma.pushDevice.update({
          where: { id: device.id },
          data: { lastSeenAt: new Date() },
        });
      } else {
        stats.error += 1;
        pushWarn('send failed', {
          userId: device.userId,
          platform: device.platform,
          provider: device.provider,
          token: maskToken(device.token),
          eventType: payload.eventType,
        });
      }
    }),
  );

  pushLog('batch done', {
    eventType: payload.eventType,
    ok: stats.ok,
    invalid: stats.invalid,
    error: stats.error,
    skipped: stats.skipped,
  });

  return stats;
}
