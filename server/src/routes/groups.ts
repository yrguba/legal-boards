import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get('/workspace/:workspaceId', async (req: AuthRequest, res) => {
  try {
    const groups = await prisma.group.findMany({
      where: { workspaceId: req.params.workspaceId },
      include: {
        members: {
          select: { userId: true },
        },
      },
    });

    const groupsWithMemberIds = groups.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      workspaceId: group.workspaceId,
      memberIds: group.members.map((m) => m.userId),
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    }));

    res.json(groupsWithMemberIds);
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Ошибка получения групп' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          select: { userId: true },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ error: 'Группа не найдена' });
    }

    res.json({
      id: group.id,
      name: group.name,
      description: group.description,
      workspaceId: group.workspaceId,
      memberIds: group.members.map((m) => m.userId),
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Ошибка получения группы' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, description, workspaceId, memberIds = [] } = req.body;

    const group = await prisma.group.create({
      data: {
        name,
        description,
        workspaceId,
        members: {
          create: memberIds.map((userId: string) => ({ userId })),
        },
      },
      include: {
        members: {
          select: { userId: true },
        },
      },
    });

    res.json({
      id: group.id,
      name: group.name,
      description: group.description,
      workspaceId: group.workspaceId,
      memberIds: group.members.map((m) => m.userId),
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Ошибка создания группы' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;

    const group = await prisma.group.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
      include: {
        members: {
          select: { userId: true },
        },
      },
    });

    res.json({
      id: group.id,
      name: group.name,
      description: group.description,
      workspaceId: group.workspaceId,
      memberIds: group.members.map((m) => m.userId),
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ error: 'Ошибка обновления группы' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.group.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Группа удалена' });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: 'Ошибка удаления группы' });
  }
});

router.post('/:groupId/members', async (req: AuthRequest, res) => {
  try {
    const { userIds } = req.body;

    await prisma.groupMember.deleteMany({
      where: { groupId: req.params.groupId },
    });

    if (userIds.length > 0) {
      await prisma.groupMember.createMany({
        data: userIds.map((userId: string) => ({
          userId,
          groupId: req.params.groupId,
        })),
      });
    }

    res.json({ message: 'Участники группы обновлены' });
  } catch (error) {
    console.error('Update group members error:', error);
    res.status(500).json({ error: 'Ошибка обновления участников группы' });
  }
});

export default router;
