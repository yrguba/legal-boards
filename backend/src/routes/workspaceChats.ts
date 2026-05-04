import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, requireStaffUser } from '../middleware/auth';
import { assertWorkspaceMember, getUserDocumentAccess } from '../utils/documentAccess';
import {
  ensureChannelsForWorkspace,
  userCanSeeChannel,
  CHAT_SCOPE,
} from '../utils/workspaceChatChannels';

const router = Router();
const prisma = new PrismaClient();
const MSG_PAGE = 50;

const SCOPE_ORDER: Record<string, number> = {
  [CHAT_SCOPE.workspace]: 0,
  [CHAT_SCOPE.department]: 1,
  [CHAT_SCOPE.group]: 2,
};

router.use(authenticate);
router.use(requireStaffUser);

router.get('/workspace/:workspaceId/channels', async (req: AuthRequest, res) => {
  try {
    const { workspaceId } = req.params;
    if (!(await assertWorkspaceMember(prisma, workspaceId, req.userId!, req.userRole))) {
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
    const isWorkspaceOwner = workspace?.ownerId === req.userId;
    const isGlobalAdmin = req.userRole === 'admin';
    const canSeeAllChannels = isGlobalAdmin || isWorkspaceOwner;
    const access = canSeeAllChannels
      ? null
      : await getUserDocumentAccess(prisma, req.userId!, workspaceId);
    const filtered = canSeeAllChannels
      ? channels
      : channels.filter((c) => access && userCanSeeChannel(access, c));
    const visible = filtered.sort((a, b) => {
        const oa = SCOPE_ORDER[a.scope] ?? 99;
        const ob = SCOPE_ORDER[b.scope] ?? 99;
        if (oa !== ob) return oa - ob;
        return a.title.localeCompare(b.title, 'ru');
      });

    return res.json(
      visible.map((c) => ({
        id: c.id,
        channelKey: c.channelKey,
        scope: c.scope,
        title: c.title,
        departmentId: c.departmentId,
        groupId: c.groupId,
        createdAt: c.createdAt,
      })),
    );
  } catch (e) {
    console.error('Workspace chat channels error:', e);
    return res.status(500).json({ error: 'Ошибка загрузки каналов' });
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
    if (!(await assertWorkspaceMember(prisma, channel.workspaceId, req.userId!, req.userRole))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    const wsForOwner = await prisma.workspace.findUnique({
      where: { id: channel.workspaceId },
      select: { ownerId: true },
    });
    const isWorkspaceOwner = wsForOwner?.ownerId === req.userId;
    if (req.userRole !== 'admin' && !isWorkspaceOwner) {
      const access = await getUserDocumentAccess(prisma, req.userId!, channel.workspaceId);
      if (!userCanSeeChannel(access, channel)) {
        return res.status(403).json({ error: 'Нет доступа к каналу' });
      }
    }

    const where = {
      channelId,
      ...(beforeDate && !isNaN(beforeDate.getTime()) ? { createdAt: { lt: beforeDate } } : {}),
    };

    const batch = await prisma.workspaceChatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MSG_PAGE + 1,
      include: {
        user: { select: { id: true, name: true, avatar: true, email: true } },
      },
    });

    const hasMore = batch.length > MSG_PAGE;
    const slice = hasMore ? batch.slice(0, MSG_PAGE) : batch;
    const messages = slice.reverse().map((m) => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt,
      user: m.user,
    }));

    return res.json({ messages, hasMore });
  } catch (e) {
    console.error('Workspace chat messages error:', e);
    return res.status(500).json({ error: 'Ошибка загрузки сообщений' });
  }
});

router.post('/channels/:channelId/messages', async (req: AuthRequest, res) => {
  try {
    const { channelId } = req.params;
    const { content } = req.body;
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Пустое сообщение' });
    }

    const channel = await prisma.workspaceChatChannel.findUnique({
      where: { id: channelId },
    });
    if (!channel) {
      return res.status(404).json({ error: 'Канал не найден' });
    }
    if (!(await assertWorkspaceMember(prisma, channel.workspaceId, req.userId!, req.userRole))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    const wsForOwner = await prisma.workspace.findUnique({
      where: { id: channel.workspaceId },
      select: { ownerId: true },
    });
    const isWorkspaceOwner = wsForOwner?.ownerId === req.userId;
    if (req.userRole !== 'admin' && !isWorkspaceOwner) {
      const access = await getUserDocumentAccess(prisma, req.userId!, channel.workspaceId);
      if (!userCanSeeChannel(access, channel)) {
        return res.status(403).json({ error: 'Нет доступа к каналу' });
      }
    }

    const msg = await prisma.workspaceChatMessage.create({
      data: {
        channelId,
        userId: req.userId!,
        content: content.trim(),
      },
      include: {
        user: { select: { id: true, name: true, avatar: true, email: true } },
      },
    });

    return res.json({
      id: msg.id,
      content: msg.content,
      createdAt: msg.createdAt,
      user: msg.user,
    });
  } catch (e) {
    console.error('Workspace chat post error:', e);
    return res.status(500).json({ error: 'Ошибка отправки сообщения' });
  }
});

export default router;
