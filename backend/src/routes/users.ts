import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Prisma, PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, authorize, requireStaffUser } from '../middleware/auth';
import { createAndBroadcastNotification } from '../utils/notifications';
import { isLexClientsTabEnabled } from '../utils/lexClients';
import { isEmailConfigured } from '../utils/email';
import { getUploadsPath, toPublicUploadPath } from '../uploadsPath';
import { decodeMultipartFilename } from '../utils/decodeMultipartFilename';
import {
  generateTempPassword,
  hashPassword,
  verifyPassword,
} from '../utils/passwordAuth';
import {
  assignPasswordInviteToken,
  buildPasswordInviteUrl,
  sendAdminTempPasswordEmail,
  sendPasswordInviteEmail,
} from '../utils/passwordInvite';
import { isWorkspaceInviteEmailEnabled } from '../utils/workspaceInviteEmail';
import {
  assertCanManageWorkspace,
  getWorkspaceGroupIdsForUser,
  getWorkspaceMemberProfile,
  isAlreadyWorkspaceMember,
  normalizeEmail,
  resolveWorkspaceRole,
} from '../utils/workspaceRole';
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
import { handleWorkspaceMemberLookup } from '../utils/workspaceInviteAdmin';
import {
  deleteUserAccount,
  getAccountDeletionPrecheck,
} from '../utils/deleteUserAccount';
import {
  assertWorkspaceMemberUser,
  getEffectivePresenceForUser,
  listUserAbsences,
  loadEffectivePresencesForUsers,
  PRESENCE_STATUS,
  SETTABLE_PRESENCE_STATUSES,
  validateAbsenceInput,
} from '../utils/userPresence';

const router = Router();
const prisma = new PrismaClient();

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const avatarUpload = multer({
  storage: multer.diskStorage({
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
      const ext = path.extname(decodeMultipartFilename(file.originalname)).toLowerCase() || '.jpg';
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
      cb(null, `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
    },
  }),
  limits: { fileSize: AVATAR_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (AVATAR_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Допустимы только изображения JPEG, PNG, WebP или GIF'));
    }
  },
});

function mapMeUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar: string | null;
  mustChangePassword?: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatar: user.avatar ?? undefined,
    mustChangePassword: user.mustChangePassword ?? false,
  };
}

function deleteStoredAvatarFile(avatarPath: string | null | undefined) {
  if (!avatarPath) return;
  const normalized = avatarPath.replace(/\\/g, '/');
  if (!normalized.includes('uploads/')) return;
  const fp = path.join(getUploadsPath(), path.basename(normalized));
  try {
    fs.unlinkSync(fp);
  } catch {
    /* ignore missing file */
  }
}

router.get('/lex-clients/config', (_req, res) => {
  res.json({ enabled: isLexClientsTabEnabled() });
});

router.use(authenticate);
router.use(requireStaffUser);

router.patch('/me', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(403).json({ error: 'Недостаточно прав' });

    const rawName = req.body?.name;
    if (typeof rawName !== 'string') {
      return res.status(400).json({ error: 'name обязателен' });
    }
    const name = rawName.trim();
    if (!name) return res.status(400).json({ error: 'Имя не может быть пустым' });
    if (name.length > 128) {
      return res.status(400).json({ error: 'Имя не длиннее 128 символов' });
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: { name },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        mustChangePassword: true,
      },
    });

    res.json({ user: mapMeUser(updated) });
  } catch (error) {
    console.error('Update me error:', error);
    res.status(500).json({ error: 'Ошибка сохранения профиля' });
  }
});

router.post('/me/avatar', avatarUpload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(403).json({ error: 'Недостаточно прав' });
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не передан' });
    }

    const current = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { avatar: true },
    });
    if (current?.avatar) {
      deleteStoredAvatarFile(current.avatar);
    }

    const avatarPath = toPublicUploadPath(req.file.path);
    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: { avatar: avatarPath },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        mustChangePassword: true,
      },
    });

    res.json({ user: mapMeUser(updated) });
  } catch (error) {
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
    }
    const msg = error instanceof Error ? error.message : 'Ошибка загрузки аватара';
    console.error('Upload avatar error:', error);
    res.status(500).json({ error: msg });
  }
});

router.delete('/me/avatar', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(403).json({ error: 'Недостаточно прав' });

    const current = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { avatar: true },
    });
    if (current?.avatar) {
      deleteStoredAvatarFile(current.avatar);
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: { avatar: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        mustChangePassword: true,
      },
    });

    res.json({ user: mapMeUser(updated) });
  } catch (error) {
    console.error('Delete avatar error:', error);
    res.status(500).json({ error: 'Ошибка удаления аватара' });
  }
});

function parseWorkspaceIdQuery(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

router.get('/me/presence', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(403).json({ error: 'Недостаточно прав' });
    const workspaceId = parseWorkspaceIdQuery(req.query.workspaceId);
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId обязателен' });
    if (!(await assertWorkspaceMemberUser(prisma, workspaceId, req.userId))) {
      return res.status(403).json({ error: 'Нет доступа к пространству' });
    }

    const presence = await getEffectivePresenceForUser(prisma, req.userId, workspaceId);
    res.json({ presence });
  } catch (error) {
    console.error('Get my presence error:', error);
    res.status(500).json({ error: 'Ошибка загрузки статуса' });
  }
});

router.patch('/me/presence', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(403).json({ error: 'Недостаточно прав' });
    const workspaceId =
      typeof req.body?.workspaceId === 'string' ? req.body.workspaceId.trim() : '';
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId обязателен' });
    if (!(await assertWorkspaceMemberUser(prisma, workspaceId, req.userId))) {
      return res.status(403).json({ error: 'Нет доступа к пространству' });
    }

    const status = typeof req.body?.status === 'string' ? req.body.status.trim() : '';
    if (!SETTABLE_PRESENCE_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Некорректный статус' });
    }

    let customText: string | null = null;
    if (status === PRESENCE_STATUS.custom) {
      const raw = typeof req.body?.customText === 'string' ? req.body.customText.trim() : '';
      if (!raw) return res.status(400).json({ error: 'Укажите текст статуса' });
      if (raw.length > 60) return res.status(400).json({ error: 'Текст статуса не длиннее 60 символов' });
      customText = raw;
    }

    let expiresAt: Date | null = null;
    if (req.body?.expiresAt === null || req.body?.expiresAt === '') {
      expiresAt = null;
    } else if (typeof req.body?.expiresAt === 'string' && req.body.expiresAt.trim()) {
      const parsed = new Date(req.body.expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ error: 'Некорректная дата окончания статуса' });
      }
      expiresAt = parsed;
    }

    await prisma.userPresence.upsert({
      where: { userId_workspaceId: { userId: req.userId, workspaceId } },
      create: {
        userId: req.userId,
        workspaceId,
        status,
        customText,
        expiresAt,
      },
      update: { status, customText, expiresAt },
    });

    const presence = await getEffectivePresenceForUser(prisma, req.userId, workspaceId);
    res.json({ presence });
  } catch (error) {
    console.error('Update my presence error:', error);
    res.status(500).json({ error: 'Ошибка сохранения статуса' });
  }
});

router.get('/me/absences', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(403).json({ error: 'Недостаточно прав' });
    const workspaceId = parseWorkspaceIdQuery(req.query.workspaceId);
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId обязателен' });
    if (!(await assertWorkspaceMemberUser(prisma, workspaceId, req.userId))) {
      return res.status(403).json({ error: 'Нет доступа к пространству' });
    }

    const absences = await listUserAbsences(prisma, req.userId, workspaceId);
    res.json({ absences });
  } catch (error) {
    console.error('Get my absences error:', error);
    res.status(500).json({ error: 'Ошибка загрузки отсутствий' });
  }
});

router.post('/me/absences', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(403).json({ error: 'Недостаточно прав' });
    const workspaceId =
      typeof req.body?.workspaceId === 'string' ? req.body.workspaceId.trim() : '';
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId обязателен' });
    if (!(await assertWorkspaceMemberUser(prisma, workspaceId, req.userId))) {
      return res.status(403).json({ error: 'Нет доступа к пространству' });
    }

    const validated = validateAbsenceInput(req.body);
    if (!validated.ok) return res.status(400).json({ error: validated.error });

    const { kind, startDate, endDate, note, substituteUserId } = validated.data;
    if (substituteUserId) {
      if (substituteUserId === req.userId) {
        return res.status(400).json({ error: 'Нельзя указать себя замещающим' });
      }
      if (!(await assertWorkspaceMemberUser(prisma, workspaceId, substituteUserId))) {
        return res.status(400).json({ error: 'Замещающий не состоит в пространстве' });
      }
    }

    await prisma.userAbsence.create({
      data: {
        userId: req.userId,
        workspaceId,
        kind,
        startDate,
        endDate,
        note,
        substituteUserId,
      },
    });

    const absences = await listUserAbsences(prisma, req.userId, workspaceId);
    const presence = await getEffectivePresenceForUser(prisma, req.userId, workspaceId);
    res.status(201).json({ absences, presence });
  } catch (error) {
    console.error('Create absence error:', error);
    res.status(500).json({ error: 'Ошибка создания отсутствия' });
  }
});

router.delete('/me/absences/:absenceId', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(403).json({ error: 'Недостаточно прав' });
    const workspaceId = parseWorkspaceIdQuery(req.query.workspaceId);
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId обязателен' });

    const row = await prisma.userAbsence.findUnique({
      where: { id: req.params.absenceId },
    });
    if (!row || row.userId !== req.userId || row.workspaceId !== workspaceId) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }

    await prisma.userAbsence.delete({ where: { id: row.id } });

    const absences = await listUserAbsences(prisma, req.userId, workspaceId);
    const presence = await getEffectivePresenceForUser(prisma, req.userId, workspaceId);
    res.json({ absences, presence });
  } catch (error) {
    console.error('Delete absence error:', error);
    res.status(500).json({ error: 'Ошибка удаления отсутствия' });
  }
});

router.get('/me/delete-account/precheck', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(403).json({ error: 'Недостаточно прав' });
    const precheck = await getAccountDeletionPrecheck(prisma, req.userId);
    if (!precheck) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(precheck);
  } catch (error) {
    console.error('Account deletion precheck error:', error);
    res.status(500).json({ error: 'Ошибка проверки удаления аккаунта' });
  }
});

router.post('/me/delete-account', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(403).json({ error: 'Недостаточно прав' });
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!password) {
      return res.status(400).json({ error: 'Укажите пароль для подтверждения' });
    }

    const result = await deleteUserAccount(prisma, req.userId, password);
    if (!result.ok) {
      const status =
        result.code === 'INVALID_PASSWORD'
          ? 401
          : result.code === 'BLOCKED' || result.code === 'TRANSFER_OWNERSHIP_REQUIRED'
            ? 409
            : 400;
      return res.status(status).json({ error: result.error, code: result.code });
    }

    res.json({
      message: 'Аккаунт удалён. Email можно использовать для новой регистрации.',
      email: result.email,
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Ошибка удаления аккаунта' });
  }
});

async function workspaceAccess(req: AuthRequest, workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, ownerId: true },
  });
  if (!workspace) return null;
  if (!req.userId) return null;
  const viewerRole = await resolveWorkspaceRole(prisma, req.userId, workspaceId);
  if (!viewerRole) return null;
  return {
    workspace,
    viewerRole,
    canManageProfile: canManageEmployeeProfile(viewerRole, workspace.ownerId === req.userId),
  };
}

async function shapeWorkspaceUserRow(
  user: {
    id: string;
    email: string;
    name: string;
    avatar: string | null;
    createdAt?: Date;
  },
  workspaceId: string,
  ownerId: string,
  viewerId: string,
  viewerRole: string,
  ledGroupIds: Set<string>,
  confidentialKeys: Set<string>,
) {
  const profile = await getWorkspaceMemberProfile(prisma, user.id, workspaceId, ownerId);
  if (!profile) return null;
  const groupIds = await getWorkspaceGroupIdsForUser(prisma, user.id, workspaceId);
  const perm = computeProfilePerm({
    viewerId,
    viewerRole,
    ownerId,
    targetId: user.id,
    targetGroupIds: groupIds,
    ledGroupIds,
  });
  return shapeUserRow(
    {
      ...user,
      role: profile.role,
      departmentId: profile.departmentId,
      profileFields: profile.profileFields,
    },
    groupIds,
    perm,
    confidentialKeys,
  );
}

async function getWorkspaceGroupIdSet(workspaceId: string): Promise<Set<string>> {
  const groups = await prisma.group.findMany({
    where: { workspaceId },
    select: { id: true },
  });
  return new Set(groups.map((g) => g.id));
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
    if (!isLexClientsTabEnabled()) {
      return res.status(403).json({ error: 'Раздел «Клиенты LEXPRO» отключён' });
    }
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
    if (!isLexClientsTabEnabled()) {
      return res.status(403).json({ error: 'Раздел «Клиенты LEXPRO» отключён' });
    }
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

router.get('/workspace/:workspaceId/member-lookup', async (req: AuthRequest, res) => {
  try {
    await handleWorkspaceMemberLookup(req, res, prisma, req.params.workspaceId);
  } catch (error) {
    console.error('Member lookup error:', error);
    res.status(500).json({ error: 'Ошибка поиска пользователя' });
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
        avatar: true,
        createdAt: true,
      },
    });

    const shaped = (
      await Promise.all(
        users.map((u) =>
          shapeWorkspaceUserRow(
            u,
            workspaceId,
            workspace.ownerId,
            req.userId!,
            access.viewerRole,
            ledGroupIds,
            confidentialKeys,
          ),
        ),
      )
    ).filter((row): row is NonNullable<typeof row> => row !== null);

    const rows = shaped.filter((u) =>
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
        avatar: true,
        createdAt: true,
      },
    });

    const usersWithGroups = (
      await Promise.all(
        users.map((user) =>
          shapeWorkspaceUserRow(
            user,
            workspaceId,
            access.workspace.ownerId,
            req.userId!,
            access.viewerRole,
            ledGroupIds,
            confidentialKeys,
          ),
        ),
      )
    ).filter((row): row is NonNullable<typeof row> => row !== null);

    const presenceMap = await loadEffectivePresencesForUsers(
      prisma,
      workspaceId,
      usersWithGroups.map((u) => u.id),
    );

    res.json(
      usersWithGroups.map((u) => ({
        ...u,
        presence: presenceMap.get(u.id) ?? null,
      })),
    );
  } catch (error) {
    console.error('Get workspace users error:', error);
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { email: rawEmail, name, role = 'member', workspaceId, departmentId, groupIds, password } = req.body;

    if (!rawEmail || !name || !workspaceId) {
      return res.status(400).json({ error: 'email, name и workspaceId обязательны' });
    }
    const email = normalizeEmail(String(rawEmail));

    const manage = await assertCanManageWorkspace(prisma, req.userId!, workspaceId);
    if (!manage.ok) return res.status(403).json({ error: 'Недостаточно прав' });

    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      const alreadyMember = await isAlreadyWorkspaceMember(prisma, existingUser.id, workspaceId);
      if (alreadyMember) {
        return res.status(409).json({
          error: 'Пользователь уже состоит в этом пространстве',
          code: 'ALREADY_MEMBER',
        });
      }
      return res.status(409).json({
        error: 'Пользователь уже зарегистрирован. Отправьте приглашение в пространство.',
        code: 'USER_EXISTS',
      });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });
    if (!workspace) return res.status(404).json({ error: 'Рабочее пространство не найдено' });

    const adminProvidedPassword =
      typeof password === 'string' && password.trim().length > 0;
    const plainPassword: string = adminProvidedPassword
      ? password.trim()
      : generateTempPassword();
    const hashedPassword = await hashPassword(plainPassword);
    const autoGeneratedPassword = !adminProvidedPassword;
    const inviteEmailMode = autoGeneratedPassword && isWorkspaceInviteEmailEnabled();
    const mustChangePassword = autoGeneratedPassword;

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
          emailVerified: true,
          mustChangePassword,
          profileFields: { fullName: name } as Prisma.InputJsonValue,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatar: true,
          createdAt: true,
        },
      });

      await tx.workspaceUser.create({
        data: {
          workspaceId,
          userId: user.id,
          role,
          departmentId: departmentId || null,
          profileFields: { fullName: name } as Prisma.InputJsonValue,
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

    await createAndBroadcastNotification(prisma, {
      type: 'user_added',
      title: 'Добро пожаловать',
      message: `Вас добавили в рабочее пространство "${ws?.name || 'пространство'}"`,
      userId: result.user.id,
      relatedId: workspaceId,
    });

    if (inviteEmailMode) {
      if (!isEmailConfigured()) {
        await prisma.user.delete({ where: { id: result.user.id } }).catch(() => undefined);
        return res.status(503).json({
          error: 'Email-сервис не настроен (RESEND_API_KEY, RESEND_FROM). Невозможно отправить приглашение.',
        });
      }

      try {
        const inviteToken = await assignPasswordInviteToken(prisma, result.user.id);
        const inviteUrl = buildPasswordInviteUrl(inviteToken);
        await sendPasswordInviteEmail({
          to: result.user.email,
          name: result.user.name,
          workspaceName: ws?.name,
          inviteUrl,
          kind: 'welcome',
        });
      } catch (mailErr) {
        await prisma.user.delete({ where: { id: result.user.id } }).catch(() => undefined);
        console.error('Create user invite email error:', mailErr);
        const msg = mailErr instanceof Error ? mailErr.message : 'Не удалось отправить приглашение';
        return res.status(500).json({ error: msg });
      }

      return res.json({
        ...result.user,
        inviteSent: true,
        message: `Приглашение отправлено на ${result.user.email}`,
      });
    }

    if (autoGeneratedPassword) {
      return res.json({
        ...result.user,
        inviteSent: false,
        initialPassword: plainPassword,
        message: 'Сотрудник добавлен. Передайте временный пароль сотруднику.',
      });
    }

    res.json({ ...result.user, inviteSent: false });
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

router.post('/:id/reset-password', requireStaffUser, async (req: AuthRequest, res) => {
  try {
    const workspaceId = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : '';
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId обязателен' });

    const manage = await assertCanManageWorkspace(prisma, req.userId!, workspaceId);
    if (!manage.ok || manage.role !== 'admin') {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, name: true },
    });
    if (!target) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const plainPassword = generateTempPassword();
    const hashedPassword = await hashPassword(plainPassword);

    await prisma.user.update({
      where: { id: target.id },
      data: {
        password: hashedPassword,
        mustChangePassword: true,
        emailVerified: true,
        passwordInviteToken: null,
        passwordInviteExpiresAt: null,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });

    const stored = await prisma.user.findUnique({
      where: { id: target.id },
      select: { password: true, email: true },
    });
    if (!stored || !(await verifyPassword(plainPassword, stored.password))) {
      console.error('Reset password verify failed for user', target.id);
      return res.status(500).json({ error: 'Не удалось сохранить новый пароль' });
    }

    let emailSent = false;
    if (isWorkspaceInviteEmailEnabled() && isEmailConfigured()) {
      try {
        await sendAdminTempPasswordEmail({
          to: stored.email,
          name: target.name,
          tempPassword: plainPassword,
          kind: 'reset',
        });
        emailSent = true;
      } catch (mailErr) {
        console.error('Reset temp password email error:', mailErr);
      }
    }

    return res.json({
      message: emailSent
        ? `Временный пароль отправлен на ${stored.email}. Также передайте его сотруднику вручную.`
        : 'Пароль сброшен. Передайте временный пароль сотруднику.',
      inviteSent: emailSent,
      loginEmail: stored.email,
      initialPassword: plainPassword,
    });
  } catch (error) {
    console.error('Reset user password error:', error);
    res.status(500).json({ error: 'Ошибка сброса пароля' });
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
        avatar: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const workspaceIdFromQuery =
      typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined;
    const membership = workspaceIdFromQuery
      ? await prisma.workspaceUser.findUnique({
          where: { workspaceId_userId: { workspaceId: workspaceIdFromQuery, userId: user.id } },
          select: { workspaceId: true },
        })
      : await prisma.workspaceUser.findFirst({
          where: { userId: user.id },
          select: { workspaceId: true },
        });
    const owned = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      select: { id: true, ownerId: true },
    });
    const workspaceId = workspaceIdFromQuery ?? membership?.workspaceId ?? owned?.id;

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId не определён' });
    }

    const access = req.userId ? await workspaceAccess(req, workspaceId) : null;
    if (!access) return res.status(403).json({ error: 'Недостаточно прав' });

    const confidentialKeys = await confidentialKeysForWorkspace(workspaceId);
    const ledGroupIds = await viewerLedGroupIds(req.userId!, workspaceId);
    const shaped = await shapeWorkspaceUserRow(
      user,
      workspaceId,
      access.workspace.ownerId,
      req.userId!,
      access.viewerRole,
      ledGroupIds,
      confidentialKeys,
    );
    if (!shaped) return res.status(404).json({ error: 'Сотрудник не найден в пространстве' });

    const groups = await prisma.userGroup.findMany({
      where: { userId: user.id, group: { workspaceId } },
      include: { group: { select: { id: true, name: true, departmentId: true } } },
    });

    res.json({
      ...shaped,
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
    const workspaceId = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : '';
    if (!req.userId) return res.status(403).json({ error: 'Недостаточно прав' });
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId обязателен' });

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, avatar: true, createdAt: true },
    });
    if (!target) return res.status(404).json({ error: 'Сотрудник не найден' });

    const access = await workspaceAccess(req, workspaceId);
    if (!access) return res.status(403).json({ error: 'Недостаточно прав' });

    const membership = await prisma.workspaceUser.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { profileFields: true },
    });
    const isOwner = access.workspace.ownerId === userId;
    if (!membership && !isOwner) {
      return res.status(400).json({ error: 'Сотрудник не привязан к пространству' });
    }

    const groupIds = await getWorkspaceGroupIdsForUser(prisma, userId, workspaceId);
    const ledGroupIds = await viewerLedGroupIds(req.userId, workspaceId);
    const perm = computeProfilePerm({
      viewerId: req.userId,
      viewerRole: access.viewerRole,
      ownerId: access.workspace.ownerId,
      targetId: userId,
      targetGroupIds: groupIds,
      ledGroupIds,
    });
    if (!perm.canEditAny) {
      return res.status(403).json({ error: 'Недостаточно прав для редактирования профиля' });
    }

    const schema = await ensureEmployeeProfileSchema(prisma, workspaceId);
    const confidentialKeys = new Set([...DEFAULT_CONFIDENTIAL_KEYS, ...getConfidentialKeys(schema)]);
    const existing = profileFieldsToObject(membership?.profileFields ?? {});
    const incoming = profileFieldsToObject(req.body?.profileFields ?? req.body);

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

    if (membership) {
      await prisma.workspaceUser.update({
        where: { workspaceId_userId: { workspaceId, userId } },
        data: { profileFields: validated.sanitized as Prisma.InputJsonValue },
      });
    } else if (isOwner) {
      await prisma.workspaceUser.create({
        data: {
          workspaceId,
          userId,
          role: 'admin',
          profileFields: validated.sanitized as Prisma.InputJsonValue,
        },
      });
    }

    const shaped = await shapeWorkspaceUserRow(
      target,
      workspaceId,
      access.workspace.ownerId,
      req.userId,
      access.viewerRole,
      ledGroupIds,
      confidentialKeys,
    );
    res.json(shaped);
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ error: 'Ошибка сохранения профиля' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { name, role, departmentId, groupIds, workspaceId } = req.body;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId обязателен' });

    const manage = await assertCanManageWorkspace(prisma, req.userId!, workspaceId);
    if (!manage.ok) return res.status(403).json({ error: 'Недостаточно прав' });

    const access = await workspaceAccess(req, workspaceId);
    if (!access) return res.status(403).json({ error: 'Недостаточно прав' });

    const nextDept = departmentId === undefined ? undefined : departmentId || null;
    const gids: string[] | undefined = groupIds !== undefined ? groupIds : undefined;
    const wsGroupIds = await getWorkspaceGroupIdSet(workspaceId);

    if (gids !== undefined) {
      const membership = await prisma.workspaceUser.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: req.params.id } },
        select: { departmentId: true },
      });
      const profile = await getWorkspaceMemberProfile(
        prisma,
        req.params.id,
        workspaceId,
        access.workspace.ownerId,
      );
      const deptForGroups = nextDept !== undefined ? nextDept : profile?.departmentId ?? membership?.departmentId;
      const groupGate = await assertUserGroupsMatchDepartment(
        prisma,
        req.params.id,
        deptForGroups,
        gids.filter((id: string) => wsGroupIds.has(id)),
      );
      if (!groupGate.ok) return res.status(400).json({ error: groupGate.error });
    }

    if (name !== undefined) {
      await prisma.user.update({
        where: { id: req.params.id },
        data: { name },
      });
    }

    const isOwner = access.workspace.ownerId === req.params.id;
    const membershipExists = await prisma.workspaceUser.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: req.params.id } },
      select: { id: true },
    });

    if (role !== undefined || departmentId !== undefined) {
      if (membershipExists) {
        await prisma.workspaceUser.update({
          where: { workspaceId_userId: { workspaceId, userId: req.params.id } },
          data: {
            ...(role !== undefined ? { role } : {}),
            ...(departmentId !== undefined ? { departmentId: departmentId || null } : {}),
          },
        });
      } else if (isOwner && role !== undefined) {
        await prisma.workspaceUser.create({
          data: {
            workspaceId,
            userId: req.params.id,
            role: role || 'admin',
            departmentId: departmentId || null,
          },
        });
      }
    }

    if (groupIds !== undefined) {
      await prisma.userGroup.deleteMany({
        where: {
          userId: req.params.id,
          groupId: { in: [...wsGroupIds] },
        },
      });

      const validGroupIds = gids!.filter((id: string) => wsGroupIds.has(id));
      if (validGroupIds.length > 0) {
        await prisma.userGroup.createMany({
          data: validGroupIds.map((groupId: string) => ({
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
            ? { workspaceId, departmentId: { not: nextDept } }
            : { workspaceId },
        },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, name: true, avatar: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const ledGroupIds = await viewerLedGroupIds(req.userId!, workspaceId);
    const confidentialKeys = await confidentialKeysForWorkspace(workspaceId);
    const shaped = await shapeWorkspaceUserRow(
      user,
      workspaceId,
      access.workspace.ownerId,
      req.userId!,
      access.viewerRole,
      ledGroupIds,
      confidentialKeys,
    );

    res.json(shaped);
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
