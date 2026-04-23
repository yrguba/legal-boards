import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/workspace/:workspaceId', async (req: AuthRequest, res) => {
  try {
    const boards = await prisma.board.findMany({
      where: { workspaceId: req.params.workspaceId },
      include: {
        columns: { orderBy: { position: 'asc' } },
        taskFields: { orderBy: { position: 'asc' } },
        taskTypes: true,
        _count: { select: { tasks: true } },
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
        columns: { orderBy: { position: 'asc' } },
        taskFields: { orderBy: { position: 'asc' } },
        taskTypes: true,
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
    const { name, description, workspaceId, viewMode, visibility, columns, taskFields, taskTypes } = req.body;

    const board = await prisma.board.create({
      data: {
        name,
        description,
        workspaceId,
        viewMode: viewMode || 'kanban',
        visibility: visibility || {},
        columns: {
          create: columns.map((col: any, index: number) => ({
            name: col.name,
            description: col.description,
            position: index,
            visibility: col.visibility || {},
            autoAssign: col.autoAssign,
          })),
        },
        taskFields: {
          create: taskFields.map((field: any, index: number) => ({
            name: field.name,
            type: field.type,
            required: field.required,
            options: field.options,
            position: index,
          })),
        },
        taskTypes: {
          create: taskTypes.map((type: any) => ({
            name: type.name,
            color: type.color,
            icon: type.icon,
          })),
        },
      },
      include: {
        columns: true,
        taskFields: true,
        taskTypes: true,
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
    const { name, description, viewMode, visibility } = req.body;

    const board = await prisma.board.update({
      where: { id: req.params.id },
      data: { name, description, viewMode, visibility },
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

router.post('/:id/columns', async (req: AuthRequest, res) => {
  try {
    const { name, description, position, visibility, autoAssign } = req.body;

    const column = await prisma.boardColumn.create({
      data: {
        boardId: req.params.id,
        name,
        description,
        position,
        visibility: visibility || {},
        autoAssign,
      },
    });

    res.json(column);
  } catch (error) {
    console.error('Create column error:', error);
    res.status(500).json({ error: 'Ошибка создания колонки' });
  }
});

router.put('/columns/:columnId', async (req: AuthRequest, res) => {
  try {
    const { name, description, position, visibility, autoAssign } = req.body;

    const column = await prisma.boardColumn.update({
      where: { id: req.params.columnId },
      data: { name, description, position, visibility, autoAssign },
    });

    res.json(column);
  } catch (error) {
    console.error('Update column error:', error);
    res.status(500).json({ error: 'Ошибка обновления колонки' });
  }
});

router.delete('/columns/:columnId', async (req: AuthRequest, res) => {
  try {
    await prisma.boardColumn.delete({
      where: { id: req.params.columnId },
    });

    res.json({ message: 'Колонка удалена' });
  } catch (error) {
    console.error('Delete column error:', error);
    res.status(500).json({ error: 'Ошибка удаления колонки' });
  }
});

export default router;
