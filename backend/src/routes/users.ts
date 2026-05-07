import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, authorize, requireStaffUser } from '../middleware/auth';
import bcrypt from 'bcryptjs';
import { broadcast } from '../realtime';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);
router.use(requireStaffUser);

router.get('/workspace/:workspaceId/clients', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const workspaceId = req.params.workspaceId;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, ownerId: true },
    });

    if (!workspace) {
      return res.status(404).json({ error: 'Рабочее пространство не найдено' });
    }

    const isMember = await prisma.workspaceUser.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: req.userId } },
      select: { id: true },
    });
    if (!isMember && workspace.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const canManageClients =
      workspace.ownerId === req.userId ||
      req.userRole === 'admin' ||
      req.userRole === 'manager';

    if (!canManageClients) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const rows = await prisma.lexClientWorkspace.findMany({
      where: { workspaceId },
      include: {
        lexClient: {
          select: {
            id: true,
            email: true,
            name: true,
            clientKind: true,
            companyName: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(
      rows.map((r) => ({
        ...r.lexClient,
        workspaceLinkedAt: r.createdAt,
      })),
    );
  } catch (error) {
    console.error('Get workspace LEXPRO clients error:', error);
    res.status(500).json({ error: 'Ошибка получения клиентов' });
  }
});

/** Каталог LEXPRO: клиенты, запросы (задачи) и взаимодействия по пространству; query: q, minTasks, maxTasks, typeId */
router.get('/workspace/:workspaceId/lex-directory', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const workspaceId = req.params.workspaceId;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, ownerId: true },
    });

    if (!workspace) {
      return res.status(404).json({ error: 'Рабочее пространство не найдено' });
    }

    const isMember = await prisma.workspaceUser.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: req.userId } },
      select: { id: true },
    });
    if (!isMember && workspace.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const canManageClients =
      workspace.ownerId === req.userId ||
      req.userRole === 'admin' ||
      req.userRole === 'manager';

    if (!canManageClients) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const qRaw = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const minRaw = req.query.minTasks != null && String(req.query.minTasks) !== ''
      ? parseInt(String(req.query.minTasks), 10)
      : null;
    const maxRaw = req.query.maxTasks != null && String(req.query.maxTasks) !== ''
      ? parseInt(String(req.query.maxTasks), 10)
      : null;
    const typeId =
      typeof req.query.typeId === 'string' && req.query.typeId.trim() ? req.query.typeId.trim() : null;

    const boards = await prisma.board.findMany({
      where: { workspaceId },
      select: { id: true },
    });
    const boardIds = boards.map((b) => b.id);

    const links = await prisma.lexClientWorkspace.findMany({
      where: { workspaceId },
      include: {
        lexClient: {
          select: {
            id: true,
            email: true,
            name: true,
            clientKind: true,
            companyName: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const lexIds = links.map((l) => l.lexClientId);

    const tasks =
      lexIds.length === 0 || boardIds.length === 0
        ? []
        : await prisma.task.findMany({
            where: {
              boardId: { in: boardIds },
              lexCreatorId: { in: lexIds },
            },
            include: {
              type: { select: { id: true, name: true } },
              board: { select: { id: true, name: true } },
              clientInteractions: {
                orderBy: { occurredAt: 'desc' },
                include: {
                  user: { select: { id: true, name: true, avatar: true } },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          });

    const tasksByLex = new Map<string, typeof tasks>();
    for (const t of tasks) {
      if (!t.lexCreatorId) continue;
      const list = tasksByLex.get(t.lexCreatorId) ?? [];
      list.push(t);
      tasksByLex.set(t.lexCreatorId, list);
    }

    const serviceTypesMap = new Map<string, string>();
    for (const t of tasks) {
      serviceTypesMap.set(t.type.id, t.type.name);
    }
    const serviceTypes = [...serviceTypesMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    type OutIx = {
      id: string;
      taskId: string;
      taskTitle: string;
      boardId: string;
      boardName: string;
      kind: string;
      title: string;
      details: string | null;
      occurredAt: string;
      createdAt: string;
      user: { id: string; name: string; avatar: string | null };
      taskTypeId: string;
      taskTypeName: string;
    };

    let clientsOut = links.map((r) => {
      const lc = r.lexClient;
      const lt = tasksByLex.get(lc.id) ?? [];
      const taskSummaries = lt.map((t) => ({
        id: t.id,
        title: t.title,
        boardId: t.board.id,
        boardName: t.board.name,
        typeId: t.type.id,
        typeName: t.type.name,
        createdAt: t.createdAt.toISOString(),
      }));
      const interactions: OutIx[] = [];
      for (const t of lt) {
        for (const ci of t.clientInteractions) {
          interactions.push({
            id: ci.id,
            taskId: t.id,
            taskTitle: t.title,
            boardId: t.board.id,
            boardName: t.board.name,
            kind: ci.kind,
            title: ci.title,
            details: ci.details,
            occurredAt: ci.occurredAt.toISOString(),
            createdAt: ci.createdAt.toISOString(),
            user: ci.user,
            taskTypeId: t.type.id,
            taskTypeName: t.type.name,
          });
        }
      }
      interactions.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

      return {
        id: lc.id,
        email: lc.email,
        name: lc.name,
        clientKind: lc.clientKind,
        companyName: lc.companyName,
        createdAt: lc.createdAt.toISOString(),
        workspaceLinkedAt: r.createdAt.toISOString(),
        taskCount: lt.length,
        tasks: taskSummaries,
        interactions,
      };
    });

    if (qRaw) {
      clientsOut = clientsOut.filter((c) => {
        const name = (c.name || '').toLowerCase();
        const comp = (c.companyName || '').toLowerCase();
        return name.includes(qRaw) || comp.includes(qRaw);
      });
    }
    if (minRaw != null && !Number.isNaN(minRaw)) {
      clientsOut = clientsOut.filter((c) => c.taskCount >= minRaw);
    }
    if (maxRaw != null && !Number.isNaN(maxRaw)) {
      clientsOut = clientsOut.filter((c) => c.taskCount <= maxRaw);
    }
    if (typeId) {
      clientsOut = clientsOut.filter((c) => c.tasks.some((t) => t.typeId === typeId));
    }

    res.json({ serviceTypes, clients: clientsOut });
  } catch (error) {
    console.error('Get lex directory error:', error);
    res.status(500).json({ error: 'Ошибка загрузки каталога LEXPRO' });
  }
});

router.get('/workspace/:workspaceId', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const workspaceId = req.params.workspaceId;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, ownerId: true },
    });

    if (!workspace) {
      return res.status(404).json({ error: 'Рабочее пространство не найдено' });
    }

    // Only members can see users in workspace
    const isMember = await prisma.workspaceUser.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: req.userId! } },
      select: { id: true },
    });
    if (!isMember && workspace.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const memberships = await prisma.workspaceUser.findMany({
      where: { workspaceId },
      select: { userId: true },
    });

    const userIds = Array.from(new Set([workspace.ownerId, ...memberships.map((m) => m.userId)]));

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        departmentId: true,
        createdAt: true,
      },
    });

    const usersWithGroups = await Promise.all(
      users.map(async (user) => {
        const groups = await prisma.userGroup.findMany({
          where: { userId: user.id },
          select: { groupId: true },
        });
        return { ...user, groupIds: groups.map((g) => g.groupId) };
      })
    );

    res.json(usersWithGroups);
  } catch (error) {
    console.error('Get workspace users error:', error);
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
});

router.post('/', authorize('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    const { email, name, role = 'member', workspaceId, departmentId, groupIds, password } = req.body;

    if (!email || !name || !workspaceId) {
      return res.status(400).json({ error: 'email, name и workspaceId обязательны' });
    }

    // Ensure caller is owner or member (admin/manager already checked) of workspace
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });
    if (!workspace) return res.status(404).json({ error: 'Рабочее пространство не найдено' });

    const isMember = await prisma.workspaceUser.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: req.userId! } },
      select: { id: true },
    });
    if (!isMember && workspace.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const plainPassword: string =
      typeof password === 'string' && password.trim()
        ? password.trim()
        : Math.random().toString(36).slice(2, 10);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          role,
          departmentId: departmentId || null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatar: true,
          departmentId: true,
          createdAt: true,
        },
      });

      await tx.workspaceUser.create({
        data: {
          workspaceId,
          userId: user.id,
        },
      });

      if (Array.isArray(groupIds) && groupIds.length > 0) {
        await tx.userGroup.createMany({
          data: groupIds.map((groupId: string) => ({ userId: user.id, groupId })),
        });
      }

      const groups = await tx.userGroup.findMany({
        where: { userId: user.id },
        select: { groupId: true },
      });

      return { user: { ...user, groupIds: groups.map((g) => g.groupId) } };
    });

    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    });

    const notification = await prisma.notification.create({
      data: {
        type: 'user_added',
        title: 'Добро пожаловать',
        message: `Вас добавили в рабочее пространство "${ws?.name || 'пространство'}"`,
        userId: result.user.id,
        relatedId: workspaceId,
      },
    });

    broadcast({
      type: 'notification',
      userId: result.user.id,
      notification,
    });

    res.json({ ...result.user, initialPassword: plainPassword });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Ошибка создания пользователя' });
  }
});

router.get('/', async (_req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        departmentId: true,
        createdAt: true,
      },
    });

    const usersWithGroups = await Promise.all(
      users.map(async (user) => {
        const groups = await prisma.userGroup.findMany({
          where: { userId: user.id },
          include: { group: true },
        });

        return {
          ...user,
          groupIds: groups.map((g) => g.groupId),
        };
      })
    );

    res.json(usersWithGroups);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        departmentId: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const groups = await prisma.userGroup.findMany({
      where: { userId: user.id },
      include: { group: true },
    });

    res.json({
      ...user,
      groupIds: groups.map((g) => g.groupId),
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Ошибка получения пользователя' });
  }
});

router.put('/:id', authorize('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    const { name, role, departmentId, groupIds } = req.body;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        name,
        role,
        departmentId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        departmentId: true,
      },
    });

    if (groupIds !== undefined) {
      await prisma.userGroup.deleteMany({
        where: { userId: req.params.id },
      });

      if (groupIds.length > 0) {
        await prisma.userGroup.createMany({
          data: groupIds.map((groupId: string) => ({
            userId: req.params.id,
            groupId,
          })),
        });
      }
    }

    const groups = await prisma.userGroup.findMany({
      where: { userId: user.id },
    });

    res.json({
      ...user,
      groupIds: groups.map((g) => g.groupId),
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Ошибка обновления пользователя' });
  }
});

router.delete('/:id', authorize('admin'), async (req: AuthRequest, res) => {
  try {
    await prisma.user.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Пользователь удален' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Ошибка удаления пользователя' });
  }
});

export default router;
