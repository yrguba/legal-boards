import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, requireStaffUser } from '../middleware/auth';
import { assertWorkspaceMember } from '../utils/documentAccess';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);
router.use(requireStaffUser);

async function guardWorkspace(
  req: AuthRequest,
  workspaceId: string
): Promise<boolean> {
  return assertWorkspaceMember(prisma, workspaceId, req.userId!, req.userRole);
}

async function belongsToWorkspace(articleId: string, workspaceId: string): Promise<boolean> {
  const row = await prisma.knowledgeArticle.findUnique({
    where: { id: articleId },
    select: { workspaceId: true },
  });
  return row?.workspaceId === workspaceId;
}

async function wouldCreateCycle(
  articleId: string,
  proposedParentId: string | null
): Promise<boolean> {
  let current: string | null = proposedParentId;
  while (current) {
    if (current === articleId) return true;
    const row = await prisma.knowledgeArticle.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = row?.parentId ?? null;
  }
  return false;
}

/** GET /workspaces/:workspaceId/knowledge-articles */
router.get('/workspaces/:workspaceId/knowledge-articles', async (req: AuthRequest, res) => {
  try {
    const { workspaceId } = req.params;
    if (!(await guardWorkspace(req, workspaceId))) {
      return res.status(404).json({ error: 'Пространство не найдено или нет доступа' });
    }
    const rows = await prisma.knowledgeArticle.findMany({
      where: { workspaceId },
      orderBy: [{ position: 'asc' }, { title: 'asc' }],
      select: {
        id: true,
        workspaceId: true,
        parentId: true,
        title: true,
        body: true,
        position: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json(rows);
  } catch (error) {
    console.error('Knowledge list error:', error);
    res.status(500).json({ error: 'Не удалось загрузить базу знаний' });
  }
});

/** GET /knowledge-articles/:id */
router.get('/knowledge-articles/:id', async (req: AuthRequest, res) => {
  try {
    const row = await prisma.knowledgeArticle.findUnique({
      where: { id: req.params.id },
    });
    if (!row) {
      return res.status(404).json({ error: 'Страница не найдена' });
    }
    if (!(await guardWorkspace(req, row.workspaceId))) {
      return res.status(404).json({ error: 'Страница не найдена' });
    }
    res.json(row);
  } catch (error) {
    console.error('Knowledge get error:', error);
    res.status(500).json({ error: 'Ошибка загрузки страницы' });
  }
});

/** POST /workspaces/:workspaceId/knowledge-articles */
router.post('/workspaces/:workspaceId/knowledge-articles', async (req: AuthRequest, res) => {
  try {
    const { workspaceId } = req.params;
    if (!(await guardWorkspace(req, workspaceId))) {
      return res.status(404).json({ error: 'Пространство не найдено или нет доступа' });
    }
    const rawTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const title = rawTitle || 'Без названия';
    const body = typeof req.body?.body === 'string' ? req.body.body : '';
    const parentId = req.body?.parentId === null || req.body?.parentId === undefined ? null : String(req.body.parentId);

    if (parentId) {
      const ok = await belongsToWorkspace(parentId, workspaceId);
      if (!ok) {
        return res.status(400).json({ error: 'Некорректный родительский раздел' });
      }
    }

    const agg = await prisma.knowledgeArticle.aggregate({
      where: { workspaceId, parentId: parentId ?? null },
      _max: { position: true },
    });
    const position = (agg._max.position ?? -1) + 1;

    const created = await prisma.knowledgeArticle.create({
      data: {
        workspaceId,
        parentId,
        title,
        body,
        position,
        createdById: req.userId!,
      },
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Knowledge create error:', error);
    res.status(500).json({ error: 'Не удалось создать страницу' });
  }
});

/** PUT /knowledge-articles/:id */
router.put('/knowledge-articles/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.knowledgeArticle.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Страница не найдена' });
    }
    if (!(await guardWorkspace(req, existing.workspaceId))) {
      return res.status(404).json({ error: 'Страница не найдена' });
    }

    const nextTitle =
      typeof req.body?.title === 'string' ? req.body.title.trim() : existing.title;
    const nextBody =
      typeof req.body?.body === 'string' ? req.body.body : existing.body;
    let nextParentId = existing.parentId;
    if ('parentId' in (req.body ?? {})) {
      const v = req.body.parentId;
      nextParentId = v === null || v === '' ? null : String(v);
      if (nextParentId) {
        const ok =
          (await belongsToWorkspace(nextParentId, existing.workspaceId)) && nextParentId !== existing.id;
        if (!ok) {
          return res.status(400).json({ error: 'Некорректный родительский раздел' });
        }
      }
      if (nextParentId && (await wouldCreateCycle(existing.id, nextParentId))) {
        return res.status(400).json({ error: 'Нельзя переместить страницу под дочернюю' });
      }
    }

    const updated = await prisma.knowledgeArticle.update({
      where: { id: existing.id },
      data: {
        title: nextTitle || 'Без названия',
        body: nextBody,
        parentId: nextParentId,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Knowledge update error:', error);
    res.status(500).json({ error: 'Не удалось сохранить' });
  }
});

/** DELETE /knowledge-articles/:id */
router.delete('/knowledge-articles/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.knowledgeArticle.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Страница не найдена' });
    }
    if (!(await guardWorkspace(req, existing.workspaceId))) {
      return res.status(404).json({ error: 'Страница не найдена' });
    }

    await prisma.knowledgeArticle.delete({
      where: { id: existing.id },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Knowledge delete error:', error);
    res.status(500).json({ error: 'Не удалось удалить' });
  }
});

export default router;
