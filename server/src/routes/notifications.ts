import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
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

router.put('/:id/read', async (req: AuthRequest, res) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });
    res.json(notification);
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Ошибка обновления уведомления' });
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
    res.status(500).json({ error: 'Ошибка обновления уведомлений' });
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
