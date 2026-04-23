import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get('/board/:boardId', async (req: AuthRequest, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { boardId: req.params.boardId },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        chatMessages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Ошибка получения задач' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        chatMessages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    res.json(task);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Ошибка получения задачи' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      boardId,
      columnId,
      assigneeId,
    } = req.body;

    const task = await prisma.task.create({
      data: {
        title,
        description,
        status,
        priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        boardId,
        columnId,
        assigneeId,
        createdById: req.userId!,
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Ошибка создания задачи' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      columnId,
      assigneeId,
    } = req.body;

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(priority && { priority }),
        ...(dueDate !== undefined && {
          dueDate: dueDate ? new Date(dueDate) : null,
        }),
        ...(columnId !== undefined && { columnId }),
        ...(assigneeId !== undefined && { assigneeId }),
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json(task);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Ошибка обновления задачи' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.task.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Задача удалена' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Ошибка удаления задачи' });
  }
});

router.post('/:taskId/comments', async (req: AuthRequest, res) => {
  try {
    const { content } = req.body;

    const comment = await prisma.comment.create({
      data: {
        content,
        taskId: req.params.taskId,
        userId: req.userId!,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json(comment);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Ошибка добавления комментария' });
  }
});

router.post('/:taskId/chat', async (req: AuthRequest, res) => {
  try {
    const { type, content, sender } = req.body;

    const chatMessage = await prisma.chatMessage.create({
      data: {
        type,
        content,
        sender,
        taskId: req.params.taskId,
      },
    });

    res.json(chatMessage);
  } catch (error) {
    console.error('Add chat message error:', error);
    res.status(500).json({ error: 'Ошибка добавления сообщения' });
  }
});

export default router;
