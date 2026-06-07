import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, authorize, requireStaffUser } from '../middleware/auth';
import { broadcast } from '../realtime';
import { ensureChannelForNewWorkspace } from '../utils/workspaceChatChannels';
import { getLexIntakeWorkspaceIds, workspaceAllowsLexIntake } from '../utils/lexIntakeWorkspaces';
import { ensureEmployeeProfileSchema } from '../utils/employeeProfile';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  try {
    if (req.lexClientId) {
      const links = await prisma.lexClientWorkspace.findMany({
        where: { lexClientId: req.lexClientId },
        include: {
          workspace: {
            include: {
              owner: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const linkedIds = new Set(links.map((l) => l.workspaceId));
      const intakeOnlyIds = [...getLexIntakeWorkspaceIds()].filter((id) => !linkedIds.has(id));

      const intakeWorkspaces =
        intakeOnlyIds.length === 0
          ? []
          : await prisma.workspace.findMany({
              where: { id: { in: intakeOnlyIds } },
              include: {
                owner: {
                  select: { id: true, name: true, email: true },
                },
              },
            });

      const fromLinks = links.map((l) => ({
        ...l.workspace,
        isOwner: false,
      }));
      const fromIntake = intakeWorkspaces.map((w) => ({
        ...w,
        isOwner: false,
      }));

      return res.json([...fromLinks, ...fromIntake]);
    }

    if (!req.userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const workspaces = await prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: req.userId },
          { users: { some: { userId: req.userId } } },
        ],
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json(
      workspaces.map((w) => ({
        ...w,
        isOwner: w.ownerId === req.userId,
      }))
    );
  } catch (error) {
    console.error('Get workspaces error:', error);
    res.status(500).json({ error: 'Ошибка получения рабочих пространств' });
  }
});

router.post('/', requireStaffUser, async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;

    const workspace = await prisma.workspace.create({
      data: {
        name,
        description,
        ownerId: req.userId!,
      },
    });

    await ensureChannelForNewWorkspace(prisma, workspace.id, workspace.name);

    res.json(workspace);
  } catch (error) {
    console.error('Create workspace error:', error);
    res.status(500).json({ error: 'Ошибка создания рабочего пространства' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    if (req.lexClientId) {
      const link = await prisma.lexClientWorkspace.findUnique({
        where: {
          lexClientId_workspaceId: {
            lexClientId: req.lexClientId,
            workspaceId: req.params.id,
          },
        },
      });
      if (!link && !workspaceAllowsLexIntake(req.params.id)) {
        return res.status(403).json({ error: 'Нет доступа к этому пространству' });
      }
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        departments: true,
        groups: { include: { users: true } },
      },
    });

    if (!workspace) {
      return res.status(404).json({ error: 'Рабочее пространство не найдено' });
    }

    res.json({
      ...workspace,
      isOwner: workspace.ownerId === req.userId,
    });
  } catch (error) {
    console.error('Get workspace error:', error);
    res.status(500).json({ error: 'Ошибка получения рабочего пространства' });
  }
});

router.put('/:id', requireStaffUser, async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;

    const workspace = await prisma.workspace.findUnique({
      where: { id: req.params.id },
    });

    if (!workspace) {
      return res.status(404).json({ error: 'Рабочее пространство не найдено' });
    }

    if (workspace.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const updated = await prisma.workspace.update({
      where: { id: req.params.id },
      data: { name, description },
    });

    await ensureChannelForNewWorkspace(prisma, updated.id, updated.name);

    res.json(updated);
  } catch (error) {
    console.error('Update workspace error:', error);
    res.status(500).json({ error: 'Ошибка обновления рабочего пространства' });
  }
});

router.delete('/:id', requireStaffUser, async (req: AuthRequest, res) => {
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: req.params.id },
    });

    if (!workspace) {
      return res.status(404).json({ error: 'Рабочее пространство не найдено' });
    }

    if (workspace.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    await prisma.workspace.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Рабочее пространство удалено' });
  } catch (error) {
    console.error('Delete workspace error:', error);
    res.status(500).json({ error: 'Ошибка удаления рабочего пространства' });
  }
});

router.post('/:id/users', requireStaffUser, async (req: AuthRequest, res) => {
  try {
    const { userEmail } = req.body;

    const workspace = await prisma.workspace.findUnique({
      where: { id: req.params.id },
    });

    if (!workspace) {
      return res.status(404).json({ error: 'Рабочее пространство не найдено' });
    }

    if (workspace.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const workspaceUser = await prisma.workspaceUser.create({
      data: {
        workspaceId: req.params.id,
        userId: user.id,
      },
    });

    const notification = await prisma.notification.create({
      data: {
        type: 'user_added',
        title: 'Добавление в пространство',
        message: `Вас добавили в рабочее пространство "${workspace.name}"`,
        userId: user.id,
        relatedId: workspace.id,
      },
    });

    broadcast({
      type: 'notification',
      userId: user.id,
      notification,
    });

    res.json(workspaceUser);
  } catch (error) {
    console.error('Add user to workspace error:', error);
    res.status(500).json({ error: 'Ошибка добавления пользователя' });
  }
});

router.get('/:workspaceId/employee-profile-fields', requireStaffUser, async (req: AuthRequest, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, ownerId: true },
    });
    if (!workspace) return res.status(404).json({ error: 'Рабочее пространство не найдено' });

    if (!req.userId) return res.status(403).json({ error: 'Недостаточно прав' });
    const isMember = await prisma.workspaceUser.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: req.userId } },
    });
    if (!isMember && workspace.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const fields = await ensureEmployeeProfileSchema(prisma, workspaceId);
    res.json(fields);
  } catch (error) {
    console.error('Get employee profile fields error:', error);
    res.status(500).json({ error: 'Ошибка получения схемы профиля' });
  }
});

router.put(
  '/:workspaceId/employee-profile-fields',
  requireStaffUser,
  authorize('admin', 'manager'),
  async (req: AuthRequest, res) => {
    try {
      const workspaceId = req.params.workspaceId;
      const incoming = req.body?.fields;
      if (!Array.isArray(incoming)) {
        return res.status(400).json({ error: 'fields должен быть массивом' });
      }

      await prisma.$transaction(async (tx) => {
        await tx.employeeProfileField.deleteMany({ where: { workspaceId } });
        for (let idx = 0; idx < incoming.length; idx++) {
          const f = incoming[idx] as Record<string, unknown>;
          await tx.employeeProfileField.create({
            data: {
              workspaceId,
              key: String(f.key ?? `field_${idx}`),
              name: String(f.name ?? 'Поле'),
              type: String(f.type ?? 'text'),
              required: Boolean(f.required),
              filterable: f.filterable !== false,
              options: f.options ?? undefined,
              section: typeof f.section === 'string' ? f.section : null,
              position: typeof f.position === 'number' ? f.position : idx,
            },
          });
        }
      });

      const fields = await prisma.employeeProfileField.findMany({
        where: { workspaceId },
        orderBy: { position: 'asc' },
      });
      res.json(fields);
    } catch (error) {
      console.error('Update employee profile fields error:', error);
      res.status(500).json({ error: 'Ошибка сохранения схемы профиля' });
    }
  },
);

export default router;
