import fs from 'fs';
import apn from '@parse/node-apn';
import { getApnsConfig, isApnsConfigured, isPushIosEnabled } from './config';
import { pushLog, pushWarn } from './logger';
import { buildApnsRawPayload, buildPushCustomData } from './payload';
import type { PushMessagePayload } from './types';

let provider: apn.Provider | null | undefined;

function getProvider(): apn.Provider | null {
  if (provider !== undefined) return provider;
  if (!isApnsConfigured()) {
    console.warn('[push/apns] APNS не настроен (APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_KEY_PATH)');
    provider = null;
    return null;
  }

  const cfg = getApnsConfig();
  if (!fs.existsSync(cfg.keyPath)) {
    console.error(
      '[push/apns] Файл ключа APNS не найден:',
      cfg.keyPath,
      `(process.cwd=${process.cwd()})`,
    );
    provider = null;
    return null;
  }

  try {
    provider = new apn.Provider({
      token: {
        key: cfg.keyPath,
        keyId: cfg.keyId,
        teamId: cfg.teamId,
      },
      production: cfg.production,
    });
    pushLog('apns provider ready', {
      keyId: cfg.keyId,
      teamId: cfg.teamId,
      bundleId: cfg.bundleId,
      production: cfg.production,
      keyPath: cfg.keyPath,
    });
    return provider;
  } catch (error) {
    console.error('[push/apns] Ошибка инициализации APNS:', error);
    provider = null;
    return null;
  }
}

export async function sendApnsToToken(
  token: string,
  payload: PushMessagePayload,
): Promise<'ok' | 'invalid' | 'error'> {
  if (!isPushIosEnabled()) return 'error';

  const apnsProvider = getProvider();
  if (!apnsProvider) return 'error';

  const cfg = getApnsConfig();
  const note = new apn.Notification();
  note.topic = cfg.bundleId;
  note.rawPayload = buildApnsRawPayload(payload);

  const custom = buildPushCustomData(payload);
  pushLog('apns custom data', {
    eventType: payload.eventType,
    type: custom.type,
    relatedId: custom.relatedId,
    taskId: custom.taskId,
  });

  try {
    const result = await apnsProvider.send(note, token);
    const failed = result.failed?.[0];
    if (failed) {
      const reason = failed.response?.reason ?? failed.status ?? 'unknown';
      if (
        reason === 'BadDeviceToken' ||
        reason === 'Unregistered' ||
        reason === 'DeviceTokenNotForTopic'
      ) {
        return 'invalid';
      }
      if (reason === 'InvalidProviderToken') {
        pushWarn('apns failed — Apple отклонил JWT ключа сервера', {
          reason,
          status: failed.status,
          hint:
            'Проверьте APNS_KEY_ID и APNS_TEAM_ID в developer.apple.com; .p8 должен соответствовать Key ID; для сборки из Xcode — APNS_PRODUCTION=false',
          keyPath: cfg.keyPath,
          production: cfg.production,
        });
      } else {
        pushWarn('apns failed', { reason, status: failed.status });
      }
      return 'error';
    }
    return 'ok';
  } catch (error) {
    pushWarn('apns exception', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 'error';
  }
}

export function shutdownApns(): void {
  if (provider) {
    provider.shutdown();
    provider = null;
  }
}
