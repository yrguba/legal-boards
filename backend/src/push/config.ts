import { resolveBackendPath } from './paths';

function parseEnvFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return defaultValue;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function isPushEnabled(): boolean {
  return parseEnvFlag('PUSH_ENABLED', false);
}

/** Отправка push на мобильные устройства (iOS/Android). Требует PUSH_ENABLED=true. */
export function isPushMobileEnabled(): boolean {
  return isPushEnabled() && parseEnvFlag('PUSH_MOBILE_ENABLED', true);
}

export function isPushAndroidEnabled(): boolean {
  return isPushMobileEnabled() && parseEnvFlag('PUSH_ANDROID_ENABLED', true);
}

export function isPushIosEnabled(): boolean {
  return isPushMobileEnabled() && parseEnvFlag('PUSH_IOS_ENABLED', true);
}

export function getApnsConfig() {
  return {
    keyId: process.env.APNS_KEY_ID?.trim() ?? '',
    teamId: process.env.APNS_TEAM_ID?.trim() ?? '',
    bundleId: process.env.APNS_BUNDLE_ID?.trim() ?? '',
    keyPath: resolveBackendPath(process.env.APNS_KEY_PATH?.trim() ?? ''),
    production: parseEnvFlag('APNS_PRODUCTION', false),
  };
}

export function isApnsConfigured(): boolean {
  const c = getApnsConfig();
  return Boolean(c.keyId && c.teamId && c.bundleId && c.keyPath);
}

export function isFcmConfigured(): boolean {
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  return Boolean(path || json);
}
