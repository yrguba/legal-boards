import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { authenticate, AuthRequest, requireStaffUser } from '../middleware/auth';
import { broadcast } from '../realtime';
import { getUploadsPath, toPublicUploadPath } from '../uploadsPath';
import { decodeMultipartFilename } from '../utils/decodeMultipartFilename';
import { assertWorkspaceMember, getUserDocumentAccess } from '../utils/documentAccess';
import {
  ensureChannelsForWorkspace,
  ensureDirectChannel,
  parseDirectUserIds,
  userCanSeeChannel,
  userIsDirectParticipant,
  CHAT_SCOPE,
} from '../utils/workspaceChatChannels';

const router = Router();
const prisma = new PrismaClient();
const MSG_PAGE = 50;

const chatUpload = multer({
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
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(decodeMultipartFilename(file.originalname));
      cb(null, 'wc-' + uniqueSuffix + ext);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const messageInclude = {
  user: { select: { id: true, name: true, avatar: true, email: true } },
  attachments: { orderBy: { createdAt: 'asc' as const } },
} as const;

function mapMessage(m: {
  id: string;
  content: string;
  createdAt: Date;
  user: { id: string; name: string; avatar: string | null; email: string };
  attachments?: {
    id: string;
    name: string;
    type: string;
    size: number;
    path: string;
    createdAt: Date;
  }[];
}) {
  return {
    id: m.id,
    content: m.content,
    createdAt: m.createdAt,
    user: m.user,
    attachments: (m.attachments ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      size: a.size,
      path: a.path,
      createdAt: a.createdAt,
    })),
  };
}

const SCOPE_ORDER: Record<string, number> = {
  [CHAT_SCOPE.direct]: 0,
  [CHAT_SCOPE.workspace]: 1,
  [CHAT_SCOPE.department]: 2,
  [CHAT_SCOPE.group]: 3,
};

type ChannelRow = {
  id: string;
  channelKey: string;
  workspaceId: string;
  scope: string;
  title: string;
  departmentId: string | null;
  groupId: string | null;
  directUserIds: unknown;
  createdAt: Date;
};

async function assertChannelAccess(req: AuthRequest, channel: ChannelRow): Promise<boolean> {
  if (
    !(await assertWorkspaceMember(prisma, channel.workspaceId, req.userId!, req.userRole))
  ) {
    return false;
  }

  if (channel.scope === CHAT_SCOPE.direct) {
    return userIsDirectParticipant(req.userId!, channel.directUserIds);
  }

  const wsForOwner = await prisma.workspace.findUnique({
    where: { id: channel.workspaceId },
    select: { ownerId: true },
  });
  const isWorkspaceOwner = wsForOwner?.ownerId === req.userId;
  if (req.userRole === 'admin' || isWorkspaceOwner) {
    return true;
  }

  const access = await getUserDocumentAccess(prisma, req.userId!, channel.workspaceId);
  return userCanSeeChannel(access, channel, req.userId);
}

async function mapChannelForUser(channel: ChannelRow, userId: string) {
  const base = {
    id: channel.id,
    channelKey: channel.channelKey,
    scope: channel.scope,
    title: channel.title,
    departmentId: channel.departmentId,
    groupId: channel.groupId,
    directUserIds: parseDirectUserIds(channel.directUserIds),
    createdAt: channel.createdAt,
  };

  if (channel.scope !== CHAT_SCOPE.direct) {
    return { ...base, peerUser: null as null };
  }

  const peerId = parseDirectUserIds(channel.directUserIds).find((id) => id !== userId);
  const peer = peerId
    ? await prisma.user.findUnique({
        where: { id: peerId },
        select: { id: true, name: true, avatar: true, email: true },
      })
    : null;

  return {
    ...base,
    title: peer?.name ?? channel.title,
    peerUser: peer,
  };
}

router.use(authenticate);
router.use(requireStaffUser);

router.get('/workspace/:workspaceId/channels', async (req: AuthRequest, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.userId!;
    if (!(await assertWorkspaceMember(prisma, workspaceId, userId, req.userRole))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    await ensureChannelsForWorkspace(prisma, workspaceId);

    const channels = await prisma.workspaceChatChannel.findMany({
      where: { workspaceId },
    });

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });
    const isWorkspaceOwner = workspace?.ownerId === userId;
    const isGlobalAdmin = req.userRole === 'admin';
    const canSeeAllChannels = isGlobalAdmin || isWorkspaceOwner;
    const access = canSeeAllChannels
      ? null
      : await getUserDocumentAccess(prisma, userId, workspaceId);

    const filtered = channels.filter((c) => {
      if (c.scope === CHAT_SCOPE.direct) {
        return userIsDirectParticipant(userId, c.directUserIds);
      }
      if (canSeeAllChannels) return true;
      return access && userCanSeeChannel(access, c, userId);
    });

    const visible = await Promise.all(
      filtered
        .sort((a, b) => {
          const oa = SCOPE_ORDER[a.scope] ?? 99;
          const ob = SCOPE_ORDER[b.scope] ?? 99;
          if (oa !== ob) return oa - ob;
          return a.title.localeCompare(b.title, 'ru');
        })
        .map((c) => mapChannelForUser(c, userId)),
    );

    return res.json(visible);
  } catch (e) {
    console.error('Workspace chat channels error:', e);
    return res.status(500).json({ error: 'Ошибка загрузки каналов' });
  }
});

router.post('/workspace/:workspaceId/direct', async (req: AuthRequest, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.userId!;
    const participantUserId =
      typeof req.body?.participantUserId === 'string' ? req.body.participantUserId.trim() : '';

    if (!participantUserId) {
      return res.status(400).json({ error: 'participantUserId обязателен' });
    }
    if (participantUserId === userId) {
      return res.status(400).json({ error: 'Нельзя создать личный чат с самим собой' });
    }
    if (!(await assertWorkspaceMember(prisma, workspaceId, userId, req.userRole))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    if (!(await assertWorkspaceMember(prisma, workspaceId, participantUserId, req.userRole))) {
      return res.status(400).json({ error: 'Собеседник не является участником пространства' });
    }

    const channel = await ensureDirectChannel(prisma, workspaceId, userId, participantUserId);
    return res.json(await mapChannelForUser(channel, userId));
  } catch (e) {
    console.error('Create direct chat error:', e);
    return res.status(500).json({ error: 'Ошибка создания личного чата' });
  }
});

router.get('/channels/:channelId/messages', async (req: AuthRequest, res) => {
  try {
    const { channelId } = req.params;
    const beforeRaw = req.query.before as string | undefined;
    const beforeDate = beforeRaw ? new Date(beforeRaw) : null;
    if (beforeRaw && beforeDate && isNaN(beforeDate.getTime())) {
      return res.status(400).json({ error: 'Некорректный параметр before' });
    }

    const channel = await prisma.workspaceChatChannel.findUnique({
      where: { id: channelId },
    });
    if (!channel) {
      return res.status(404).json({ error: 'Канал не найден' });
    }
    if (!(await assertChannelAccess(req, channel))) {
      return res.status(403).json({ error: 'Нет доступа к каналу' });
    }

    const where = {
      channelId,
      ...(beforeDate && !isNaN(beforeDate.getTime()) ? { createdAt: { lt: beforeDate } } : {}),
    };

    const batch = await prisma.workspaceChatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MSG_PAGE + 1,
      include: messageInclude,
    });

    const hasMore = batch.length > MSG_PAGE;
    const slice = hasMore ? batch.slice(0, MSG_PAGE) : batch;
    const messages = slice.reverse().map(mapMessage);

    return res.json({ messages, hasMore });
  } catch (e) {
    console.error('Workspace chat messages error:', e);
    return res.status(500).json({ error: 'Ошибка загрузки сообщений' });
  }
});

router.post('/channels/:channelId/messages', chatUpload.array('files', 10), async (req: AuthRequest, res) => {
  try {
    const { channelId } = req.params;
    const content =
      typeof req.body?.content === 'string'
        ? req.body.content.trim()
        : typeof req.body?.content === 'number'
          ? String(req.body.content).trim()
          : '';
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];

    if (!content && files.length === 0) {
      return res.status(400).json({ error: 'Сообщение или вложение обязательны' });
    }

    const channel = await prisma.workspaceChatChannel.findUnique({
      where: { id: channelId },
    });
    if (!channel) {
      return res.status(404).json({ error: 'Канал не найден' });
    }
    if (!(await assertChannelAccess(req, channel))) {
      return res.status(403).json({ error: 'Нет доступа к каналу' });
    }

    const msg = await prisma.workspaceChatMessage.create({
      data: {
        channelId,
        userId: req.userId!,
        content,
        ...(files.length > 0
          ? {
              attachments: {
                create: files.map((file) => ({
                  name: decodeMultipartFilename(file.originalname),
                  type: file.mimetype,
                  size: file.size,
                  path: toPublicUploadPath(file.path),
                  uploadedBy: req.userId!,
                })),
              },
            }
          : {}),
      },
      include: messageInclude,
    });

    const payload = mapMessage(msg);

    broadcast({
      type: 'workspace_chat_message',
      channelId,
      workspaceId: channel.workspaceId,
      scope: channel.scope,
      directUserIds: parseDirectUserIds(channel.directUserIds),
      message: payload,
      authorUserId: req.userId,
    });

    return res.json(payload);
  } catch (e) {
    console.error('Workspace chat post error:', e);
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('WorkspaceChatMessageAttachment')) {
      return res.status(503).json({
        error: 'Вложения в чате не настроены на сервере. Выполните prisma migrate deploy.',
      });
    }
    return res.status(500).json({ error: 'Ошибка отправки сообщения' });
  }
});

export default router;
