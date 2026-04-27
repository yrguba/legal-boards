import { Router } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { authenticate, AuthRequest } from '../middleware/auth';
import { broadcast } from '../index';
import { getUploadsPath, toPublicUploadPath } from '../uploadsPath';
import { decodeMultipartFilename } from '../utils/decodeMultipartFilename';
import { assertUserCanAccessTask } from '../utils/taskAccess';

const router = Router();
const prisma = new PrismaClient();

const taskUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = getUploadsPath();
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (e) {
        return cb(e as Error, dir);
      }
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(decodeMultipartFilename(file.originalname));
      cb(null, 't-' + uniqueSuffix + ext);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

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

router.post('/:id/attachments', taskUpload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не предоставлен' });
    }
    const taskId = req.params.id;
    const gate = await assertUserCanAccessTask(prisma, taskId, req.userId!, req.userRole);
    if (!gate.ok) {
      return res.status(404).json({ error: 'Задача не найдена или нет доступа' });
    }
    const displayName = decodeMultipartFilename(req.file.originalname);
    const att = await prisma.taskAttachment.create({
      data: {
        taskId,
        name: displayName,
        type: req.file.mimetype,
        size: req.file.size,
        path: toPublicUploadPath(req.file.path),
        uploadedBy: req.userId!,
      },
      include: {
        uploader: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });
    return res.json(att);
  } catch (error) {
    console.error('Upload task attachment error:', error);
    return res.status(500).json({ error: 'Ошибка загрузки вложения' });
  }
});

router.delete('/:id/attachments/:attachmentId', async (req: AuthRequest, res) => {
  try {
    const { id: taskId, attachmentId } = req.params;
    const gate = await assertUserCanAccessTask(prisma, taskId, req.userId!, req.userRole);
    if (!gate.ok) {
      return res.status(404).json({ error: 'Задача не найдена или нет доступа' });
    }
    const att = await prisma.taskAttachment.findFirst({
      where: { id: attachmentId, taskId },
    });
    if (!att) {
      return res.status(404).json({ error: 'Вложение не найдено' });
    }
    if (att.uploadedBy !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    try {
      const fp = path.join(getUploadsPath(), path.basename(att.path));
      if (fs.existsSync(fp)) {
        fs.unlinkSync(fp);
      }
    } catch {
      /* ignore */
    }
    await prisma.taskAttachment.delete({ where: { id: attachmentId } });
    return res.json({ message: 'Вложение удалено' });
  } catch (error) {
    console.error('Delete task attachment error:', error);
    return res.status(500).json({ error: 'Ошибка удаления вложения' });
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
        clientInteractions: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true },
            },
          },
          orderBy: { occurredAt: 'desc' },
        },
        taskAttachments: {
          orderBy: { createdAt: 'desc' },
          include: {
            uploader: { select: { id: true, name: true, email: true, avatar: true } },
          },
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
    const { boardId, columnId, typeId, title, description, assigneeId, customFields } = req.body;

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
    const { columnId, typeId, title, description, assigneeId, customFields } = req.body;

    const data: Prisma.TaskUncheckedUpdateInput = {};
    if (columnId !== undefined) data.columnId = columnId;
    if (typeId !== undefined) data.typeId = typeId;
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (Object.prototype.hasOwnProperty.call(req.body, 'assigneeId')) {
      data.assigneeId = assigneeId ?? null;
    }
    if (customFields !== undefined) data.customFields = customFields;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Нет полей для обновления' });
    }

    const oldTask = await prisma.task.findUnique({
      where: { id: req.params.id },
    });

    if (!oldTask) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data,
      include: {
        type: true,
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        taskAttachments: {
          orderBy: { createdAt: 'desc' },
          include: {
            uploader: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
      },
    });

    const notifyUserIds = Array.from(
      new Set([task.assigneeId || oldTask?.assigneeId, oldTask?.createdBy].filter(Boolean) as string[])
    );

    if (columnId !== undefined && oldTask.columnId !== columnId) {
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

      if (toColumn) {
        await Promise.all(
          notifyUserIds.map((userId) =>
            createAndBroadcastNotification({
              type: 'status_change',
              title: 'Изменение статуса',
              message: `Статус задачи "${task.title}": "${fromColumn?.name || '—'}" → "${toColumn.name}"`,
              userId,
              relatedId: task.id,
            })
          )
        );
      }
    }

    if (typeId !== undefined && oldTask.typeId !== typeId) {
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

      await Promise.all(
        notifyUserIds.map((userId) =>
          createAndBroadcastNotification({
            type: 'status_change',
            title: 'Изменение типа',
            message: `Тип задачи "${task.title}": "${fromType?.name || '—'}" → "${toType?.name || '—'}"`,
            userId,
            relatedId: task.id,
          })
        )
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(req.body, 'assigneeId') &&
      oldTask.assigneeId !== assigneeId
    ) {
      if (assigneeId) {
        await createAndBroadcastNotification({
          type: 'task_assigned',
          title: 'Назначена задача',
          message: `Вам назначена задача "${task.title}"`,
          userId: assigneeId,
          relatedId: task.id,
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
      select: { title: true, assigneeId: true, createdBy: true },
    });

    if (task) {
      const actor = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { name: true },
      });

      const notifyUserIds = Array.from(
        new Set([task.assigneeId, task.createdBy].filter(Boolean) as string[])
      );
      await Promise.all(
        notifyUserIds.map((userId) =>
          createAndBroadcastNotification({
            type: 'comment',
            title: 'Новый комментарий',
            message: `${actor?.name || 'Пользователь'} оставил(а) комментарий к задаче "${task.title}"`,
            userId,
            relatedId: req.params.id,
          })
        )
      );
    }

    res.json(comment);
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Ошибка создания комментария' });
  }
});

const CLIENT_INTERACTION_KINDS = new Set(['call', 'email', 'meeting', 'note', 'other']);

router.post('/:id/client-interactions', async (req: AuthRequest, res) => {
  try {
    const { kind, title, details, occurredAt } = req.body;
    if (!title || String(title).trim() === '') {
      return res.status(400).json({ error: 'Укажите заголовок' });
    }
    const kindValue = String(kind || 'note');
    if (!CLIENT_INTERACTION_KINDS.has(kindValue)) {
      return res.status(400).json({ error: 'Некорректный тип взаимодействия' });
    }
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    const occurred = occurredAt ? new Date(occurredAt) : new Date();
    if (Number.isNaN(occurred.getTime())) {
      return res.status(400).json({ error: 'Некорректная дата' });
    }

    const interaction = await prisma.taskClientInteraction.create({
      data: {
        taskId: req.params.id,
        userId: req.userId!,
        kind: kindValue,
        title: String(title).trim(),
        details: details && String(details).trim() ? String(details).trim() : null,
        occurredAt: occurred,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    });

    return res.json(interaction);
  } catch (error) {
    console.error('Create client interaction error:', error);
    return res.status(500).json({ error: 'Ошибка сохранения записи' });
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
