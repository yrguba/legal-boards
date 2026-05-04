import { Router } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { authenticate, AuthRequest, requireStaffUser } from '../middleware/auth';
import { broadcast } from '../realtime';
import { getUploadsPath, toPublicUploadPath } from '../uploadsPath';
import { decodeMultipartFilename } from '../utils/decodeMultipartFilename';
import {
  assertWorkspaceMember,
  canSeeDocument,
  getUserDocumentAccess,
  validateVisibilityPayload,
} from '../utils/documentAccess';

const router = Router();
const prisma = new PrismaClient();

const storage = multer.diskStorage({
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
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authenticate);
router.use(requireStaffUser);

router.get('/workspace/:workspaceId', async (req: AuthRequest, res) => {
  try {
    const workspaceId = req.params.workspaceId;

    if (!(await assertWorkspaceMember(prisma, workspaceId, req.userId!, req.userRole))) {
      return res.status(403).json({ error: 'Нет доступа к пространству' });
    }

    const access = await getUserDocumentAccess(prisma, req.userId!, workspaceId);

    const documents = await prisma.document.findMany({
      where: { workspaceId },
      include: {
        uploader: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    const filtered = documents.filter((d) => canSeeDocument(d.visibility, d.uploadedBy, access));

    res.json(filtered);
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

    if (!(await assertWorkspaceMember(prisma, document.workspaceId, req.userId!, req.userRole))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const access = await getUserDocumentAccess(prisma, req.userId!, document.workspaceId);

    if (!canSeeDocument(document.visibility, document.uploadedBy, access)) {
      return res.status(403).json({ error: 'Нет доступа к документу' });
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
    if (!workspaceId) {
      return res.status(400).json({ error: 'Укажите пространство' });
    }
    if (!(await assertWorkspaceMember(prisma, workspaceId, req.userId!, req.userRole))) {
      return res.status(403).json({ error: 'Нет доступа к пространству' });
    }

    let visObj: Record<string, unknown> = { type: 'workspace' };
    if (visibility) {
      try {
        visObj = typeof visibility === 'string' ? (JSON.parse(visibility) as Record<string, unknown>) : (visibility as Record<string, unknown>);
      } catch {
        return res.status(400).json({ error: 'Некорректные настройки доступа' });
      }
    }
    const validated = await validateVisibilityPayload(prisma, workspaceId, visObj);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }

    const displayName = decodeMultipartFilename(req.file.originalname);

    const document = await prisma.document.create({
      data: {
        name: displayName,
        type: req.file.mimetype,
        size: req.file.size,
        path: toPublicUploadPath(req.file.path),
        uploadedBy: req.userId!,
        workspaceId,
        visibility: visObj as Prisma.InputJsonValue,
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
        message: `Загружен новый документ "${displayName}"`,
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

    try {
      const fp = path.join(getUploadsPath(), path.basename(document.path));
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch {
      /* ignore */
    }

    await prisma.document.delete({
      where: { id: docId },
    });

    res.json({ message: 'Документ удален' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Ошибка удаления документа' });
  }
});

export default router;
