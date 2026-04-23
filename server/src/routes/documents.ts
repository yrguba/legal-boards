import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ storage });

router.use(authenticateToken);

router.get('/workspace/:workspaceId', async (req: AuthRequest, res) => {
  try {
    const documents = await prisma.document.findMany({
      where: { workspaceId: req.params.workspaceId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        visibility: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    res.json(documents);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Ошибка получения документов' });
  }
});

router.post('/upload', upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не предоставлен' });
    }

    const { workspaceId, visibility } = req.body;
    const visibilityData = JSON.parse(visibility);

    const document = await prisma.document.create({
      data: {
        name: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        workspaceId,
        uploadedById: req.userId!,
        visibility: {
          create: visibilityData.groups?.map((groupId: string) => ({
            groupId,
          })) || [],
        },
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        visibility: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
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

    if (fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }

    await prisma.document.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Документ удален' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Ошибка удаления документа' });
  }
});

export default router;
