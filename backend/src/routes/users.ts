import { Router } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, authorize, requireStaffUser } from '../middleware/auth';
import bcrypt from 'bcryptjs';
import { broadcast } from '../realtime';
import {
  assertUserGroupsMatchDepartment,
  canManageEmployeeProfile,
  ensureEmployeeProfileSchema,
  matchesCatalogFilters,
  profileFieldsToObject,
  filterConfidentialFields,
  getConfidentialKeys,
  DEFAULT_CONFIDENTIAL_KEYS,
  validateProfileFields,
  type CatalogFilters,
} from '../utils/employeeProfile';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);
router.use(requireStaffUser);

async function workspaceAccess(req: AuthRequest, workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, ownerId: true },
  });
  if (!workspace) return null;
  if (!req.userId) return null;
  const isMember = await prisma.workspaceUser.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: req.userId } },
  });
  if (!isMember && workspace.ownerId !== req.userId) return null;
  return {
    workspace,
    canManageProfile: canManageEmployeeProfile(req.userRole, workspace.ownerId === req.userId),
  };
}

/** Направления, в которых текущий пользователь назначен руководителем. */
async function viewerLedGroupIds(viewerId: string, workspaceId: string): Promise<Set<string>> {
  const led = await prisma.group.findMany({
    where: { workspaceId, leaderId: viewerId },
    select: { id: true },
  });
  return new Set(led.map((g) => g.id));
}

/** Конфиденциальные ключи: объединение схемы БД и значений по умолчанию. */
async function confidentialKeysForWorkspace(workspaceId: string): Promise<Set<string>> {
  const schema = await prisma.employeeProfileField.findMany({ where: { workspaceId } });
  return new Set([...DEFAULT_CONFIDENTIAL_KEYS, ...getConfidentialKeys(schema)]);
}

type ProfilePerm = {
  canSeeAny: boolean;
  canSeeConfidential: boolean;
  canEditAny: boolean;
  canEditConfidential: boolean;
};

function computeProfilePerm(args: {
  viewerId: string;
  viewerRole?: string;
  ownerId: string;
  targetId: string;
  targetGroupIds: string[];
  ledGroupIds: Set<string>;
}): ProfilePerm {
  const isSelf = args.viewerId === args.targetId;
  const isAdmin = args.viewerRole === 'admin' || args.ownerId === args.viewerId;
  const isManager = args.viewerRole === 'manager';
  const isLeaderOf = args.targetGroupIds.some((g) => args.ledGroupIds.has(g));
  return {
    canSeeAny: isAdmin || isManager || isLeaderOf || isSelf,
    canSeeConfidential: isAdmin || isLeaderOf || isSelf,
    canEditAny: isAdmin || isManager || isLeaderOf || isSelf,
    canEditConfidential: isAdmin || isLeaderOf || isSelf,
  };
}

function parseCatalogFilters(query: Record<string, unknown>): CatalogFilters {
  const str = (k: string) => {
    const v = query[k];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };
  const exp = query.expiringWithinDays;
  const expN = typeof exp === 'string' ? Number.parseInt(exp, 10) : Number(exp);
  return {
    q: str('q'),
    role: str('role'),
    departmentId: str('departmentId'),
    groupId: str('groupId'),
    fullName: str('fullName'),
    contractNumber: str('contractNumber'),
    contractorStatus: str('contractorStatus'),
    jobTitle: str('jobTitle'),
    contractStartFrom: str('contractStartFrom'),
    contractStartTo: str('contractStartTo'),
    contractEndFrom: str('contractEndFrom'),
    contractEndTo: str('contractEndTo'),
    expiringWithinDays: Number.isFinite(expN) ? expN : undefined,
  };
}

function shapeUserRow(
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    avatar: string | null;
    departmentId: string | null;
    profileFields?: unknown;
    createdAt?: Date;
  },
  groupIds: string[],
  perm: { canSeeAny: boolean; canSeeConfidential: boolean },
  confidentialKeys: Set<string>,
) {
  const { profileFields: _raw, ...rest } = user;
  const profileFields = perm.canSeeAny
    ? filterConfidentialFields(
        profileFieldsToObject(user.profileFields),
        confidentialKeys,
        perm.canSeeConfidential,
      )
    : undefined;
  return { ...rest, profileFields, groupIds };
}

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

router.get('/workspace/:workspaceId/catalog', async (req: AuthRequest, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const access = await workspaceAccess(req, workspaceId);
    if (!access) return res.status(403).json({ error: 'Недостаточно прав' });

    if (!access.canManageProfile) {
      return res.status(403).json({ error: 'Каталог профилей доступен руководителям и администраторам' });
    }

    const schema = await ensureEmployeeProfileSchema(prisma, workspaceId);
    const confidentialKeys = new Set([...DEFAULT_CONFIDENTIAL_KEYS, ...getConfidentialKeys(schema)]);
    const filters = parseCatalogFilters(req.query as Record<string, unknown>);

    const workspace = access.workspace;
    const ledGroupIds = await viewerLedGroupIds(req.userId!, workspaceId);
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
        profileFields: true,
        createdAt: true,
      },
    });

    const groupLinks = await prisma.userGroup.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, groupId: true },
    });
    const groupsByUser = new Map<string, string[]>();
    for (const l of groupLinks) {
      const list = groupsByUser.get(l.userId) ?? [];
      list.push(l.groupId);
      groupsByUser.set(l.userId, list);
    }

    const rows = users
      .map((u) => {
        const groupIds = groupsByUser.get(u.id) ?? [];
        const perm = computeProfilePerm({
          viewerId: req.userId!,
          viewerRole: req.userRole,
          ownerId: workspace.ownerId,
          targetId: u.id,
          targetGroupIds: groupIds,
          ledGroupIds,
        });
        return shapeUserRow(u, groupIds, perm, confidentialKeys);
      })
      .filter((u) =>
        matchesCatalogFilters(
          {
            name: u.name,
            email: u.email,
            role: u.role,
            departmentId: u.departmentId,
            groupIds: u.groupIds,
            profileFields: profileFieldsToObject(u.profileFields),
          },
          filters,
        ),
      );

    res.json(rows);
  } catch (error) {
    console.error('Employee catalog error:', error);
    res.status(500).json({ error: 'Ошибка загрузки каталога' });
  }
});

router.get('/workspace/:workspaceId', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const workspaceId = req.params.workspaceId;
    const access = await workspaceAccess(req, workspaceId);
    if (!access) return res.status(403).json({ error: 'Недостаточно прав' });

    const confidentialKeys = await confidentialKeysForWorkspace(workspaceId);
    const ledGroupIds = await viewerLedGroupIds(req.userId, workspaceId);
    const memberships = await prisma.workspaceUser.findMany({
      where: { workspaceId },
      select: { userId: true },
    });

    const userIds = Array.from(new Set([access.workspace.ownerId, ...memberships.map((m) => m.userId)]));

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        departmentId: true,
        profileFields: true,
        createdAt: true,
      },
    });

    const usersWithGroups = await Promise.all(
      users.map(async (user) => {
        const groups = await prisma.userGroup.findMany({
          where: { userId: user.id },
          select: { groupId: true },
        });
        const groupIds = groups.map((g) => g.groupId);
        const perm = computeProfilePerm({
          viewerId: req.userId!,
          viewerRole: req.userRole,
          ownerId: access.workspace.ownerId,
          targetId: user.id,
          targetGroupIds: groupIds,
          ledGroupIds,
        });
        return shapeUserRow(user, groupIds, perm, confidentialKeys);
      }),
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

    const gids: string[] = Array.isArray(groupIds) ? groupIds : [];
    const groupGate = await assertUserGroupsMatchDepartment(
      prisma,
      'new',
      departmentId || null,
      gids,
    );
    if (!groupGate.ok) return res.status(400).json({ error: groupGate.error });

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          role,
          departmentId: departmentId || null,
          profileFields: { fullName: name } as Prisma.InputJsonValue,
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
        profileFields: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const membership = await prisma.workspaceUser.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    const owned = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      select: { id: true, ownerId: true },
    });
    const workspaceId = membership?.workspaceId ?? owned?.id;

    const groups = await prisma.userGroup.findMany({
      where: { userId: user.id },
      include: { group: { select: { id: true, name: true, departmentId: true } } },
    });
    const groupIds = groups.map((g) => g.groupId);

    let perm: ProfilePerm = {
      canSeeAny: false,
      canSeeConfidential: false,
      canEditAny: false,
      canEditConfidential: false,
    };
    let confidentialKeys = DEFAULT_CONFIDENTIAL_KEYS;
    if (workspaceId && req.userId) {
      const access = await workspaceAccess(req, workspaceId);
      if (access) {
        const ledGroupIds = await viewerLedGroupIds(req.userId, workspaceId);
        confidentialKeys = await confidentialKeysForWorkspace(workspaceId);
        perm = computeProfilePerm({
          viewerId: req.userId,
          viewerRole: req.userRole,
          ownerId: access.workspace.ownerId,
          targetId: user.id,
          targetGroupIds: groupIds,
          ledGroupIds,
        });
      }
    }

    res.json({
      ...shapeUserRow(user, groupIds, perm, confidentialKeys),
      groups: groups.map((g) => g.group),
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Ошибка получения пользователя' });
  }
});

router.put('/:id/profile', async (req: AuthRequest, res) => {
  try {
    const userId = req.params.id;
    if (!req.userId) return res.status(403).json({ error: 'Недостаточно прав' });

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, profileFields: true },
    });
    if (!target) return res.status(404).json({ error: 'Сотрудник не найден' });

    const membership = await prisma.workspaceUser.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });
    if (!membership) {
      return res.status(400).json({ error: 'Сотрудник не привязан к пространству' });
    }

    const access = await workspaceAccess(req, membership.workspaceId);
    if (!access) return res.status(403).json({ error: 'Недостаточно прав' });

    const groupLinks = await prisma.userGroup.findMany({ where: { userId }, select: { groupId: true } });
    const groupIds = groupLinks.map((g) => g.groupId);
    const ledGroupIds = await viewerLedGroupIds(req.userId, membership.workspaceId);
    const perm = computeProfilePerm({
      viewerId: req.userId,
      viewerRole: req.userRole,
      ownerId: access.workspace.ownerId,
      targetId: userId,
      targetGroupIds: groupIds,
      ledGroupIds,
    });
    if (!perm.canEditAny) {
      return res.status(403).json({ error: 'Недостаточно прав для редактирования профиля' });
    }

    const schema = await ensureEmployeeProfileSchema(prisma, membership.workspaceId);
    const confidentialKeys = new Set([...DEFAULT_CONFIDENTIAL_KEYS, ...getConfidentialKeys(schema)]);
    const existing = profileFieldsToObject(target.profileFields);
    const incoming = profileFieldsToObject(req.body?.profileFields ?? req.body);

    // Пустые значения из формы не перезаписывают уже сохранённые поля.
    const permittedIncoming: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(incoming)) {
      if (confidentialKeys.has(k) && !perm.canEditConfidential) continue;
      const empty =
        v === undefined ||
        v === null ||
        (typeof v === 'string' && v.trim() === '');
      if (empty) continue;
      permittedIncoming[k] = typeof v === 'string' ? v.trim() : v;
    }

    const merged = { ...existing, ...permittedIncoming };
    const validated = validateProfileFields(schema, merged);
    if (!validated.ok) return res.status(400).json({ error: validated.error });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { profileFields: validated.sanitized as Prisma.InputJsonValue },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        departmentId: true,
        profileFields: true,
      },
    });

    res.json(shapeUserRow(updated, groupIds, perm, confidentialKeys));
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ error: 'Ошибка сохранения профиля' });
  }
});

router.put('/:id', authorize('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    const { name, role, departmentId, groupIds } = req.body;

    const nextDept = departmentId === undefined ? undefined : departmentId || null;
    const gids: string[] | undefined = groupIds !== undefined ? groupIds : undefined;

    if (gids !== undefined) {
      const current = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: { departmentId: true },
      });
      const deptForGroups = nextDept !== undefined ? nextDept : current?.departmentId;
      const groupGate = await assertUserGroupsMatchDepartment(
        prisma,
        req.params.id,
        deptForGroups,
        gids,
      );
      if (!groupGate.ok) return res.status(400).json({ error: groupGate.error });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(departmentId !== undefined ? { departmentId: departmentId || null } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        departmentId: true,
        profileFields: true,
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
    } else if (departmentId !== undefined) {
      await prisma.userGroup.deleteMany({
        where: {
          userId: req.params.id,
          group: nextDept
            ? { departmentId: { not: nextDept } }
            : {},
        },
      });
    }

    const groups = await prisma.userGroup.findMany({
      where: { userId: user.id },
    });
    const userGroupIds = groups.map((g) => g.groupId);

    const membership = await prisma.workspaceUser.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    const access = membership ? await workspaceAccess(req, membership.workspaceId) : null;

    let perm: ProfilePerm = {
      canSeeAny: true,
      canSeeConfidential: true,
      canEditAny: true,
      canEditConfidential: true,
    };
    let confidentialKeys = DEFAULT_CONFIDENTIAL_KEYS;
    if (access && req.userId) {
      const ledGroupIds = await viewerLedGroupIds(req.userId, membership!.workspaceId);
      confidentialKeys = await confidentialKeysForWorkspace(membership!.workspaceId);
      perm = computeProfilePerm({
        viewerId: req.userId,
        viewerRole: req.userRole,
        ownerId: access.workspace.ownerId,
        targetId: user.id,
        targetGroupIds: userGroupIds,
        ledGroupIds,
      });
    }

    res.json(shapeUserRow(user, userGroupIds, perm, confidentialKeys));
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
