import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { broadcast } from '../index';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/board/:boardId', async (req: AuthRequest, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { boardId: req.params.boardId },
      include: {
        type: true,
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { comments: true, chatMessages: true },
        },
      },
      orderBy: { createdAt: 'desc' },
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
        type: true,
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        chatMessages: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true },
            },
          },
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
    const { boardId, columnId, typeId, title, description, assigneeId, customFields, attachments } = req.body;

    const task = await prisma.task.create({
      data: {
        boardId,
        columnId,
        typeId,
        title,
        description,
        assigneeId,
        createdBy: req.userId!,
        customFields: customFields || {},
        attachments: attachments || [],
      },
      include: {
        type: true,
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (assigneeId && assigneeId !== req.userId) {
      await prisma.notification.create({
        data: {
          type: 'task_assigned',
          title: 'Новая задача',
          message: `Вам назначена задача "${title}"`,
          userId: assigneeId,
          relatedId: task.id,
        },
      });

      broadcast({
        type: 'notification',
        userId: assigneeId,
        notification: {
          type: 'task_assigned',
          title: 'Новая задача',
          message: `Вам назначена задача "${title}"`,
        },
      });
    }

    res.json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Ошибка создания задачи' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { columnId, title, description, assigneeId, customFields, attachments } = req.body;

    const oldTask = await prisma.task.findUnique({
      where: { id: req.params.id },
    });

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        columnId,
        title,
        description,
        assigneeId,
        customFields,
        attachments,
      },
      include: {
        type: true,
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    if (oldTask && oldTask.columnId !== columnId) {
      const column = await prisma.boardColumn.findUnique({
        where: { id: columnId },
      });

      if (column && oldTask.assigneeId) {
        await prisma.notification.create({
          data: {
            type: 'status_change',
            title: 'Изменение статуса',
            message: `Задача "${task.title}" перемещена в статус "${column.name}"`,
            userId: oldTask.assigneeId,
            relatedId: task.id,
          },
        });
      }
    }

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

router.post('/:id/comments', async (req: AuthRequest, res) => {
  try {
    const { content } = req.body;

    const comment = await prisma.comment.create({
      data: {
        taskId: req.params.id,
        userId: req.userId!,
        content,
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      select: { title: true, assigneeId: true },
    });

    if (task && task.assigneeId && task.assigneeId !== req.userId) {
      await prisma.notification.create({
        data: {
          type: 'comment',
          title: 'Новый комментарий',
          message: `Новый комментарий к задаче "${task.title}"`,
          userId: task.assigneeId,
          relatedId: req.params.id,
        },
      });
    }

    res.json(comment);
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Ошибка создания комментария' });
  }
});

router.post('/:id/chat', async (req: AuthRequest, res) => {
  try {
    const { type, content, sender } = req.body;

    const message = await prisma.chatMessage.create({
      data: {
        taskId: req.params.id,
        type,
        content,
        sender,
        userId: req.userId!,
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    broadcast({
      type: 'chat_message',
      taskId: req.params.id,
      message,
    });

    res.json(message);
  } catch (error) {
    console.error('Create chat message error:', error);
    res.status(500).json({ error: 'Ошибка создания сообщения' });
  }
});

export default router;
