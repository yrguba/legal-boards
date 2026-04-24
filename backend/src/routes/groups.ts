import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/workspace/:workspaceId', async (req: AuthRequest, res) => {
  try {
    const groups = await prisma.group.findMany({
      where: { workspaceId: req.params.workspaceId },
      include: {
        users: { select: { userId: true } },
      },
    });

    res.json(
      groups.map((g) => ({
        ...g,
        memberIds: g.users.map((u) => u.userId),
      }))
    );
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
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ error: 'Группа не найдена' });
    }

    res.json({
      ...group,
      memberIds: group.users.map((u) => u.userId),
      members: group.users.map((u) => u.user),
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Ошибка получения группы' });
  }
});

router.post('/', authorize('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    const { name, description, workspaceId, memberIds } = req.body;

    const group = await prisma.group.create({
      data: {
        name,
        description,
        workspaceId,
        users: memberIds
          ? {
              create: memberIds.map((userId: string) => ({ userId })),
            }
          : undefined,
      },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    res.json(group);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Ошибка создания группы' });
  }
});

router.put('/:id', authorize('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;

    const group = await prisma.group.update({
      where: { id: req.params.id },
      data: { name, description },
    });

    res.json(group);
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ error: 'Ошибка обновления группы' });
  }
});

router.delete('/:id', authorize('admin', 'manager'), async (req: AuthRequest, res) => {
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

router.post('/:id/members', authorize('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    const { userIds } = req.body;

    await prisma.userGroup.deleteMany({
      where: { groupId: req.params.id },
    });

    if (userIds && userIds.length > 0) {
      await prisma.userGroup.createMany({
        data: userIds.map((userId: string) => ({
          groupId: req.params.id,
          userId,
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
