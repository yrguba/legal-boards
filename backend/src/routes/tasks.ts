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
import {
  applyTimeTrackingColumnMove,
  applyTimeTrackingOnTaskCreate,
  parseBoardTimeTrackingCfg,
} from '../utils/boardTimeTracking';
import { resolveAssigneeFromBoardRules } from '../utils/boardAutoAssignment';
import {
  assertColumnApprovalsComplete,
  canUserApproveRule,
  findApprovalRuleById,
  parseBoardApprovalRules,
} from '../utils/boardApprovals';
import {
  appendTaskToColumn,
  applyTaskOrderInColumn,
  moveTaskToColumnAtPosition,
  reserveTopPositionInColumn,
  TaskPositionError,
} from '../utils/taskPosition';
import {
  assertColumnEnterActionsComplete,
  assertColumnExitActionsComplete,
  findColumnActionRuleById,
  parseBoardColumnActionRules,
  validateConfirmPayload,
  validateFormPayload,
} from '../utils/boardColumnActions';
import {
  ACTIVITY_EVENT_TYPES,
  getTaskActivityFeed,
  resolveUserNames,
  writeActivityLog,
} from '../utils/activityLog';
import { resolveBoardRef } from '../utils/boardResolve';
import {
  assertAggregatedBoardView,
  isAggregatedBoard,
  loadAggregatedSourcesDto,
} from '../utils/aggregatedBoard';
import { enrichTaskWithKey, nextTaskNumber, resolveTaskRef } from '../utils/taskKeys';
import {
  DEFAULT_TASK_PRIORITY,
  parseIncomingPriority,
  taskPriorityValidationError,
} from '../utils/taskPriority';

const router = Router();
const prisma = new PrismaClient();

function normalizeIncomingAssigneeId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length === 0 ? null : t;
}

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

router.param('id', async (req: AuthRequest, res, next, value) => {
  try {
    const resolved = await resolveTaskRef(prisma, value);
    if (!resolved) {
      res.status(404).json({ error: 'Задача не найдена' });
      return;
    }
    req.resolvedTaskId = resolved.taskId;
    req.resolvedTaskKey = resolved.key;
    next();
  } catch (err) {
    next(err);
  }
});

function taskIdParam(req: AuthRequest): string {
  return req.resolvedTaskId ?? req.params.id;
}

function accessCtx(req: AuthRequest) {
  return { userId: req.userId, userRole: req.userRole, lexClientId: req.lexClientId };
}

function normalizeAttachmentPurpose(raw: unknown): 'general' | 'conclusion' {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return s === 'conclusion' ? 'conclusion' : 'general';
}

async function notifyLexClientsConclusion(taskId: string) {
  const t = await prisma.task.findUnique({
    where: { id: taskId },
    select: { lexCreatorId: true },
  });
  if (t?.lexCreatorId) {
    broadcast({
      type: 'task_conclusion_updated',
      taskId,
      lexCreatorId: t.lexCreatorId,
    });
  }
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
  return enrichTaskWithKey(
    {
      ...rest,
      creator:
        creator ??
        (lexCreator
          ? { id: lexCreator.id, name: lexCreator.name, email: lexCreator.email ?? undefined }
          : null),
      lexClientProfile,
    },
    (task.board as { code?: string } | undefined)?.code,
  );
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

function unifyApprovalRow(a: Record<string, unknown>) {
  const approver = a.approver as Record<string, unknown> | null | undefined;
  const { approver: _a, ...rest } = a;
  return {
    ...rest,
    approver: approver ?? null,
  };
}

function unifyActionCompletionRow(a: Record<string, unknown>) {
  const completer = a.completer as Record<string, unknown> | null | undefined;
  const { completer: _c, ...rest } = a;
  return {
    ...rest,
    completer: completer ?? null,
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
    const board = await resolveBoardRef(prisma, req.params.boardId);
    if (!board) {
      return res.status(404).json({ error: 'Доска не найдена' });
    }

    const viewGate = await assertAggregatedBoardView(prisma, req, board);
    if (!viewGate.ok) {
      return res.status(viewGate.status).json({ error: viewGate.error });
    }

    if (isAggregatedBoard(board)) {
      const sources = await loadAggregatedSourcesDto(prisma, board.id);
      const sourceIds = sources.map((s) => s.id);
      if (sourceIds.length === 0) {
        res.json([]);
        return;
      }

      const sourceById = new Map(sources.map((s) => [s.id, s]));
      const columnNameById = new Map<string, string>();
      for (const s of sources) {
        for (const col of s.columns) {
          columnNameById.set(col.id, col.name);
        }
      }

      const tasks = await prisma.task.findMany({
        where: { boardId: { in: sourceIds } },
        include: {
          board: { select: { id: true, code: true, name: true } },
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
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      });

      const payload = tasks.map((t) => {
        const source = sourceById.get(t.boardId);
        const unified = unifyTaskRow(t as Record<string, unknown>);
        return {
          ...unified,
          sourceBoardId: t.boardId,
          sourceBoardCode: t.board.code,
          sourceBoardName: source?.name ?? t.board.name,
          sourceColumnId: t.columnId,
          sourceColumnName: columnNameById.get(t.columnId) ?? '—',
        };
      });

      res.json(payload);
      return;
    }

    const boardWhere = req.lexClientId
      ? { boardId: board.id, lexCreatorId: req.lexClientId }
      : { boardId: board.id };

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
        columnApprovals: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            ruleId: true,
            columnId: true,
            ruleName: true,
            approvedByUserId: true,
            status: true,
            reason: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        columnActionCompletions: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            ruleId: true,
            columnId: true,
            ruleName: true,
            actionKind: true,
            payload: true,
            completedByUserId: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    });

    res.json(tasks.map((t) => enrichTaskWithKey(unifyTaskRow(t as Record<string, unknown>), board.code)));
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
    const taskId = taskIdParam(req);
    const gate = await assertUserCanAccessTask(prisma, taskId, accessCtx(req));
    if (!gate.ok) {
      return res.status(404).json({ error: 'Задача не найдена или нет доступа' });
    }
    let purpose = normalizeAttachmentPurpose((req.body as { purpose?: unknown })?.purpose);
    if (req.lexClientId) {
      purpose = 'general';
    } else if (purpose === 'conclusion' && !req.userId) {
      return res.status(403).json({ error: 'Недостаточно прав' });
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
            purpose: 'general',
          }
        : {
            taskId,
            name: displayName,
            type: req.file.mimetype,
            size: req.file.size,
            path: toPublicUploadPath(req.file.path),
            uploadedBy: req.userId!,
            uploadedByLexClientId: null,
            purpose,
          },
      include: {
        uploader: { select: { id: true, name: true, email: true, avatar: true } },
        lexUploader: { select: { id: true, name: true, email: true } },
      },
    });
    if (purpose === 'conclusion') {
      void notifyLexClientsConclusion(taskId);
    }
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
    const attachmentPurpose = (att.purpose || 'general') as string;
    const staffOk =
      !!req.userId &&
      !req.lexClientId &&
      (req.userRole === 'admin' ||
        att.uploadedBy === req.userId ||
        attachmentPurpose === 'conclusion');
    const lexOk =
      !!req.lexClientId &&
      !!att.uploadedByLexClientId &&
      att.uploadedByLexClientId === req.lexClientId &&
      attachmentPurpose !== 'conclusion';

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
    const wasConclusion = attachmentPurpose === 'conclusion';
    await prisma.taskAttachment.delete({ where: { id: attachmentId } });
    if (wasConclusion) {
      void notifyLexClientsConclusion(taskId);
    }
    return res.json({ message: 'Вложение удалено' });
  } catch (error) {
    console.error('Delete task attachment error:', error);
    return res.status(500).json({ error: 'Ошибка удаления вложения' });
  }
});

/** Текст заключения исполнителя для клиента (LEXPRO и др.). */
router.patch('/:id/conclusion', async (req: AuthRequest, res) => {
  try {
    if (req.lexClientId) {
      return res
        .status(403)
        .json({ error: 'Редактирование заключения доступно только сотрудникам Legal Boards' });
    }

    const taskId = taskIdParam(req);
    const gate = await assertUserCanAccessTask(prisma, taskId, accessCtx(req));
    if (!gate.ok) {
      return res.status(404).json({ error: 'Задача не найдена или нет доступа' });
    }

    if (!Object.prototype.hasOwnProperty.call(req.body, 'conclusionText')) {
      return res.status(400).json({ error: 'Передайте поле conclusionText (строка или null)' });
    }

    const raw = (req.body as { conclusionText?: unknown }).conclusionText;
    let conclusionText: string | null = null;
    if (raw === null || raw === undefined) {
      conclusionText = null;
    } else if (typeof raw === 'string') {
      const trimmed = raw.trim();
      conclusionText = trimmed.length === 0 ? null : trimmed;
    } else {
      return res.status(400).json({ error: 'conclusionText должен быть строкой или null' });
    }

    await prisma.task.update({
      where: { id: taskId },
      data: { conclusionText },
    });
    void notifyLexClientsConclusion(taskId);

    res.json({ conclusionText });
  } catch (error) {
    console.error('Patch task conclusion error:', error);
    res.status(500).json({ error: 'Ошибка сохранения заключения' });
  }
});

/** Unified activity / audit timeline for a task */
router.get('/:id/activity', async (req: AuthRequest, res) => {
  try {
    const taskId = taskIdParam(req);
    const gate = await assertUserCanAccessTask(prisma, taskId, accessCtx(req));
    if (!gate.ok) {
      return res.status(404).json({ error: 'Задача не найдена или нет доступа' });
    }

    const items = await getTaskActivityFeed(prisma, taskId);
    res.json({ items });
  } catch (error) {
    console.error('Get task activity error:', error);
    res.status(500).json({ error: 'Ошибка загрузки истории' });
  }
});

/** История смены колонки и типа: TaskStatusEvent + старые записи Notification */
router.get('/:id/status-history', async (req: AuthRequest, res) => {
  try {
    const taskId = taskIdParam(req);
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

    const taskId = taskIdParam(req);
    const gate = await assertUserCanAccessTask(prisma, taskId, accessCtx(req));
    if (!gate.ok) {
      return res.status(404).json({ error: 'Задача не найдена или нет доступа' });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        board: { select: { code: true } },
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
        columnApprovals: {
          orderBy: { createdAt: 'asc' },
          include: {
            approver: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
        columnActionCompletions: {
          orderBy: { createdAt: 'asc' },
          include: {
            completer: { select: { id: true, name: true, email: true, avatar: true } },
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
      columnApprovals: task.columnApprovals.map((a) =>
        unifyApprovalRow(a as Record<string, unknown>),
      ),
      columnActionCompletions: task.columnActionCompletions.map((a) =>
        unifyActionCompletionRow(a as Record<string, unknown>),
      ),
    });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Ошибка получения задачи' });
  }
});

router.post('/reorder', async (req: AuthRequest, res) => {
  try {
    if (req.lexClientId) {
      return res.status(403).json({ error: 'Сортировка задач доступна только сотрудникам Legal Boards' });
    }
    if (!req.userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const { boardId, columnId, taskIds } = req.body as {
      boardId?: string;
      columnId?: string;
      taskIds?: string[];
    };

    if (!boardId || !columnId || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: 'Укажите boardId, columnId и taskIds' });
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { id: true, workspaceId: true },
    });
    if (!board) {
      return res.status(404).json({ error: 'Доска не найдена' });
    }

    const column = await prisma.boardColumn.findFirst({
      where: { id: columnId, boardId },
      select: { id: true },
    });
    if (!column) {
      return res.status(404).json({ error: 'Колонка не найдена на доске' });
    }

    await applyTaskOrderInColumn(prisma, boardId, columnId, taskIds);
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof TaskPositionError) {
      return res.status(400).json({ error: error.message, code: error.code });
    }
    console.error('Reorder tasks error:', error);
    res.status(500).json({ error: 'Ошибка сортировки задач' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { boardId, columnId, typeId, title, description, assigneeId, customFields, priority } =
      req.body;

    if (req.lexClientId) {
      const board = await prisma.board.findUnique({
        where: { id: boardId },
        select: { workspaceId: true, advancedSettings: true, code: true },
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

      const ttCfgLex = parseBoardTimeTrackingCfg(board.advancedSettings ?? {});
      const ttInitLex = applyTimeTrackingOnTaskCreate(columnId, ttCfgLex, new Date());

      let finalAssigneeLex = await resolveAssigneeFromBoardRules(prisma, {
        boardId,
        workspaceId: board.workspaceId,
        typeId,
        advancedSettings: board.advancedSettings ?? {},
      });

      const lexTaskNumber = await nextTaskNumber(prisma, boardId);

      const lexTask = await prisma.$transaction(async (tx) => {
        const position = await reserveTopPositionInColumn(tx, columnId);
        return tx.task.create({
          data: {
            number: lexTaskNumber,
            boardId,
            columnId,
            typeId,
            title,
            description,
            assigneeId: finalAssigneeLex,
            createdBy: null,
            lexCreatorId: req.lexClientId,
            priority: DEFAULT_TASK_PRIORITY,
            position,
            customFields: customFields || {},
            trackedTimeSeconds: ttInitLex.trackedTimeSeconds,
            timeTrackingActiveSince: ttInitLex.timeTrackingActiveSince,
            timeTrackingCycleOpen: ttInitLex.timeTrackingCycleOpen,
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
      });

      if (finalAssigneeLex) {
        await createAndBroadcastNotification({
          type: 'task_assigned',
          title: 'Назначена задача',
          message: `Вам назначена задача "${title}"`,
          userId: finalAssigneeLex,
          relatedId: lexTask.id,
        });
      }

      return res.json(enrichTaskWithKey(unifyTaskRow(lexTask as Record<string, unknown>), board.code));
    }

    if (!req.userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const priorityErr = taskPriorityValidationError(priority);
    if (priorityErr) {
      return res.status(400).json({ error: priorityErr });
    }
    const staffPriority = parseIncomingPriority(priority);

    const boardRow = await prisma.board.findUnique({
      where: { id: boardId },
      select: { workspaceId: true, advancedSettings: true, code: true, kind: true },
    });
    if (boardRow && isAggregatedBoard(boardRow)) {
      return res.status(400).json({ error: 'Нельзя создавать задачи на сводной доске' });
    }
    const ttCfgCreate = parseBoardTimeTrackingCfg(boardRow?.advancedSettings ?? {});
    const ttInitCreate = applyTimeTrackingOnTaskCreate(columnId, ttCfgCreate, new Date());

    let finalAssigneeId = normalizeIncomingAssigneeId(assigneeId);
    if (!finalAssigneeId && boardRow) {
      finalAssigneeId = await resolveAssigneeFromBoardRules(prisma, {
        boardId,
        workspaceId: boardRow.workspaceId,
        typeId,
        advancedSettings: boardRow.advancedSettings ?? {},
      });
    }

    const taskNumber = await nextTaskNumber(prisma, boardId);

    const task = await prisma.$transaction(async (tx) => {
      const position = await reserveTopPositionInColumn(tx, columnId);
      return tx.task.create({
        data: {
          number: taskNumber,
          boardId,
          columnId,
          typeId,
          title,
          description,
          assigneeId: finalAssigneeId,
          createdBy: req.userId,
          lexCreatorId: null,
          priority: staffPriority,
          position,
          customFields: customFields || {},
          trackedTimeSeconds: ttInitCreate.trackedTimeSeconds,
          timeTrackingActiveSince: ttInitCreate.timeTrackingActiveSince,
          timeTrackingCycleOpen: ttInitCreate.timeTrackingCycleOpen,
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
    });

    if (finalAssigneeId && finalAssigneeId !== req.userId) {
      await createAndBroadcastNotification({
        type: 'task_assigned',
        title: 'Назначена задача',
        message: `Вам назначена задача "${title}"`,
        userId: finalAssigneeId,
        relatedId: task.id,
      });
    }

    res.json(enrichTaskWithKey(unifyTaskRow(task as Record<string, unknown>), boardRow?.code));
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

    const { columnId, typeId, title, description, assigneeId, customFields, priority, position } =
      req.body;

    const data: Prisma.TaskUncheckedUpdateInput = {};
    if (typeId !== undefined) data.typeId = typeId;
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (Object.prototype.hasOwnProperty.call(req.body, 'assigneeId')) {
      data.assigneeId = assigneeId ?? null;
    }
    if (customFields !== undefined) data.customFields = customFields;
    if (priority !== undefined) {
      const priorityErr = taskPriorityValidationError(priority);
      if (priorityErr) {
        return res.status(400).json({ error: priorityErr });
      }
      data.priority = parseIncomingPriority(priority);
    }

    const oldTask = await prisma.task.findUnique({
      where: { id: taskIdParam(req) },
      include: {
        board: { select: { workspaceId: true } },
        _count: { select: { taskAttachments: true } },
      },
    });

    if (!oldTask) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    const hasPosition = typeof position === 'number' && Number.isFinite(position);
    const wantsColumnChange = columnId !== undefined && columnId !== oldTask.columnId;
    const wantsPositionChange = hasPosition && Math.floor(position) !== oldTask.position;
    const needsReorder = wantsColumnChange || wantsPositionChange;

    if (wantsColumnChange) {
      const boardCfgRow = await prisma.board.findUnique({
        where: { id: oldTask.boardId },
        select: {
          advancedSettings: true,
          taskFields: {
            orderBy: { position: 'asc' },
            select: { id: true, name: true, type: true, required: true },
          },
        },
      });
      const advancedSettings = boardCfgRow?.advancedSettings ?? {};
      const boardTaskFields = boardCfgRow?.taskFields ?? [];
      const taskForChecks = {
        ...oldTask,
        title: title !== undefined ? title : oldTask.title,
        assigneeId: Object.prototype.hasOwnProperty.call(req.body, 'assigneeId')
          ? assigneeId ?? null
          : oldTask.assigneeId,
        description: description !== undefined ? description : oldTask.description,
        customFields: customFields !== undefined ? customFields : oldTask.customFields,
      };
      const approvalCheck = await assertColumnApprovalsComplete(
        prisma,
        oldTask.id,
        oldTask.columnId,
        advancedSettings,
      );
      if (!approvalCheck.ok) {
        return res.status(400).json({
          error: approvalCheck.message,
          code: 'approvals_pending',
        });
      }

      const exitActionsCheck = await assertColumnExitActionsComplete(
        prisma,
        taskForChecks,
        advancedSettings,
        boardTaskFields,
      );
      if (!exitActionsCheck.ok) {
        return res.status(400).json({
          error: exitActionsCheck.message,
          code: exitActionsCheck.code ?? 'column_actions_pending',
        });
      }

      const enterActionsCheck = await assertColumnEnterActionsComplete(
        prisma,
        taskForChecks,
        columnId,
        advancedSettings,
        boardTaskFields,
      );
      if (!enterActionsCheck.ok) {
        return res.status(400).json({
          error: enterActionsCheck.message,
          code: enterActionsCheck.code ?? 'column_actions_pending',
        });
      }

      const ttCfg = parseBoardTimeTrackingCfg(advancedSettings);
      if (ttCfg) {
        const nextTt = applyTimeTrackingColumnMove(
          {
            trackedTimeSeconds: oldTask.trackedTimeSeconds,
            timeTrackingActiveSince: oldTask.timeTrackingActiveSince,
            timeTrackingCycleOpen: oldTask.timeTrackingCycleOpen,
          },
          oldTask.columnId,
          columnId,
          ttCfg,
          new Date(),
        );
        data.trackedTimeSeconds = nextTt.trackedTimeSeconds;
        data.timeTrackingActiveSince = nextTt.timeTrackingActiveSince;
        data.timeTrackingCycleOpen = nextTt.timeTrackingCycleOpen;
      }
    }

    if (Object.keys(data).length === 0 && !needsReorder) {
      return res.status(400).json({ error: 'Нет полей для обновления' });
    }

    const taskInclude = {
      type: true,
      assignee: {
        select: { id: true, name: true, email: true, avatar: true },
      },
      taskAttachments: {
        orderBy: { createdAt: 'desc' as const },
        include: {
          uploader: { select: { id: true, name: true, email: true, avatar: true } },
        },
      },
      columnApprovals: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          approver: { select: { id: true, name: true, email: true, avatar: true } },
        },
      },
      columnActionCompletions: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          completer: { select: { id: true, name: true, email: true, avatar: true } },
        },
      },
    };

    let task;
    try {
      if (needsReorder) {
        const toColumnId = columnId ?? oldTask.columnId;
        if (wantsColumnChange) {
          if (hasPosition) {
            await moveTaskToColumnAtPosition(
              prisma,
              oldTask.id,
              oldTask.columnId,
              toColumnId,
              position,
            );
          } else {
            await appendTaskToColumn(prisma, oldTask.id, oldTask.columnId, toColumnId);
          }
        } else if (hasPosition) {
          await moveTaskToColumnAtPosition(
            prisma,
            oldTask.id,
            oldTask.columnId,
            oldTask.columnId,
            position,
          );
        }
      }

      task =
        Object.keys(data).length > 0
          ? await prisma.task.update({
              where: { id: taskIdParam(req) },
              data,
              include: taskInclude,
            })
          : await prisma.task.findUniqueOrThrow({
              where: { id: taskIdParam(req) },
              include: taskInclude,
            });
    } catch (error) {
      if (error instanceof TaskPositionError) {
        return res.status(400).json({ error: error.message, code: error.code });
      }
      throw error;
    }

    if (columnId !== undefined && oldTask.columnId !== columnId) {
      await prisma.taskColumnApproval.deleteMany({
        where: { taskId: task.id, columnId: oldTask.columnId },
      });
      await prisma.taskColumnActionCompletion.deleteMany({
        where: { taskId: task.id, columnId: oldTask.columnId },
      });
    }

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
        try {
          await writeActivityLog(prisma, {
            workspaceId: oldTask.board.workspaceId,
            boardId: oldTask.boardId,
            taskId: task.id,
            eventType: ACTIVITY_EVENT_TYPES.COLUMN_CHANGED,
            actorUserId: req.userId,
            payload: {
              fromColumnId: oldTask.columnId,
              toColumnId: columnId,
              fromColumnName: fromColumn?.name ?? null,
              toColumnName: toColumn.name,
            },
            snapshot: {
              title: task.title,
              assigneeId: task.assigneeId,
            },
            source: typeof req.body?.source === 'string' ? req.body.source : 'api',
          });
        } catch (logErr) {
          console.error('Activity log column_changed error:', logErr);
        }
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

    if (priority !== undefined && oldTask.priority !== task.priority) {
      try {
        await writeActivityLog(prisma, {
          workspaceId: oldTask.board.workspaceId,
          boardId: oldTask.boardId,
          taskId: task.id,
          eventType: ACTIVITY_EVENT_TYPES.PRIORITY_CHANGED,
          actorUserId: req.userId,
          payload: {
            fromPriority: oldTask.priority,
            toPriority: task.priority,
          },
          snapshot: { title: task.title, columnId: task.columnId },
        });
      } catch (logErr) {
        console.error('Activity log priority_changed error:', logErr);
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(req.body, 'assigneeId') &&
      (assigneeId ?? null) !== oldTask.assigneeId
    ) {
      try {
        const nameMap = await resolveUserNames(prisma, [oldTask.assigneeId, assigneeId]);
        await writeActivityLog(prisma, {
          workspaceId: oldTask.board.workspaceId,
          boardId: oldTask.boardId,
          taskId: task.id,
          eventType: ACTIVITY_EVENT_TYPES.ASSIGNEE_CHANGED,
          actorUserId: req.userId,
          payload: {
            fromUserId: oldTask.assigneeId,
            toUserId: assigneeId ?? null,
            fromUserName: oldTask.assigneeId ? nameMap.get(oldTask.assigneeId) ?? null : null,
            toUserName: assigneeId ? nameMap.get(assigneeId) ?? null : null,
          },
          snapshot: { title: task.title, columnId: task.columnId },
        });
      } catch (logErr) {
        console.error('Activity log assignee_changed error:', logErr);
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

    res.json({
      ...task,
      columnApprovals:
        columnId !== undefined && oldTask.columnId !== columnId
          ? task.columnApprovals.filter((a) => a.columnId !== oldTask.columnId)
          : task.columnApprovals,
      columnActionCompletions:
        columnId !== undefined && oldTask.columnId !== columnId
          ? task.columnActionCompletions.filter((a) => a.columnId !== oldTask.columnId)
          : task.columnActionCompletions,
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Ошибка обновления задачи' });
  }
});

router.post('/:id/approvals', async (req: AuthRequest, res) => {
  try {
    if (req.lexClientId) {
      return res.status(403).json({ error: 'Согласование доступно только сотрудникам Legal Boards' });
    }
    if (!req.userId) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const taskId = taskIdParam(req);
    const gate = await assertUserCanAccessTask(prisma, taskId, accessCtx(req));
    if (!gate.ok) {
      return res.status(404).json({ error: 'Задача не найдена или нет доступа' });
    }

    const { ruleId, action, reason } = req.body as {
      ruleId?: unknown;
      action?: unknown;
      reason?: unknown;
    };
    if (typeof ruleId !== 'string' || !ruleId.trim()) {
      return res.status(400).json({ error: 'Укажите ruleId' });
    }

    const decision = action === 'reject' ? 'rejected' : 'approved';
    const reasonText = typeof reason === 'string' ? reason.trim() : '';
    if (decision === 'rejected' && !reasonText) {
      return res.status(400).json({ error: 'Укажите причину отклонения' });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, columnId: true, boardId: true, title: true, board: { select: { workspaceId: true } } },
    });
    if (!task) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    const board = await prisma.board.findUnique({
      where: { id: task.boardId },
      select: { advancedSettings: true },
    });
    const rules = parseBoardApprovalRules(board?.advancedSettings ?? {});
    const rule = findApprovalRuleById(rules, ruleId.trim());
    if (!rule || rule.columnId !== task.columnId) {
      return res.status(400).json({ error: 'Правило согласования не применимо к текущему статусу задачи' });
    }

    if (!canUserApproveRule(rule, req.userId)) {
      return res.status(403).json({ error: 'Нет прав на решение по этому правилу согласования' });
    }

    const approval = await prisma.taskColumnApproval.upsert({
      where: { taskId_ruleId: { taskId, ruleId: rule.id } },
      create: {
        taskId,
        ruleId: rule.id,
        columnId: task.columnId,
        ruleName: rule.name,
        approvedByUserId: req.userId,
        status: decision,
        reason: decision === 'rejected' ? reasonText : null,
      },
      update: {
        columnId: task.columnId,
        ruleName: rule.name,
        approvedByUserId: req.userId,
        status: decision,
        reason: decision === 'rejected' ? reasonText : null,
      },
      include: {
        approver: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    broadcast({
      type: 'task_approval_updated',
      taskId,
      approval: unifyApprovalRow(approval as Record<string, unknown>),
    });

    try {
      await writeActivityLog(prisma, {
        workspaceId: task.board.workspaceId,
        boardId: task.boardId,
        taskId,
        eventType: ACTIVITY_EVENT_TYPES.APPROVAL_DECIDED,
        actorUserId: req.userId,
        payload: {
          ruleId: rule.id,
          ruleName: rule.name,
          columnId: task.columnId,
          decision,
          reason: decision === 'rejected' ? reasonText : null,
        },
        snapshot: { title: task.title, columnId: task.columnId },
      });
    } catch (logErr) {
      console.error('Activity log approval_decided error:', logErr);
    }

    res.status(201).json(unifyApprovalRow(approval as Record<string, unknown>));
  } catch (error) {
    console.error('Task approval error:', error);
    res.status(500).json({ error: 'Ошибка согласования' });
  }
});

router.post('/:id/column-actions', async (req: AuthRequest, res) => {
  try {
    if (req.lexClientId) {
      return res.status(403).json({ error: 'Действия доступны только сотрудникам Legal Boards' });
    }
    if (!req.userId) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const taskId = taskIdParam(req);
    const gate = await assertUserCanAccessTask(prisma, taskId, accessCtx(req));
    if (!gate.ok) {
      return res.status(404).json({ error: 'Задача не найдена или нет доступа' });
    }

    const { ruleId, payload, forColumnId } = req.body as {
      ruleId?: unknown;
      payload?: unknown;
      forColumnId?: unknown;
    };
    if (typeof ruleId !== 'string' || !ruleId.trim()) {
      return res.status(400).json({ error: 'Укажите ruleId' });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { _count: { select: { taskAttachments: true } } },
    });
    if (!task) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    const board = await prisma.board.findUnique({
      where: { id: task.boardId },
      select: { advancedSettings: true, workspaceId: true },
    });
    const rules = parseBoardColumnActionRules(board?.advancedSettings ?? {});
    const rule = findColumnActionRuleById(rules, ruleId.trim());
    if (!rule) {
      return res.status(400).json({ error: 'Правило действия не найдено' });
    }

    if (rule.actionKind === 'check_task') {
      return res.status(400).json({ error: 'Проверка задачи выполняется автоматически при смене статуса' });
    }

    const targetColumn =
      typeof forColumnId === 'string' && forColumnId.trim() ? forColumnId.trim() : task.columnId;

    if (targetColumn !== rule.columnId) {
      return res.status(400).json({ error: 'Правило не применимо к указанной колонке' });
    }

    if (rule.trigger === 'on_exit' && task.columnId !== rule.columnId) {
      return res.status(400).json({ error: 'Действие при выходе доступно только в текущей колонке' });
    }

    if (rule.trigger === 'on_enter' && task.columnId !== rule.columnId && targetColumn !== rule.columnId) {
      return res.status(400).json({ error: 'Действие при входе не применимо' });
    }

    let storedPayload: Record<string, unknown> = {};
    if (rule.actionKind === 'confirm') {
      const v = validateConfirmPayload(rule, payload);
      if (!v.ok) return res.status(400).json({ error: v.message });
      storedPayload = {
        confirmed: true,
        checkboxConfirmed:
          payload && typeof payload === 'object'
            ? (payload as Record<string, unknown>).checkboxConfirmed === true
            : false,
      };
    } else if (rule.actionKind === 'form') {
      const v = validateFormPayload(rule, payload);
      if (!v.ok) return res.status(400).json({ error: v.message });
      storedPayload = v.data;
    }

    const completion = await prisma.taskColumnActionCompletion.upsert({
      where: { taskId_ruleId: { taskId, ruleId: rule.id } },
      create: {
        taskId,
        ruleId: rule.id,
        columnId: rule.columnId,
        ruleName: rule.name,
        actionKind: rule.actionKind,
        payload: storedPayload as Prisma.InputJsonValue,
        completedByUserId: req.userId,
      },
      update: {
        columnId: rule.columnId,
        ruleName: rule.name,
        actionKind: rule.actionKind,
        payload: storedPayload as Prisma.InputJsonValue,
        completedByUserId: req.userId,
      },
      include: {
        completer: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    broadcast({
      type: 'task_column_action_updated',
      taskId,
      completion: unifyActionCompletionRow(completion as Record<string, unknown>),
    });

    if (board) {
      try {
        await writeActivityLog(prisma, {
          workspaceId: board.workspaceId,
          boardId: task.boardId,
          taskId,
          eventType: ACTIVITY_EVENT_TYPES.COLUMN_ACTION_COMPLETED,
          actorUserId: req.userId,
          payload: {
            ruleId: rule.id,
            ruleName: rule.name,
            columnId: rule.columnId,
            actionKind: rule.actionKind,
            trigger: rule.trigger,
            formPayload: rule.actionKind === 'form' ? storedPayload : undefined,
          },
          snapshot: { title: task.title, columnId: task.columnId },
        });
      } catch (logErr) {
        console.error('Activity log column_action_completed error:', logErr);
      }
    }

    res.status(201).json(unifyActionCompletionRow(completion as Record<string, unknown>));
  } catch (error) {
    console.error('Task column action error:', error);
    res.status(500).json({ error: 'Ошибка выполнения действия' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    if (req.lexClientId) {
      return res.status(403).json({ error: 'Удаление задачи доступно только сотрудникам Legal Boards' });
    }

    await prisma.task.delete({
      where: { id: taskIdParam(req) },
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
        taskId: taskIdParam(req),
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
      where: { id: taskIdParam(req) },
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
            relatedId: taskIdParam(req),
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
    const task = await prisma.task.findUnique({ where: { id: taskIdParam(req) } });
    if (!task) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    const occurred = occurredAt ? new Date(occurredAt) : new Date();
    if (Number.isNaN(occurred.getTime())) {
      return res.status(400).json({ error: 'Некорректная дата' });
    }

    const interaction = await prisma.taskClientInteraction.create({
      data: {
        taskId: taskIdParam(req),
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

    const taskId = taskIdParam(req);
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
      const detail = e instanceof Error ? e.message : 'Ошибка Groq';
      console.error('Groq assistant error:', e);
      // 503 — сбой внешнего провайдера LLM (не путать с 502 от nginx «upstream недоступен»).
      return res.status(503).json({
        error: 'Ассистент временно недоступен',
        details: detail,
      });
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
    const taskId = taskIdParam(req);
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
