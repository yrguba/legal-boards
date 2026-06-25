import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, requireStaffUser } from '../middleware/auth';
import { ensureChannelForNewWorkspace } from '../utils/workspaceChatChannels';
import { getLexIntakeWorkspaceIds, workspaceAllowsLexIntake } from '../utils/lexIntakeWorkspaces';
import { ensureEmployeeProfileSchema, canManageEmployeeProfile } from '../utils/employeeProfile';
import {
  assertCanManageWorkspace,
  isAlreadyWorkspaceMember,
  resolveWorkspaceRole,
} from '../utils/workspaceRole';
import { removeUserFromWorkspace } from '../utils/removeWorkspaceMember';
import {
  handleCancelWorkspaceInvite,
  handleCreateWorkspaceInvite,
  handleListWorkspaceInvites,
  handleWorkspaceMemberLookup,
} from '../utils/workspaceInviteAdmin';
import {
  assertWorkspaceMember,
  listQuickCreatePresets,
  replaceQuickCreatePresets,
} from '../utils/quickCreatePresets';

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

    const workspaceIds = workspaces.map((w) => w.id);
    const memberships =
      workspaceIds.length === 0
        ? []
        : await prisma.workspaceUser.findMany({
            where: { userId: req.userId!, workspaceId: { in: workspaceIds } },
            select: { workspaceId: true, role: true },
          });
    const roleByWorkspaceId = new Map(memberships.map((m) => [m.workspaceId, m.role]));

    res.json(
      workspaces.map((w) => ({
        ...w,
        isOwner: w.ownerId === req.userId,
        myRole:
          w.ownerId === req.userId ? 'admin' : (roleByWorkspaceId.get(w.id) ?? null),
      })),
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

router.get('/:workspaceId/users/lookup', requireStaffUser, async (req: AuthRequest, res) => {
  try {
    await handleWorkspaceMemberLookup(req, res, prisma, req.params.workspaceId);
  } catch (error) {
    console.error('User lookup error:', error);
    res.status(500).json({ error: 'Ошибка поиска пользователя' });
  }
});

router.get('/:workspaceId/invites', requireStaffUser, async (req: AuthRequest, res) => {
  try {
    await handleListWorkspaceInvites(req, res, prisma, req.params.workspaceId);
  } catch (error) {
    console.error('List workspace invites error:', error);
    res.status(500).json({ error: 'Ошибка загрузки приглашений' });
  }
});

router.post('/:workspaceId/invites', requireStaffUser, async (req: AuthRequest, res) => {
  try {
    await handleCreateWorkspaceInvite(req, res, prisma, req.params.workspaceId);
  } catch (error) {
    console.error('Create workspace invite error:', error);
    res.status(500).json({ error: 'Ошибка отправки приглашения' });
  }
});

router.delete('/:workspaceId/invites/:inviteId', requireStaffUser, async (req: AuthRequest, res) => {
  try {
    await handleCancelWorkspaceInvite(req, res, prisma, req.params.workspaceId, req.params.inviteId);
  } catch (error) {
    console.error('Cancel workspace invite error:', error);
    res.status(500).json({ error: 'Ошибка отмены приглашения' });
  }
});

router.delete('/:workspaceId/members/:userId', requireStaffUser, async (req: AuthRequest, res) => {
  try {
    const { workspaceId, userId: targetUserId } = req.params;
    const manage = await assertCanManageWorkspace(prisma, req.userId!, workspaceId);
    if (!manage.ok) return res.status(403).json({ error: 'Недостаточно прав' });

    if (targetUserId === req.userId) {
      return res.status(400).json({
        error: 'Чтобы выйти из пространства, используйте «Покинуть пространство»',
        code: 'USE_LEAVE',
      });
    }

    const actor = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { name: true },
    });

    const result = await removeUserFromWorkspace(prisma, workspaceId, targetUserId, {
      actorName: actor?.name,
    });
    if (!result.ok) {
      const status = result.code === 'NOT_MEMBER' ? 404 : 400;
      return res.status(status).json({ error: result.error, code: result.code });
    }

    res.json({ message: 'Участник исключён из пространства' });
  } catch (error) {
    console.error('Remove workspace member error:', error);
    res.status(500).json({ error: 'Ошибка исключения участника' });
  }
});

router.post('/:workspaceId/leave', requireStaffUser, async (req: AuthRequest, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const member = await isAlreadyWorkspaceMember(prisma, req.userId!, workspaceId);
    if (!member) {
      return res.status(404).json({ error: 'Вы не состоите в этом пространстве', code: 'NOT_MEMBER' });
    }

    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true, name: true },
    });
    if (!ws) return res.status(404).json({ error: 'Рабочее пространство не найдено' });
    if (ws.ownerId === req.userId) {
      return res.status(400).json({
        error: 'Владелец не может покинуть пространство. Удалите его или передайте владение.',
        code: 'OWNER',
      });
    }

    const result = await removeUserFromWorkspace(prisma, workspaceId, req.userId!, { notify: false });
    if (!result.ok) {
      return res.status(400).json({ error: result.error, code: result.code });
    }

    res.json({ message: `Вы покинули «${ws.name}»` });
  } catch (error) {
    console.error('Leave workspace error:', error);
    res.status(500).json({ error: 'Ошибка выхода из пространства' });
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
  async (req: AuthRequest, res) => {
    try {
      const workspaceId = req.params.workspaceId;
      const viewerRole = await resolveWorkspaceRole(prisma, req.userId!, workspaceId);
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { ownerId: true },
      });
      if (!workspace) return res.status(404).json({ error: 'Рабочее пространство не найдено' });
      if (!viewerRole || !canManageEmployeeProfile(viewerRole, workspace.ownerId === req.userId)) {
        return res.status(403).json({ error: 'Недостаточно прав' });
      }

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

router.get('/:workspaceId/quick-create-presets', requireStaffUser, async (req: AuthRequest, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    if (!req.userId) return res.status(403).json({ error: 'Недостаточно прав' });

    const workspace = await assertWorkspaceMember(prisma, workspaceId, req.userId);
    if (!workspace) return res.status(404).json({ error: 'Рабочее пространство не найдено' });

    const enabledOnly = req.query.enabledOnly === '1' || req.query.enabledOnly === 'true';
    const presets = await listQuickCreatePresets(prisma, workspaceId, { enabledOnly });
    res.json(presets);
  } catch (error) {
    console.error('Get quick create presets error:', error);
    res.status(500).json({ error: 'Ошибка получения пресетов быстрого создания' });
  }
});

router.put('/:workspaceId/quick-create-presets', requireStaffUser, async (req: AuthRequest, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    if (!req.userId) return res.status(403).json({ error: 'Недостаточно прав' });

    await assertCanManageWorkspace(prisma, req.userId, workspaceId);

    const incoming = req.body?.presets;
    const presets = await replaceQuickCreatePresets(prisma, workspaceId, incoming);
    res.json(presets);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Ошибка сохранения пресетов';
    if (message.includes('должен быть массивом') || message.includes('Пресет')) {
      return res.status(400).json({ error: message });
    }
    console.error('Update quick create presets error:', error);
    res.status(500).json({ error: 'Ошибка сохранения пресетов быстрого создания' });
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

export default router;
