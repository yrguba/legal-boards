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
