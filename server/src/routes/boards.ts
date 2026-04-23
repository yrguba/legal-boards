import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get('/workspace/:workspaceId', async (req: AuthRequest, res) => {
  try {
    const boards = await prisma.board.findMany({
      where: { workspaceId: req.params.workspaceId },
      include: {
        columns: {
          orderBy: { order: 'asc' },
        },
      },
    });
    res.json(boards);
  } catch (error) {
    console.error('Get boards error:', error);
    res.status(500).json({ error: 'Ошибка получения досок' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const board = await prisma.board.findUnique({
      where: { id: req.params.id },
      include: {
        columns: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!board) {
      return res.status(404).json({ error: 'Доска не найдена' });
    }

    res.json(board);
  } catch (error) {
    console.error('Get board error:', error);
    res.status(500).json({ error: 'Ошибка получения доски' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, description, workspaceId, columns = [] } = req.body;

    const board = await prisma.board.create({
      data: {
        name,
        description,
        workspaceId,
        createdById: req.userId!,
        columns: {
          create: columns.map((col: any, index: number) => ({
            name: col.name,
            order: index,
          })),
        },
      },
      include: {
        columns: {
          orderBy: { order: 'asc' },
        },
      },
    });

    res.json(board);
  } catch (error) {
    console.error('Create board error:', error);
    res.status(500).json({ error: 'Ошибка создания доски' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;

    const board = await prisma.board.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
      include: {
        columns: {
          orderBy: { order: 'asc' },
        },
      },
    });

    res.json(board);
  } catch (error) {
    console.error('Update board error:', error);
    res.status(500).json({ error: 'Ошибка обновления доски' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.board.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Доска удалена' });
  } catch (error) {
    console.error('Delete board error:', error);
    res.status(500).json({ error: 'Ошибка удаления доски' });
  }
});

export default router;
