import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        departmentId: true,
        createdAt: true,
      },
    });

    const usersWithGroups = await Promise.all(
      users.map(async (user) => {
        const groups = await prisma.userGroup.findMany({
          where: { userId: user.id },
          include: { group: true },
        });

        return {
          ...user,
          groupIds: groups.map((g) => g.groupId),
        };
      })
    );

    res.json(usersWithGroups);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        departmentId: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const groups = await prisma.userGroup.findMany({
      where: { userId: user.id },
      include: { group: true },
    });

    res.json({
      ...user,
      groupIds: groups.map((g) => g.groupId),
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Ошибка получения пользователя' });
  }
});

router.put('/:id', authorize('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    const { name, role, departmentId, groupIds } = req.body;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        name,
        role,
        departmentId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        departmentId: true,
      },
    });

    if (groupIds !== undefined) {
      await prisma.userGroup.deleteMany({
        where: { userId: req.params.id },
      });

      if (groupIds.length > 0) {
        await prisma.userGroup.createMany({
          data: groupIds.map((groupId: string) => ({
            userId: req.params.id,
            groupId,
          })),
        });
      }
    }

    const groups = await prisma.userGroup.findMany({
      where: { userId: user.id },
    });

    res.json({
      ...user,
      groupIds: groups.map((g) => g.groupId),
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Ошибка обновления пользователя' });
  }
});

router.delete('/:id', authorize('admin'), async (req: AuthRequest, res) => {
  try {
    await prisma.user.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Пользователь удален' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Ошибка удаления пользователя' });
  }
});

export default router;
