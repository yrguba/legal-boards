import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, requireStaffUser } from '../middleware/auth';
import { getUploadsPath, toPublicUploadPath } from '../uploadsPath';
import { decodeMultipartFilename } from '../utils/decodeMultipartFilename';
import {
  assertFeedbackRateLimit,
  getFeedbackMaxAttachmentBytes,
  getFeedbackMaxAttachments,
  isFeedbackCategory,
  isFeedbackEnabled,
  mapFeedbackTicket,
  sendFeedbackNotifyEmail,
} from '../utils/feedback';
import { assertWorkspaceMemberUser } from '../utils/userPresence';

const router = Router();
const prisma = new PrismaClient();

const ticketInclude = {
  user: { select: { id: true, name: true, email: true } },
  workspace: { select: { id: true, name: true } },
  attachments: { orderBy: { createdAt: 'asc' as const } },
} as const;

const feedbackUpload = multer({
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
      cb(null, 'fb-' + uniqueSuffix + ext);
    },
  }),
  limits: { fileSize: getFeedbackMaxAttachmentBytes() },
});

router.use(authenticate);
router.use(requireStaffUser);

router.use((_req, res, next) => {
  if (!isFeedbackEnabled()) {
    return res.status(403).json({ error: 'Обратная связь отключена' });
  }
  next();
});

router.get('/mine', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(403).json({ error: 'Недостаточно прав' });

    const rows = await prisma.feedbackTicket.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        workspace: { select: { id: true, name: true } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    });

    res.json({ tickets: rows.map((r) => mapFeedbackTicket(r)) });
  } catch (error) {
    console.error('List my feedback error:', error);
    res.status(500).json({ error: 'Ошибка загрузки обращений' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(403).json({ error: 'Недостаточно прав' });

    const row = await prisma.feedbackTicket.findUnique({
      where: { id: req.params.id },
      include: ticketInclude,
    });
    if (!row) return res.status(404).json({ error: 'Обращение не найдено' });
    if (row.userId !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    res.json(mapFeedbackTicket(row));
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ error: 'Ошибка загрузки обращения' });
  }
});

router.post('/', feedbackUpload.array('files', getFeedbackMaxAttachments()), async (req: AuthRequest, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];

  try {
    if (!req.userId) return res.status(403).json({ error: 'Недостаточно прав' });

    const rate = await assertFeedbackRateLimit(prisma, req.userId);
    if (!rate.ok) return res.status(429).json({ error: rate.error });

    const category =
      typeof req.body?.category === 'string' ? req.body.category.trim() : '';
    const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
    const description =
      typeof req.body?.description === 'string' ? req.body.description.trim() : '';

    if (!isFeedbackCategory(category)) {
      return res.status(400).json({ error: 'Некорректный тип обращения' });
    }
    if (!subject || subject.length > 200) {
      return res.status(400).json({ error: 'Тема обязательна (до 200 символов)' });
    }
    if (!description || description.length > 8000) {
      return res.status(400).json({ error: 'Описание обязательно (до 8000 символов)' });
    }

    const workspaceId =
      typeof req.body?.workspaceId === 'string' && req.body.workspaceId.trim()
        ? req.body.workspaceId.trim()
        : null;
    if (workspaceId && !(await assertWorkspaceMemberUser(prisma, workspaceId, req.userId))) {
      return res.status(400).json({ error: 'Пространство не найдено' });
    }

    const includeContext = req.body?.includeContext !== 'false';
    const pageUrl =
      includeContext && typeof req.body?.pageUrl === 'string'
        ? req.body.pageUrl.trim().slice(0, 500)
        : null;
    const userAgent =
      includeContext && typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent'].slice(0, 500)
        : null;

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true },
    });
    if (!user) return res.status(403).json({ error: 'Пользователь не найден' });

    const workspace = workspaceId
      ? await prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { id: true, name: true },
        })
      : null;

    const ticket = await prisma.feedbackTicket.create({
      data: {
        category,
        subject,
        description,
        userId: req.userId,
        workspaceId,
        pageUrl: pageUrl || null,
        userAgent,
        ...(files.length > 0
          ? {
              attachments: {
                create: files.map((file) => ({
                  name: decodeMultipartFilename(file.originalname),
                  type: file.mimetype,
                  size: file.size,
                  path: toPublicUploadPath(file.path),
                })),
              },
            }
          : {}),
      },
      include: ticketInclude,
    });

    try {
      await sendFeedbackNotifyEmail({
        ticketId: ticket.id,
        category: ticket.category,
        subject: ticket.subject,
        description: ticket.description,
        userName: user.name,
        userEmail: user.email,
        workspaceName: workspace?.name ?? null,
        pageUrl: ticket.pageUrl,
        attachments: ticket.attachments.map((a) => ({
          name: a.name,
          type: a.type,
          path: a.path,
        })),
      });
    } catch (mailErr) {
      console.error('Feedback notify email error:', mailErr);
    }

    res.status(201).json({
      message: `Обращение #${ticket.id.slice(-8).toUpperCase()} принято. Спасибо!`,
      ticket: mapFeedbackTicket(ticket),
    });
  } catch (error) {
    for (const file of files) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        /* ignore */
      }
    }
    console.error('Create feedback error:', error);
    res.status(500).json({ error: 'Не удалось отправить обращение' });
  }
});

export default router;
