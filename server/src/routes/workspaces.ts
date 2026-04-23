import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId: req.userId,
          },
        },
      },
    });
    res.json(workspaces);
  } catch (error) {
    console.error('Get workspaces error:', error);
    res.status(500).json({ error: 'Ошибка получения рабочих пространств' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: req.params.id,
        members: {
          some: {
            userId: req.userId,
          },
        },
      },
    });

    if (!workspace) {
      return res.status(404).json({ error: 'Рабочее пространство не найдено' });
    }

    res.json(workspace);
  } catch (error) {
    console.error('Get workspace error:', error);
    res.status(500).json({ error: 'Ошибка получения рабочего пространства' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;

    const workspace = await prisma.workspace.create({
      data: {
        name,
        description,
        members: {
          create: {
            userId: req.userId!,
            role: 'admin',
          },
        },
      },
    });

    res.json(workspace);
  } catch (error) {
    console.error('Create workspace error:', error);
    res.status(500).json({ error: 'Ошибка создания рабочего пространства' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;

    const workspace = await prisma.workspace.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
    });

    res.json(workspace);
  } catch (error) {
    console.error('Update workspace error:', error);
    res.status(500).json({ error: 'Ошибка обновления рабочего пространства' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.workspace.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Рабочее пространство удалено' });
  } catch (error) {
    console.error('Delete workspace error:', error);
    res.status(500).json({ error: 'Ошибка удаления рабочего пространства' });
  }
});

router.post('/:workspaceId/users', async (req: AuthRequest, res) => {
  try {
    const { userEmail } = req.body;

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const member = await prisma.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId: req.params.workspaceId,
        role: 'member',
      },
    });

    res.json(member);
  } catch (error) {
    console.error('Add user to workspace error:', error);
    res.status(500).json({ error: 'Ошибка добавления пользователя' });
  }
});

export default router;
