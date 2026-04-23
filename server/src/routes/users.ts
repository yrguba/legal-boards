import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        departmentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const usersWithGroups = await Promise.all(
      users.map(async (user) => {
        const groupMemberships = await prisma.groupMember.findMany({
          where: { userId: user.id },
          select: { groupId: true },
        });
        return {
          ...user,
          groupIds: groupMemberships.map((gm) => gm.groupId),
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
        departmentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const groupMemberships = await prisma.groupMember.findMany({
      where: { userId: user.id },
      select: { groupId: true },
    });

    res.json({
      ...user,
      groupIds: groupMemberships.map((gm) => gm.groupId),
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Ошибка получения пользователя' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { name, role, departmentId, groupIds } = req.body;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(role && { role }),
        departmentId: departmentId || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        departmentId: true,
      },
    });

    if (groupIds !== undefined) {
      await prisma.groupMember.deleteMany({
        where: { userId: req.params.id },
      });

      if (groupIds.length > 0) {
        await prisma.groupMember.createMany({
          data: groupIds.map((groupId: string) => ({
            userId: req.params.id,
            groupId,
          })),
        });
      }
    }

    const updatedGroupMemberships = await prisma.groupMember.findMany({
      where: { userId: user.id },
      select: { groupId: true },
    });

    res.json({
      ...user,
      groupIds: updatedGroupMemberships.map((gm) => gm.groupId),
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Ошибка обновления пользователя' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
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
