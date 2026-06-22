import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, requireStaffUser } from '../middleware/auth';
import {
  isApnsConfigured,
  isFcmConfigured,
  isPushAndroidEnabled,
  isPushEnabled,
  isPushIosEnabled,
  isPushMobileEnabled,
} from '../push/config';
import { pushLog } from '../push/logger';
import {
  getUserNotificationSettingsResponse,
  NotificationSettingsValidationError,
  parseNotificationSettingsPatch,
  updateUserNotificationSettings,
} from '../utils/notificationSettings/preferences';
import { sendPushToUsers } from '../push/sender';

const router = Router();
const prisma = new PrismaClient();

router.get('/config', (_req, res) => {
  res.json({
    enabled: isPushEnabled(),
    mobileEnabled: isPushMobileEnabled(),
    androidEnabled: isPushAndroidEnabled(),
    iosEnabled: isPushIosEnabled(),
    fcmConfigured: isFcmConfigured(),
    apnsConfigured: isApnsConfigured(),
  });
});

router.use(authenticate);
router.use(requireStaffUser);

function normalizePlatform(raw: unknown): 'android' | 'ios' | null {
  if (raw === 'android' || raw === 'ios') return raw;
  return null;
}

function normalizeProvider(raw: unknown): 'fcm' | 'apns' | null {
  if (raw === 'fcm' || raw === 'apns') return raw;
  return null;
}

router.post('/devices', async (req: AuthRequest, res) => {
  try {
    const platform = normalizePlatform(req.body?.platform);
    const provider = normalizeProvider(req.body?.provider);
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const deviceId = typeof req.body?.deviceId === 'string' ? req.body.deviceId.trim() : null;
    const appVersion = typeof req.body?.appVersion === 'string' ? req.body.appVersion.trim() : null;

    if (!platform || !provider || !token) {
      return res.status(400).json({ error: 'platform, provider и token обязательны' });
    }
    if (platform === 'android' && provider !== 'fcm') {
      return res.status(400).json({ error: 'Android поддерживает только provider=fcm' });
    }
    if (platform === 'ios' && provider !== 'apns') {
      return res.status(400).json({ error: 'iOS поддерживает только provider=apns' });
    }

    const userId = req.userId!;
    const existing = await prisma.pushDevice.findUnique({ where: { token } });

    const device = existing
      ? await prisma.pushDevice.update({
          where: { token },
          data: {
            userId,
            platform,
            provider,
            deviceId,
            appVersion,
            isActive: true,
            lastSeenAt: new Date(),
          },
        })
      : await prisma.pushDevice.create({
          data: {
            userId,
            platform,
            provider,
            token,
            deviceId,
            appVersion,
          },
        });

    res.status(existing ? 200 : 201).json({
      id: device.id,
      platform: device.platform,
      provider: device.provider,
      isActive: device.isActive,
    });
  } catch (error) {
    console.error('Register push device error:', error);
    res.status(500).json({ error: 'Ошибка регистрации устройства' });
  }
});

router.delete('/devices', async (req: AuthRequest, res) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!token) {
      return res.status(400).json({ error: 'token обязателен' });
    }

    const device = await prisma.pushDevice.findUnique({ where: { token } });
    if (!device || device.userId !== req.userId) {
      return res.status(404).json({ error: 'Устройство не найдено' });
    }

    await prisma.pushDevice.update({
      where: { token },
      data: { isActive: false },
    });

    res.json({ message: 'Push-токен отключён' });
  } catch (error) {
    console.error('Unregister push device error:', error);
    res.status(500).json({ error: 'Ошибка отключения устройства' });
  }
});

router.get('/devices', async (req: AuthRequest, res) => {
  try {
    const devices = await prisma.pushDevice.findMany({
      where: { userId: req.userId!, isActive: true },
      select: {
        id: true,
        platform: true,
        provider: true,
        deviceId: true,
        appVersion: true,
        lastSeenAt: true,
        createdAt: true,
      },
      orderBy: { lastSeenAt: 'desc' },
    });
    res.json(devices);
  } catch (error) {
    console.error('List push devices error:', error);
    res.status(500).json({ error: 'Ошибка загрузки устройств' });
  }
});

router.get('/settings', async (req: AuthRequest, res) => {
  try {
    const data = await getUserNotificationSettingsResponse(req.userId!);
    res.json(data);
  } catch (error) {
    console.error('Get push settings error:', error);
    res.status(500).json({ error: 'Ошибка загрузки настроек уведомлений' });
  }
});

router.put('/settings', async (req: AuthRequest, res) => {
  try {
    const patch = parseNotificationSettingsPatch(req.body);
    if (!patch) {
      return res.status(400).json({
        error: 'Ожидается { "settings": { "task_assigned": true, ... } } с boolean-значениями',
      });
    }

    const data = await updateUserNotificationSettings(req.userId!, patch);
    res.json(data);
  } catch (error) {
    if (error instanceof NotificationSettingsValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Update push settings error:', error);
    res.status(500).json({ error: 'Ошибка сохранения настроек уведомлений' });
  }
});

router.post('/test', async (req: AuthRequest, res) => {
  try {
    if (!isPushEnabled()) {
      return res.status(503).json({
        error: 'Push отключён',
        code: 'PUSH_DISABLED',
        hint: 'Установите PUSH_ENABLED=true в .env',
      });
    }
    if (!isPushMobileEnabled()) {
      return res.status(503).json({
        error: 'Push на мобильные устройства отключён',
        code: 'PUSH_MOBILE_DISABLED',
        hint: 'Установите PUSH_MOBILE_ENABLED=true в .env',
      });
    }

    const title =
      typeof req.body?.title === 'string' && req.body.title.trim()
        ? req.body.title.trim()
        : 'Тестовое push-уведомление';
    const body =
      typeof req.body?.body === 'string' && req.body.body.trim()
        ? req.body.body.trim()
        : 'Legal Boards — проверка доставки';
    const route = typeof req.body?.route === 'string' ? req.body.route.trim() : '/';

    const userId = req.userId!;
    pushLog('test send requested', { userId, title });

    const stats = await sendPushToUsers([userId], {
      title,
      body,
      eventType: 'test',
      route: route || '/',
    });

    if (stats.devices === 0) {
      return res.status(404).json({
        error: 'Нет активных push-устройств. Сначала POST /api/push/devices',
        code: 'NO_DEVICES',
        stats,
      });
    }

    const delivered = stats.ok > 0;
    res.status(delivered ? 200 : 502).json({
      message: delivered ? 'Тестовый push отправлен' : 'Не удалось доставить push',
      stats,
      config: {
        androidEnabled: isPushAndroidEnabled(),
        iosEnabled: isPushIosEnabled(),
        fcmConfigured: isFcmConfigured(),
        apnsConfigured: isApnsConfigured(),
      },
    });
  } catch (error) {
    console.error('Test push error:', error);
    res.status(500).json({ error: 'Ошибка отправки тестового push' });
  }
});

export default router;
