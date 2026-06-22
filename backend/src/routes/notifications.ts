import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, requireStaffUser } from '../middleware/auth';
import {
  getUserNotificationSettingsResponse,
  NotificationSettingsValidationError,
  parseNotificationSettingsPatch,
  updateUserNotificationSettings,
} from '../utils/notificationSettings/preferences';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);
router.use(requireStaffUser);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Ошибка получения уведомлений' });
  }
});

router.get('/unread', async (req: AuthRequest, res) => {
  try {
    const count = await prisma.notification.count({
      where: {
        userId: req.userId,
        isRead: false,
      },
    });

    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Ошибка получения количества непрочитанных' });
  }
});

router.get('/settings', async (req: AuthRequest, res) => {
  try {
    const data = await getUserNotificationSettingsResponse(req.userId!);
    res.json(data);
  } catch (error) {
    console.error('Get notification settings error:', error);
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
    console.error('Update notification settings error:', error);
    res.status(500).json({ error: 'Ошибка сохранения настроек уведомлений' });
  }
});

router.put('/read-all', async (req: AuthRequest, res) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: req.userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({ message: 'Все уведомления отмечены как прочитанные' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Ошибка отметки всех уведомлений' });
  }
});

router.put('/:id/read', async (req: AuthRequest, res) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });

    res.json(notification);
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ error: 'Ошибка отметки уведомления' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.notification.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Уведомление удалено' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Ошибка удаления уведомления' });
  }
});

export default router;
