import { PrismaClient } from '@prisma/client';
import {
  buildDefaultNotificationSettings,
  eventTypeToNotificationSettingKey,
  getNotificationSettingDefinition,
  isValidNotificationSettingKey,
  NOTIFICATION_SETTING_GROUPS,
  NOTIFICATION_SETTINGS_CATALOG,
  type NotificationSettingDefinition,
} from './catalog';

const prisma = new PrismaClient();

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { expiresAt: number; settings: Record<string, boolean> }>();

export type NotificationSettingItem = NotificationSettingDefinition & { enabled: boolean };

export function invalidateNotificationPreferencesCache(userId: string): void {
  cache.delete(userId);
}

async function loadUserSettingsMap(userId: string): Promise<Record<string, boolean>> {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.settings;
  }

  const defaults = buildDefaultNotificationSettings();
  const rows = await prisma.notificationPreference.findMany({
    where: { userId },
    select: { key: true, enabled: true },
  });

  for (const row of rows) {
    if (isValidNotificationSettingKey(row.key)) {
      defaults[row.key] = row.enabled;
    }
  }

  cache.set(userId, { settings: defaults, expiresAt: Date.now() + CACHE_TTL_MS });
  return defaults;
}

export async function isNotificationEnabledForUser(
  userId: string,
  eventType: string,
): Promise<boolean> {
  const settingKey = eventTypeToNotificationSettingKey(eventType);
  if (!settingKey) return true;

  const def = getNotificationSettingDefinition(settingKey);
  if (!def) return true;

  const map = await loadUserSettingsMap(userId);
  return map[settingKey] ?? def.defaultEnabled;
}

export async function getUserNotificationSettingsResponse(userId: string): Promise<{
  settings: NotificationSettingItem[];
  groups: typeof NOTIFICATION_SETTING_GROUPS;
}> {
  const map = await loadUserSettingsMap(userId);
  return {
    groups: NOTIFICATION_SETTING_GROUPS,
    settings: NOTIFICATION_SETTINGS_CATALOG.map((def) => ({
      ...def,
      enabled: map[def.key] ?? def.defaultEnabled,
    })),
  };
}

export async function updateUserNotificationSettings(
  userId: string,
  patch: Record<string, boolean>,
): Promise<{ settings: NotificationSettingItem[]; groups: typeof NOTIFICATION_SETTING_GROUPS }> {
  const unknown = Object.keys(patch).filter((key) => !isValidNotificationSettingKey(key));
  if (unknown.length > 0) {
    throw new NotificationSettingsValidationError(`Неизвестные ключи: ${unknown.join(', ')}`);
  }

  if (Object.keys(patch).length > 0) {
    await prisma.$transaction(
      Object.entries(patch).map(([key, enabled]) =>
        prisma.notificationPreference.upsert({
          where: { userId_key: { userId, key } },
          create: { userId, key, enabled },
          update: { enabled },
        }),
      ),
    );
  }

  invalidateNotificationPreferencesCache(userId);
  return getUserNotificationSettingsResponse(userId);
}

export async function filterUsersByNotificationPreferences(
  userIds: string[],
  eventType: string,
): Promise<string[]> {
  const settingKey = eventTypeToNotificationSettingKey(eventType);
  if (!settingKey) {
    return userIds;
  }

  const def = getNotificationSettingDefinition(settingKey);
  if (!def) return userIds;

  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return [];

  const allowed: string[] = [];
  await Promise.all(
    unique.map(async (userId) => {
      const map = await loadUserSettingsMap(userId);
      if (map[settingKey] ?? def.defaultEnabled) {
        allowed.push(userId);
      }
    }),
  );

  return allowed;
}

export function parseNotificationSettingsPatch(body: unknown): Record<string, boolean> | null {
  if (!body || typeof body !== 'object') return null;
  const raw = (body as Record<string, unknown>).settings;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const patch: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'boolean') return null;
    patch[key] = value;
  }
  return patch;
}

export class NotificationSettingsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationSettingsValidationError';
  }
}
