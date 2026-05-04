import { Router } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { authenticate, AuthRequest } from '../middleware/auth';
import { broadcast } from '../realtime';
import { getUploadsPath, toPublicUploadPath } from '../uploadsPath';
import { decodeMultipartFilename } from '../utils/decodeMultipartFilename';
import { assertUserCanAccessTask } from '../utils/taskAccess';
import { completeChat } from '../services/groqAssistant';

const router = Router();
const prisma = new PrismaClient();

/** Поля клиента LEXPRO для карточки задачи в Legal Boards */
const LEX_CREATOR_FOR_TASK = {
  select: {
    id: true,
    name: true,
    email: true,
    clientKind: true,
    companyName: true,
    phone: true,
    contactNotes: true,
  },
} as const;

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

function accessCtx(req: AuthRequest) {
  return { userId: req.userId, userRole: req.userRole, lexClientId: req.lexClientId };
}

function unifyTaskRow(task: Record<string, unknown>) {
  const lexCreator = task.lexCreator as {
    id: string;
    name: string;
    email?: string | null;
    clientKind?: string;
    companyName?: string | null;
    phone?: string | null;
    contactNotes?: string | null;
  } | null | undefined;
  const creator = task.creator as Record<string, unknown> | null | undefined;
  const { lexCreator: _x, ...rest } = task;
  const lexClientProfile = lexCreator
    ? {
        id: lexCreator.id,
        name: lexCreator.name,
        email: lexCreator.email ?? undefined,
        clientKind: lexCreator.clientKind,
        companyName: lexCreator.companyName ?? undefined,
        phone: lexCreator.phone ?? undefined,
        contactNotes: lexCreator.contactNotes ?? undefined,
      }
    : null;
  return {
    ...rest,
    creator:
      creator ??
      (lexCreator
        ? { id: lexCreator.id, name: lexCreator.name, email: lexCreator.email ?? undefined }
        : null),
    lexClientProfile,
  };
}

function unifyChatMessage(m: Record<string, unknown>) {
  const lex = m.lexClientUser as { id: string; name: string; email?: string | null } | null | undefined;
  const user = m.user as Record<string, unknown> | null | undefined;
  const { lexClientUser: _y, ...rest } = m;
  return {
    ...rest,
    user:
      user ??
      (lex ? { id: lex.id, name: lex.name, email: lex.email ?? undefined, avatar: null } : null),
  };
}

function unifyAttachmentRow(a: Record<string, unknown>) {
  const lx = a.lexUploader as { id: string; name: string; email?: string | null } | null | undefined;
  const up = a.uploader as Record<string, unknown> | null | undefined;
  const { lexUploader: _z, ...rest } = a;
  return {
    ...rest,
    uploader:
      up ??
      (lx ? { id: lx.id, name: lx.name, email: lx.email ?? undefined, avatar: null } : null),
  };
}

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

async function mergedTaskStatusHistory(taskId: string): Promise<{ message: string; createdAt: string }[]> {
  const [events, legacyRows] = await Promise.all([
    prisma.taskStatusEvent.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      select: { message: true, createdAt: true },
    }),
    prisma.notification.findMany({
      where: {
        relatedId: taskId,
        type: 'status_change',
        title: { in: ['Изменение статуса', 'Изменение типа'] },
      },
      orderBy: { createdAt: 'asc' },
      select: { message: true, createdAt: true },
    }),
  ]);

  const combined = [...events, ...legacyRows].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  const seen = new Set<string>();
  const out: { message: string; createdAt: string }[] = [];
  for (const r of combined) {
    if (seen.has(r.message)) continue;
    seen.add(r.message);
    out.push({ message: r.message, createdAt: r.createdAt.toISOString() });
  }
  return out;
}

router.get('/board/:boardId', async (req: AuthRequest, res) => {
  try {
    const boardWhere = req.lexClientId
      ? { boardId: req.params.boardId, lexCreatorId: req.lexClientId }
      : { boardId: req.params.boardId };

    const tasks = await prisma.task.findMany({
      where: boardWhere,
      include: {
        type: true,
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
        lexCreator: LEX_CREATOR_FOR_TASK,
        _count: {
          select: { comments: true, chatMessages: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(tasks.map((t) => unifyTaskRow(t as Record<string, unknown>)));
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
    const gate = await assertUserCanAccessTask(prisma, taskId, accessCtx(req));
    if (!gate.ok) {
      return res.status(404).json({ error: 'Задача не найдена или нет доступа' });
    }
    const displayName = decodeMultipartFilename(req.file.originalname);
    const att = await prisma.taskAttachment.create({
      data: req.lexClientId
        ? {
            taskId,
            name: displayName,
            type: req.file.mimetype,
            size: req.file.size,
            path: toPublicUploadPath(req.file.path),
            uploadedBy: null,
            uploadedByLexClientId: req.lexClientId,
          }
        : {
            taskId,
            name: displayName,
            type: req.file.mimetype,
            size: req.file.size,
            path: toPublicUploadPath(req.file.path),
            uploadedBy: req.userId!,
            uploadedByLexClientId: null,
          },
      include: {
        uploader: { select: { id: true, name: true, email: true, avatar: true } },
        lexUploader: { select: { id: true, name: true, email: true } },
      },
    });
    return res.json(unifyAttachmentRow(att as Record<string, unknown>));
  } catch (error) {
    console.error('Upload task attachment error:', error);
    return res.status(500).json({ error: 'Ошибка загрузки вложения' });
  }
});

router.delete('/:id/attachments/:attachmentId', async (req: AuthRequest, res) => {
  try {
    const { id: taskId, attachmentId } = req.params;
    const gate = await assertUserCanAccessTask(prisma, taskId, accessCtx(req));
    if (!gate.ok) {
      return res.status(404).json({ error: 'Задача не найдена или нет доступа' });
    }
    const att = await prisma.taskAttachment.findFirst({
      where: { id: attachmentId, taskId },
    });
    if (!att) {
      return res.status(404).json({ error: 'Вложение не найдено' });
    }
    const staffOk =
      !!req.userId &&
      (att.uploadedBy === req.userId || req.userRole === 'admin');
    const lexOk =
      !!req.lexClientId &&
      !!att.uploadedByLexClientId &&
      att.uploadedByLexClientId === req.lexClientId;
    if (!staffOk && !lexOk) {
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

/** История смены колонки и типа: TaskStatusEvent + старые записи Notification */
router.get('/:id/status-history', async (req: AuthRequest, res) => {
  try {
    const taskId = req.params.id;
    const gate = await assertUserCanAccessTask(prisma, taskId, accessCtx(req));
    if (!gate.ok) {
      return res.status(404).json({ error: 'Задача не найдена или нет доступа' });
    }

    const out = await mergedTaskStatusHistory(taskId);
    res.json(out);
  } catch (error) {
    console.error('Get task status history error:', error);
    res.status(500).json({ error: 'Ошибка истории статусов' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, private');

    const taskId = req.params.id;
    const gate = await assertUserCanAccessTask(prisma, taskId, accessCtx(req));
    if (!gate.ok) {
      return res.status(404).json({ error: 'Задача не найдена или нет доступа' });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        type: true,
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
        lexCreator: LEX_CREATOR_FOR_TASK,
        comments: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
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
            lexUploader: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    const chatMessagesRaw = await prisma.chatMessage.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
        lexClientUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const row = unifyTaskRow(task as Record<string, unknown>);
    res.json({
      ...row,
      chatMessages: chatMessagesRaw.map((m) =>
        unifyChatMessage(m as Record<string, unknown>),
      ),
      taskAttachments: task.taskAttachments.map((a) =>
        unifyAttachmentRow(a as Record<string, unknown>),
      ),
    });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Ошибка получения задачи' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { boardId, columnId, typeId, title, description, assigneeId, customFields } = req.body;

    if (req.lexClientId) {
      const board = await prisma.board.findUnique({
        where: { id: boardId },
        select: { workspaceId: true },
      });
      if (!board) {
        return res.status(404).json({ error: 'Доска не найдена' });
      }

      await prisma.lexClientWorkspace.upsert({
        where: {
          lexClientId_workspaceId: {
            lexClientId: req.lexClientId,
            workspaceId: board.workspaceId,
          },
        },
        create: {
          lexClientId: req.lexClientId,
          workspaceId: board.workspaceId,
        },
        update: {},
      });

      const lexTask = await prisma.task.create({
        data: {
          boardId,
          columnId,
          typeId,
          title,
          description,
          assigneeId: null,
          createdBy: null,
          lexCreatorId: req.lexClientId,
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
          lexCreator: LEX_CREATOR_FOR_TASK,
        },
      });

      return res.json(unifyTaskRow(lexTask as Record<string, unknown>));
    }

    if (!req.userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const task = await prisma.task.create({
      data: {
        boardId,
        columnId,
        typeId,
        title,
        description,
        assigneeId,
        createdBy: req.userId,
        lexCreatorId: null,
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
        lexCreator: LEX_CREATOR_FOR_TASK,
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

    res.json(unifyTaskRow(task as Record<string, unknown>));
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Ошибка создания задачи' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    if (req.lexClientId) {
      return res.status(403).json({ error: 'Изменение задачи доступно только сотрудникам Legal Boards' });
    }

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
      new Set(
        [task.assigneeId, oldTask.assigneeId, oldTask.createdBy].filter(
          (id): id is string => Boolean(id),
        ),
      ),
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
        const statusMessage = `Статус задачи "${task.title}": "${fromColumn?.name || '—'}" → "${toColumn.name}"`;
        await prisma.taskStatusEvent.create({
          data: {
            taskId: task.id,
            kind: 'column',
            message: statusMessage,
          },
        });
        await Promise.all(
          notifyUserIds.map((userId) =>
            createAndBroadcastNotification({
              type: 'status_change',
              title: 'Изменение статуса',
              message: statusMessage,
              userId,
              relatedId: task.id,
            }),
          ),
        );
        if (oldTask.lexCreatorId) {
          broadcast({
            type: 'task_status_history',
            taskId: task.id,
            lexCreatorId: oldTask.lexCreatorId,
            entry: {
              message: statusMessage,
              createdAt: new Date().toISOString(),
            },
          });
        }
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

      const typeMessage = `Тип задачи "${task.title}": "${fromType?.name || '—'}" → "${toType?.name || '—'}"`;
      await prisma.taskStatusEvent.create({
        data: {
          taskId: task.id,
          kind: 'type',
          message: typeMessage,
        },
      });
      await Promise.all(
        notifyUserIds.map((userId) =>
          createAndBroadcastNotification({
            type: 'status_change',
            title: 'Изменение типа',
            message: typeMessage,
            userId,
            relatedId: task.id,
          }),
        ),
      );
      if (oldTask.lexCreatorId) {
        broadcast({
          type: 'task_status_history',
          taskId: task.id,
          lexCreatorId: oldTask.lexCreatorId,
          entry: {
            message: typeMessage,
            createdAt: new Date().toISOString(),
          },
        });
      }
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
    if (req.lexClientId) {
      return res.status(403).json({ error: 'Удаление задачи доступно только сотрудникам Legal Boards' });
    }

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
    if (req.lexClientId) {
      return res.status(403).json({ error: 'Комментарии доступны только сотрудникам Legal Boards' });
    }

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
    if (req.lexClientId) {
      return res.status(403).json({ error: 'Доступно только сотрудникам Legal Boards' });
    }

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

router.post('/:id/chat/assistant', async (req: AuthRequest, res) => {
  try {
    if (req.lexClientId) {
      return res.status(403).json({ error: 'Ассистент доступен только сотрудникам Legal Boards' });
    }

    const taskId = req.params.id;
    const gate = await assertUserCanAccessTask(prisma, taskId, accessCtx(req));
    if (!gate.ok) {
      return res.status(404).json({ error: 'Задача не найдена или нет доступа' });
    }

    const raw = typeof req.body?.content === 'string' ? req.body.content : '';
    const content = raw.trim();
    if (!content) {
      return res.status(400).json({ error: 'Введите сообщение' });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { title: true, description: true },
    });
    if (!task) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    const userMessage = await prisma.chatMessage.create({
      data: {
        taskId,
        type: 'assistant',
        content,
        sender: 'user',
        userId: req.userId!,
        lexClientUserId: null,
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    broadcast({
      type: 'chat_message',
      taskId,
      message: userMessage,
    });

    const history = await prisma.chatMessage.findMany({
      where: { taskId, type: 'assistant' },
      orderBy: { createdAt: 'asc' },
    });

    const titlePart = task.title.replace(/\s+/g, ' ').trim().slice(0, 400);
    const systemLines = [
      'Ты помощник в юридической системе управления задачами (канбан). Отвечай кратко и по делу.',
      `Контекст задачи: «${titlePart}».`,
    ];
    if (task.description?.trim()) {
      const desc = task.description.replace(/\s+/g, ' ').trim().slice(0, 6000);
      systemLines.push(`Описание задачи: ${desc}`);
    }

    const llmMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemLines.join('\n') },
    ];

    const historyWindow = history.length > 80 ? history.slice(-80) : history;
    for (const m of historyWindow) {
      const role = m.sender === 'assistant' ? 'assistant' : 'user';
      llmMessages.push({ role, content: m.content });
    }

    let replyText: string;
    try {
      replyText = await completeChat(llmMessages);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка Groq';
      console.error('Groq assistant error:', e);
      return res.status(502).json({ error: msg });
    }

    const assistantMessage = await prisma.chatMessage.create({
      data: {
        taskId,
        type: 'assistant',
        content: replyText,
        sender: 'assistant',
        userId: req.userId!,
        lexClientUserId: null,
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    broadcast({
      type: 'chat_message',
      taskId,
      message: assistantMessage,
    });

    return res.json({ userMessage, assistantMessage });
  } catch (error) {
    console.error('Assistant chat error:', error);
    return res.status(500).json({ error: 'Ошибка ассистента' });
  }
});

router.post('/:id/chat', async (req: AuthRequest, res) => {
  try {
    const taskId = req.params.id;
    const gate = await assertUserCanAccessTask(prisma, taskId, accessCtx(req));
    if (!gate.ok) {
      return res.status(404).json({ error: 'Задача не найдена или нет доступа' });
    }

    const rawContent = (req.body as { content?: unknown })?.content;
    const rawSender = (req.body as { sender?: unknown })?.sender;

    const type = 'client';
    const content = typeof rawContent === 'string' ? rawContent.trim() : '';
    const sender =
      typeof rawSender === 'string' && rawSender.trim() ? rawSender.trim() : 'user';

    if (!content) {
      return res.status(400).json({ error: 'Пустое сообщение' });
    }

    const message = await prisma.chatMessage.create({
      data: req.lexClientId
        ? {
            taskId,
            type,
            content,
            sender,
            userId: null,
            lexClientUserId: req.lexClientId,
          }
        : {
            taskId,
            type,
            content,
            sender,
            userId: req.userId!,
            lexClientUserId: null,
          },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
        lexClientUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const payload = unifyChatMessage(message as Record<string, unknown>);

    const taskMeta = await prisma.task.findUnique({
      where: { id: taskId },
      select: { lexCreatorId: true },
    });

    broadcast({
      type: 'chat_message',
      taskId,
      lexCreatorId: taskMeta?.lexCreatorId ?? null,
      message: payload,
      authorUserId: message.userId ?? null,
      authorLexClientId: message.lexClientUserId ?? null,
    });

    res.json(payload);
  } catch (error) {
    console.error('Create chat message error:', error);
    res.status(500).json({ error: 'Ошибка создания сообщения' });
  }
});

export default router;
