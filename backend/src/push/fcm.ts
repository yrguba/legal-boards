import fs from 'fs';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { ServiceAccount } from 'firebase-admin/app';
import { isFcmConfigured, isPushAndroidEnabled } from './config';
import { pushWarn } from './logger';
import type { PushMessagePayload } from './types';

function initFirebase(): App | null {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }
  if (!isFcmConfigured()) {
    console.warn('[push/fcm] Firebase не настроен (FIREBASE_SERVICE_ACCOUNT_PATH или FIREBASE_SERVICE_ACCOUNT_JSON)');
    return null;
  }

  const jsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();

  try {
    const serviceAccount = jsonRaw
      ? (JSON.parse(jsonRaw) as ServiceAccount)
      : (JSON.parse(fs.readFileSync(path!, 'utf8')) as ServiceAccount);

    return initializeApp({
      credential: cert(serviceAccount),
    });
  } catch (error) {
    console.error('[push/fcm] Ошибка инициализации Firebase:', error);
    return null;
  }
}

function dataPayload(payload: PushMessagePayload): Record<string, string> {
  const data: Record<string, string> = {
    eventType: payload.eventType,
  };
  if (payload.route) data.route = payload.route;
  if (payload.relatedId) data.relatedId = payload.relatedId;
  if (payload.taskId) data.taskId = payload.taskId;
  return data;
}

export async function sendFcmToToken(
  token: string,
  payload: PushMessagePayload,
): Promise<'ok' | 'invalid' | 'error'> {
  if (!isPushAndroidEnabled()) return 'error';

  const app = initFirebase();
  if (!app) return 'error';

  try {
    await getMessaging(app).send({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: dataPayload(payload),
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
        },
      },
    });
    return 'ok';
  } catch (error: unknown) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: string }).code)
        : '';
    if (
      code.includes('registration-token-not-registered') ||
      code.includes('invalid-registration-token')
    ) {
      return 'invalid';
    }
    pushWarn('fcm error', { code: code || 'unknown' });
    return 'error';
  }
}
