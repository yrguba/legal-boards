import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { broadcast } from '../index';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

async function createAndBroadcastNotification(args: {
  type: string;
  title: string;
  message: string;
  userId: string;
  relatedId?: string;
}) {
  const notification = await prisma.notification.create({
    data: {
      type: args.type,
      title: args.title,
      message: args.message,
      userId: args.userId,
      relatedId: args.relatedId,
    },
  });

  broadcast({
    type: 'notification',
    userId: args.userId,
    notification,
  });

  return notification;
}

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
      await createAndBroadcastNotification({
        type: 'task_assigned',
        title: 'Назначена задача',
        message: `Вам назначена задача "${title}"`,
        userId: assigneeId,
        relatedId: task.id,
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
    const { columnId, typeId, title, description, assigneeId, customFields, attachments } = req.body;

    const oldTask = await prisma.task.findUnique({
      where: { id: req.params.id },
    });

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        columnId,
        typeId,
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
      const [fromColumn, toColumn] = await Promise.all([
        oldTask.columnId
          ? prisma.boardColumn.findUnique({
              where: { id: oldTask.columnId },
              select: { name: true },
            })
          : Promise.resolve(null),
        prisma.boardColumn.findUnique({
          where: { id: columnId },
          select: { name: true },
        }),
      ]);

      const notifyUserId = task.assigneeId || oldTask.assigneeId;
      if (toColumn && notifyUserId && notifyUserId !== req.userId) {
        await createAndBroadcastNotification({
          type: 'status_change',
          title: 'Изменение статуса',
          message: `Статус задачи "${task.title}": "${fromColumn?.name || '—'}" → "${toColumn.name}"`,
          userId: notifyUserId,
          relatedId: task.id,
        });
      }
    }

    if (oldTask && oldTask.typeId !== typeId) {
      const notifyUserId = task.assigneeId;
      if (notifyUserId && notifyUserId !== req.userId) {
        const [fromType, toType] = await Promise.all([
          oldTask.typeId
            ? prisma.taskType.findUnique({
                where: { id: oldTask.typeId },
                select: { name: true },
              })
            : Promise.resolve(null),
          typeId
            ? prisma.taskType.findUnique({
                where: { id: typeId },
                select: { name: true },
              })
            : Promise.resolve(null),
        ]);
        await createAndBroadcastNotification({
          type: 'status_change',
          title: 'Изменение типа',
          message: `Тип задачи "${task.title}": "${fromType?.name || '—'}" → "${toType?.name || '—'}"`,
          userId: notifyUserId,
          relatedId: task.id,
        });
      }
    }

    if (oldTask && oldTask.assigneeId !== assigneeId) {
      if (assigneeId && assigneeId !== req.userId) {
        await createAndBroadcastNotification({
          type: 'task_assigned',
          title: 'Новая задача',
          message: `Вам назначена задача "${task.title}"`,
          userId: assigneeId,
          relatedId: task.id,
        });
      }
    }

    if (oldTask) {
      const oldArr = Array.isArray(oldTask.attachments) ? (oldTask.attachments as any[]) : [];
      const newArr = Array.isArray(task.attachments) ? (task.attachments as any[]) : [];
      const changed =
        oldArr.length !== newArr.length ||
        oldArr.some((x) => !newArr.includes(x)) ||
        newArr.some((x) => !oldArr.includes(x));
      if (changed) {
        const notifyUserId = task.assigneeId;
        if (notifyUserId && notifyUserId !== req.userId) {
          const actor = await prisma.user.findUnique({
            where: { id: req.userId! },
            select: { name: true },
          });
          await createAndBroadcastNotification({
            type: 'document',
            title: 'Обновлены вложения',
            message: `${actor?.name || 'Пользователь'} обновил(а) вложения к задаче "${task.title}"`,
            userId: notifyUserId,
            relatedId: task.id,
          });
        }
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
      const actor = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { name: true },
      });
      await createAndBroadcastNotification({
        type: 'comment',
        title: 'Новый комментарий',
        message: `${actor?.name || 'Пользователь'} оставил(а) комментарий к задаче "${task.title}"`,
        userId: task.assigneeId,
        relatedId: req.params.id,
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
