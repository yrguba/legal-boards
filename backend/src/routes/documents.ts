import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import { authenticate, AuthRequest } from '../middleware/auth';
import { broadcast } from '../index';

const router = Router();
const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authenticate);

router.get('/workspace/:workspaceId', async (req: AuthRequest, res) => {
  try {
    const taskId = typeof req.query.taskId === 'string' ? req.query.taskId : undefined;

    const documents = await prisma.document.findMany({
      where: taskId
        ? {
            workspaceId: req.params.workspaceId,
            OR: [
              { visibility: { path: ['type'], equals: 'workspace' } },
              {
                AND: [
                  { visibility: { path: ['type'], equals: 'task' } },
                  { visibility: { path: ['taskId'], equals: taskId } },
                ],
              },
            ],
          }
        : { workspaceId: req.params.workspaceId },
      include: {
        uploader: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    res.json(documents);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Ошибка получения документов' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        uploader: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!document) {
      return res.status(404).json({ error: 'Документ не найден' });
    }

    res.json(document);
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Ошибка получения документа' });
  }
});

router.post('/upload', upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не предоставлен' });
    }

    const { workspaceId, visibility } = req.body;

    const document = await prisma.document.create({
      data: {
        name: req.file.originalname,
        type: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        uploadedBy: req.userId!,
        workspaceId,
        visibility: visibility ? JSON.parse(visibility) : { type: 'workspace' },
      },
      include: {
        uploader: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await prisma.notification.create({
      data: {
        type: 'document',
        title: 'Новый документ',
        message: `Загружен новый документ "${req.file.originalname}"`,
        userId: req.userId!,
        relatedId: document.id,
      },
    });

    broadcast({
      type: 'document_uploaded',
      workspaceId,
      document,
    });

    res.json(document);
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ error: 'Ошибка загрузки документа' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
    });

    if (!document) {
      return res.status(404).json({ error: 'Документ не найден' });
    }

    if (document.uploadedBy !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const docId = req.params.id;

    const tasksWithDoc = await prisma.task.findMany({
      where: { attachments: { array_contains: [docId] } },
      select: { id: true, attachments: true },
    });

    await prisma.$transaction([
      ...tasksWithDoc.map((t) => {
        const arr = Array.isArray(t.attachments) ? (t.attachments as any[]) : [];
        const next = arr.filter((x) => x !== docId);
        return prisma.task.update({
          where: { id: t.id },
          data: { attachments: next },
        });
      }),
      prisma.document.delete({
        where: { id: docId },
      }),
    ]);

    res.json({ message: 'Документ удален' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Ошибка удаления документа' });
  }
});

export default router;
