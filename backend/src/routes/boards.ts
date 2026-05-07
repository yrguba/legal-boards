import { Router, type Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { authenticate, AuthRequest, authorize, requireStaffUser } from '../middleware/auth';
import { assertWorkspaceMember } from '../utils/documentAccess';
import { workspaceAllowsLexIntake } from '../utils/lexIntakeWorkspaces';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

function slugify(input: string) {
  const s = (input || '').trim().toLowerCase();
  if (!s) return 'board';
  return s
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9а-яё-]/gi, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'board';
}

async function generateUniqueBoardCode(name: string) {
  const base = slugify(name);
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = Math.random().toString(36).slice(2, 6);
    const code = `${base}-${suffix}`;
    const exists = await prisma.board.findUnique({ where: { code } }).catch(() => null);
    if (!exists) return code;
  }
  // very unlikely fallback
  return `${base}-${Date.now().toString(36)}`;
}

router.get('/workspace/:workspaceId', async (req: AuthRequest, res) => {
  try {
    if (req.lexClientId) {
      const link = await prisma.lexClientWorkspace.findUnique({
        where: {
          lexClientId_workspaceId: {
            lexClientId: req.lexClientId,
            workspaceId: req.params.workspaceId,
          },
        },
      });
      if (!link && !workspaceAllowsLexIntake(req.params.workspaceId)) {
        return res.status(403).json({ error: 'Нет доступа к этому пространству' });
      }
    }

    const boards = await prisma.board.findMany({
      where: { workspaceId: req.params.workspaceId },
      include: {
        columns: { orderBy: { position: 'asc' } },
        taskFields: { orderBy: { position: 'asc' } },
        taskTypes: true,
        _count: { select: { tasks: true } },
      },
    });

    if (req.lexClientId) {
      const sanitized = boards.map((b) => {
        const { advancedSettings: _a, ...rest } = b as Record<string, unknown>;
        return rest;
      });
      res.json(sanitized);
      return;
    }

    res.json(boards);
  } catch (error) {
    console.error('Get boards error:', error);
    res.status(500).json({ error: 'Ошибка получения досок' });
  }
});

/** Доска: сохранение advancedSettings (admin/manager). PUT/PATCH на …/advanced-settings — надёжнее, чем …/settings (прокси). */
async function handleBoardAdvancedSettings(req: AuthRequest, res: Response) {
  try {
    const idOrCode = (req.params.boardId ?? req.params.id) as string;
    const board = await prisma.board.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode }],
      },
      select: { id: true, workspaceId: true },
    });

    if (!board) {
      return res.status(404).json({ error: 'Доска не найдена' });
    }

    const ok = await assertWorkspaceMember(
      prisma,
      board.workspaceId,
      req.userId!,
      req.userRole,
    );
    if (!ok) {
      return res.status(403).json({ error: 'Нет доступа к этому пространству' });
    }

    const body = req.body as { advancedSettings?: unknown };
    const raw = body.advancedSettings;
    if (raw === undefined) {
      return res.status(400).json({ error: 'Укажите объект advancedSettings' });
    }
    let stored: Record<string, unknown> = {};
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
      stored = { ...(raw as Record<string, unknown>) };
      const services = stored.iframeServices;
      if (Array.isArray(services) && services.length > 40) {
        stored.iframeServices = services.slice(0, 40);
      }
    }

    await prisma.board.update({
      where: { id: board.id },
      data: { advancedSettings: stored as Prisma.InputJsonValue },
    });

    const updated = await prisma.board.findUnique({
      where: { id: board.id },
      include: {
        columns: { orderBy: { position: 'asc' } },
        taskFields: { orderBy: { position: 'asc' } },
        taskTypes: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Patch board settings error:', error);
    res.status(500).json({ error: 'Ошибка сохранения настроек доски' });
  }
}

router.patch(
  '/:boardId/advanced-settings',
  requireStaffUser,
  authorize('admin', 'manager'),
  handleBoardAdvancedSettings,
);
router.put(
  '/:boardId/advanced-settings',
  requireStaffUser,
  authorize('admin', 'manager'),
  handleBoardAdvancedSettings,
);
router.post(
  '/:boardId/advanced-settings',
  requireStaffUser,
  authorize('admin', 'manager'),
  handleBoardAdvancedSettings,
);

/** @deprecated используйте …/advanced-settings */
router.patch(
  '/:id/settings',
  requireStaffUser,
  authorize('admin', 'manager'),
  handleBoardAdvancedSettings,
);
router.put(
  '/:id/settings',
  requireStaffUser,
  authorize('admin', 'manager'),
  handleBoardAdvancedSettings,
);

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const idOrCode = req.params.id;
    const board = await prisma.board.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode }],
      },
      include: {
        columns: { orderBy: { position: 'asc' } },
        taskFields: { orderBy: { position: 'asc' } },
        taskTypes: true,
      },
    });

    if (!board) {
      return res.status(404).json({ error: 'Доска не найдена' });
    }

    if (req.lexClientId) {
      const link = await prisma.lexClientWorkspace.findUnique({
        where: {
          lexClientId_workspaceId: {
            lexClientId: req.lexClientId,
            workspaceId: board.workspaceId,
          },
        },
      });
      if (!link && !workspaceAllowsLexIntake(board.workspaceId)) {
        return res.status(403).json({ error: 'Нет доступа к этой доске' });
      }
      const { advancedSettings: _adv, ...boardForLex } = board as Record<string, unknown>;
      res.json(boardForLex);
      return;
    }

    res.json(board);
  } catch (error) {
    console.error('Get board error:', error);
    res.status(500).json({ error: 'Ошибка получения доски' });
  }
});

router.post('/', requireStaffUser, async (req: AuthRequest, res) => {
  try {
    const {
      code,
      name,
      description,
      workspaceId,
      viewMode,
      visibility,
      attachmentsEnabled,
      columns = [],
      taskFields = [],
      taskTypes = [],
    } = req.body;

    const boardCode = (code && typeof code === 'string' && code.trim()) ? slugify(code) : await generateUniqueBoardCode(name);

    const board = await prisma.board.create({
      data: {
        code: boardCode,
        name,
        description,
        workspaceId,
        viewMode: viewMode || 'kanban',
        visibility: visibility || {},
        attachmentsEnabled: attachmentsEnabled !== undefined ? !!attachmentsEnabled : true,
        columns: {
          create: columns.map((col: any, index: number) => ({
            name: col.name,
            description: col.description,
            position: typeof col.position === 'number' ? col.position : index,
            visibility: col.visibility || {},
            autoAssign: col.autoAssign,
          })),
        },
        taskFields: {
          create: taskFields.map((field: any, index: number) => ({
            name: field.name,
            type: field.type,
            required: field.required,
            options: field.options,
            position: typeof field.position === 'number' ? field.position : index,
          })),
        },
        taskTypes: {
          create: taskTypes.map((type: any) => ({
            name: type.name,
            color: type.color,
            icon: type.icon,
          })),
        },
      },
      include: {
        columns: true,
        taskFields: true,
        taskTypes: true,
      },
    });

    res.json(board);
  } catch (error) {
    console.error('Create board error:', error);
    res.status(500).json({
      error: 'Ошибка создания доски',
      ...(process.env.NODE_ENV !== 'production'
        ? { details: (error as any)?.message, code: (error as any)?.code }
        : {}),
    });
  }
});

router.put('/:id', requireStaffUser, async (req: AuthRequest, res) => {
  try {
    const {
      name,
      description,
      viewMode,
      visibility,
      attachmentsEnabled,
      columns,
      taskFields,
      taskTypes,
    } = req.body;

    const boardId = req.params.id;

    const updatedBoard = await prisma.$transaction(async (tx) => {
      await tx.board.update({
        where: { id: boardId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(viewMode !== undefined ? { viewMode } : {}),
          ...(visibility !== undefined ? { visibility } : {}),
          ...(attachmentsEnabled !== undefined ? { attachmentsEnabled: !!attachmentsEnabled } : {}),
        },
      });

      if (Array.isArray(columns)) {
        const incoming = columns as any[];
        const existing = await tx.boardColumn.findMany({ where: { boardId } });
        const existingById = new Map(existing.map((c) => [c.id, c]));

        // Update existing + create new
        for (let idx = 0; idx < incoming.length; idx++) {
          const col = incoming[idx];
          const position = typeof col.position === 'number' ? col.position : idx;

          if (col.id && existingById.has(col.id)) {
            await tx.boardColumn.update({
              where: { id: col.id },
              data: {
                name: col.name,
                description: col.description,
                position,
                visibility: col.visibility || {},
                autoAssign: col.autoAssign,
              },
            });
          } else {
            await tx.boardColumn.create({
              data: {
                boardId,
                name: col.name,
                description: col.description,
                position,
                visibility: col.visibility || {},
                autoAssign: col.autoAssign,
              },
            });
          }
        }

        // Delete columns that were removed, but only if no tasks reference them
        const incomingIds = new Set(incoming.map((c) => c.id).filter(Boolean));
        const removed = existing.filter((c) => !incomingIds.has(c.id));
        if (removed.length) {
          const counts = await tx.task.groupBy({
            by: ['columnId'],
            where: { boardId, columnId: { in: removed.map((c) => c.id) } },
            _count: { _all: true },
          });
          const inUse = new Set(counts.map((c) => c.columnId));
          const deletable = removed.filter((c) => !inUse.has(c.id));
          if (deletable.length) {
            await tx.boardColumn.deleteMany({ where: { id: { in: deletable.map((c) => c.id) } } });
          }
        }
      }

      if (Array.isArray(taskFields)) {
        const incoming = taskFields as any[];
        await tx.taskField.deleteMany({ where: { boardId } });
        if (incoming.length) {
          await tx.taskField.createMany({
            data: incoming.map((f: any, idx: number) => ({
              boardId,
              name: f.name,
              type: f.type,
              required: !!f.required,
              options: f.options ?? undefined,
              position: typeof f.position === 'number' ? f.position : idx,
            })),
          });
        }
      }

      if (Array.isArray(taskTypes)) {
        const incoming = taskTypes as any[];
        const existing = await tx.taskType.findMany({ where: { boardId } });
        const existingById = new Map(existing.map((t) => [t.id, t]));

        for (const type of incoming) {
          if (type.id && existingById.has(type.id)) {
            await tx.taskType.update({
              where: { id: type.id },
              data: { name: type.name, color: type.color, icon: type.icon },
            });
          } else {
            await tx.taskType.create({
              data: { boardId, name: type.name, color: type.color, icon: type.icon },
            });
          }
        }

        // Delete removed types only if not used by tasks
        const incomingIds = new Set(incoming.map((t) => t.id).filter(Boolean));
        const removed = existing.filter((t) => !incomingIds.has(t.id));
        if (removed.length) {
          const counts = await tx.task.groupBy({
            by: ['typeId'],
            where: { boardId, typeId: { in: removed.map((t) => t.id) } },
            _count: { _all: true },
          });
          const inUse = new Set(counts.map((c) => c.typeId));
          const deletable = removed.filter((t) => !inUse.has(t.id));
          if (deletable.length) {
            await tx.taskType.deleteMany({ where: { id: { in: deletable.map((t) => t.id) } } });
          }
        }
      }

      return tx.board.findUnique({
        where: { id: boardId },
        include: {
          columns: { orderBy: { position: 'asc' } },
          taskFields: { orderBy: { position: 'asc' } },
          taskTypes: true,
        },
      });
    });

    if (!updatedBoard) {
      return res.status(404).json({ error: 'Доска не найдена' });
    }

    res.json(updatedBoard);
  } catch (error) {
    console.error('Update board error:', error);
    res.status(500).json({ error: 'Ошибка обновления доски' });
  }
});

router.post('/:boardId/columns/:columnId/move-tasks', requireStaffUser, async (req: AuthRequest, res) => {
  try {
    const { toColumnId } = req.body as { toColumnId?: string };
    const { boardId, columnId } = req.params;

    if (!toColumnId) {
      return res.status(400).json({ error: 'toColumnId обязателен' });
    }

    if (toColumnId === columnId) {
      return res.status(400).json({ error: 'Нельзя перенести задачи в ту же колонку' });
    }

    // Ensure board + columns belong to this board
    const [from, to] = await Promise.all([
      prisma.boardColumn.findFirst({ where: { id: columnId, boardId } }),
      prisma.boardColumn.findFirst({ where: { id: toColumnId, boardId } }),
    ]);

    if (!from) return res.status(404).json({ error: 'Колонка-источник не найдена' });
    if (!to) return res.status(404).json({ error: 'Колонка-приемник не найдена' });

    const result = await prisma.task.updateMany({
      where: { boardId, columnId },
      data: { columnId: toColumnId },
    });

    res.json({ moved: result.count });
  } catch (error) {
    console.error('Move tasks error:', error);
    res.status(500).json({ error: 'Ошибка переноса задач' });
  }
});

router.post('/:boardId/types/:typeId/move-tasks', requireStaffUser, async (req: AuthRequest, res) => {
  try {
    const { toTypeId } = req.body as { toTypeId?: string };
    const { boardId, typeId } = req.params;

    if (!toTypeId) {
      return res.status(400).json({ error: 'toTypeId обязателен' });
    }

    if (toTypeId === typeId) {
      return res.status(400).json({ error: 'Нельзя перенести задачи в тот же тип' });
    }

    const [from, to] = await Promise.all([
      prisma.taskType.findFirst({ where: { id: typeId, boardId } }),
      prisma.taskType.findFirst({ where: { id: toTypeId, boardId } }),
    ]);

    if (!from) return res.status(404).json({ error: 'Тип-источник не найден' });
    if (!to) return res.status(404).json({ error: 'Тип-приемник не найден' });

    const result = await prisma.task.updateMany({
      where: { boardId, typeId },
      data: { typeId: toTypeId },
    });

    res.json({ moved: result.count });
  } catch (error) {
    console.error('Move tasks by type error:', error);
    res.status(500).json({ error: 'Ошибка переноса задач' });
  }
});

router.delete('/:id', requireStaffUser, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    const idOrCode = req.params.id;
    const existing = await prisma.board.findFirst({
      where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Доска не найдена' });
    }

    await prisma.board.delete({
      where: { id: existing.id },
    });

    res.json({ message: 'Доска удалена' });
  } catch (error) {
    console.error('Delete board error:', error);
    res.status(500).json({ error: 'Ошибка удаления доски' });
  }
});

router.post('/:id/columns', requireStaffUser, async (req: AuthRequest, res) => {
  try {
    const { name, description, position, visibility, autoAssign } = req.body;

    const column = await prisma.boardColumn.create({
      data: {
        boardId: req.params.id,
        name,
        description,
        position,
        visibility: visibility || {},
        autoAssign,
      },
    });

    res.json(column);
  } catch (error) {
    console.error('Create column error:', error);
    res.status(500).json({ error: 'Ошибка создания колонки' });
  }
});

router.put('/columns/:columnId', requireStaffUser, async (req: AuthRequest, res) => {
  try {
    const { name, description, position, visibility, autoAssign } = req.body;

    const column = await prisma.boardColumn.update({
      where: { id: req.params.columnId },
      data: { name, description, position, visibility, autoAssign },
    });

    res.json(column);
  } catch (error) {
    console.error('Update column error:', error);
    res.status(500).json({ error: 'Ошибка обновления колонки' });
  }
});

router.delete('/columns/:columnId', requireStaffUser, async (req: AuthRequest, res) => {
  try {
    await prisma.boardColumn.delete({
      where: { id: req.params.columnId },
    });

    res.json({ message: 'Колонка удалена' });
  } catch (error) {
    console.error('Delete column error:', error);
    res.status(500).json({ error: 'Ошибка удаления колонки' });
  }
});

export default router;
