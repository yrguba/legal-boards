import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, requireStaffUser } from '../middleware/auth';
import { assertWorkspaceMember } from '../utils/documentAccess';
import {
  buildPublicJoinUrl,
  generateRoomName,
  generateShareToken,
  getJitsiDomain,
  isConferencesEnabled,
} from '../utils/conferences';
import { postConferenceToChannel } from '../utils/conferenceChat';
import { getUserDocumentAccess } from '../utils/documentAccess';
import {
  CHAT_SCOPE,
  userCanSeeChannel,
  userIsDirectParticipant,
} from '../utils/workspaceChatChannels';
import {
  sendScheduledConferenceInvites,
  sendConferenceCancellationNotices,
  sendConferenceUpdateNotices,
} from '../utils/conferenceInvites';
import { getWorkspaceMemberIds } from '../utils/workspaceMembers';

const router = Router();
const prisma = new PrismaClient();

function canManageConference(c: { createdById: string }, req: AuthRequest): boolean {
  return c.createdById === req.userId || req.userRole === 'admin';
}

async function loadCalendarMeta(calendarEventId: string | null) {
  if (!calendarEventId) {
    return { description: null as string | null, attendeeIds: [] as string[] };
  }
  const ev = await prisma.calendarEvent.findUnique({
    where: { id: calendarEventId },
    include: { attendees: { select: { userId: true } } },
  });
  if (!ev) return { description: null, attendeeIds: [] };
  return {
    description: ev.description,
    attendeeIds: ev.attendees.map((a) => a.userId),
  };
}

async function mapConferenceEnriched(c: {
  id: string;
  workspaceId: string;
  title: string;
  roomName: string;
  shareToken: string;
  mode: string;
  status: string;
  startAt: Date;
  endAt: Date | null;
  createdById: string;
  calendarEventId: string | null;
  allowGuests: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: { id: string; name: string; email: string; avatar: string | null };
}) {
  const { description, attendeeIds } = await loadCalendarMeta(c.calendarEventId);
  return {
    ...mapConference(c),
    description,
    attendeeIds,
    attendeeCount: attendeeIds.length,
  };
}

function mapConference(c: {
  id: string;
  workspaceId: string;
  title: string;
  roomName: string;
  shareToken: string;
  mode: string;
  status: string;
  startAt: Date;
  endAt: Date | null;
  createdById: string;
  allowGuests: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: { id: string; name: string; email: string; avatar: string | null };
}) {
  return {
    id: c.id,
    workspaceId: c.workspaceId,
    title: c.title,
    roomName: c.roomName,
    shareToken: c.shareToken,
    mode: c.mode,
    status: c.status,
    startAt: c.startAt.toISOString(),
    endAt: c.endAt?.toISOString() ?? null,
    createdById: c.createdById,
    allowGuests: c.allowGuests,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    joinUrl: buildPublicJoinUrl(c.shareToken),
    jitsiDomain: getJitsiDomain(),
    createdBy: c.createdBy,
    canJoin: canJoinConference(c),
  };
}

function canJoinConference(c: { status: string; mode: string; startAt: Date; endAt: Date | null }): boolean {
  if (c.status === 'cancelled' || c.status === 'ended') return false;
  if (c.mode === 'instant' && c.status === 'active') return true;
  if (c.mode === 'scheduled' && c.status === 'scheduled') {
    const now = Date.now();
    const start = c.startAt.getTime();
    const end = c.endAt?.getTime() ?? start + 2 * 60 * 60 * 1000;
    return now >= start - 15 * 60 * 1000 && now <= end;
  }
  return c.status === 'active';
}

router.get('/config', (_req, res) => {
  res.json({
    enabled: isConferencesEnabled(),
    jitsiDomain: getJitsiDomain(),
  });
});

/** Публичная информация для входа гостя (без auth) */
router.get('/public/:shareToken', async (req, res) => {
  try {
    if (!isConferencesEnabled()) {
      return res.status(403).json({ error: 'Конференции отключены' });
    }

    const conference = await prisma.conference.findUnique({
      where: { shareToken: req.params.shareToken },
      select: {
        id: true,
        title: true,
        roomName: true,
        status: true,
        mode: true,
        startAt: true,
        endAt: true,
        allowGuests: true,
      },
    });

    if (!conference) {
      return res.status(404).json({ error: 'Конференция не найдена' });
    }
    if (!conference.allowGuests) {
      return res.status(403).json({ error: 'Гостевой вход отключён' });
    }
    if (!canJoinConference(conference)) {
      return res.status(403).json({ error: 'Конференция недоступна для входа' });
    }

    res.json({
      title: conference.title,
      roomName: conference.roomName,
      jitsiDomain: getJitsiDomain(),
      status: conference.status,
    });
  } catch (error) {
    console.error('Conference public info error:', error);
    res.status(500).json({ error: 'Ошибка загрузки конференции' });
  }
});

router.use(authenticate);
router.use(requireStaffUser);

router.use((_req, res, next) => {
  if (!isConferencesEnabled()) {
    return res.status(403).json({ error: 'Конференции отключены' });
  }
  next();
});

router.get('/workspace/:workspaceId', async (req: AuthRequest, res) => {
  try {
    const { workspaceId } = req.params;
    if (!(await assertWorkspaceMember(prisma, workspaceId, req.userId!, req.userRole))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const rows = await prisma.conference.findMany({
      where: {
        workspaceId,
        status: { in: ['active', 'scheduled'] },
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: [{ status: 'asc' }, { startAt: 'desc' }],
      take: 50,
    });

    res.json(rows.map((c) => mapConference(c)));
  } catch (error) {
    console.error('List conferences error:', error);
    res.status(500).json({ error: 'Ошибка загрузки конференций' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const conference = await prisma.conference.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });
    if (!conference) return res.status(404).json({ error: 'Конференция не найдена' });

    if (!(await assertWorkspaceMember(prisma, conference.workspaceId, req.userId!, req.userRole))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    res.json(await mapConferenceEnriched(conference));
  } catch (error) {
    console.error('Get conference error:', error);
    res.status(500).json({ error: 'Ошибка загрузки конференции' });
  }
});

router.post('/scheduled', async (req: AuthRequest, res) => {
  try {
    const { workspaceId, title, description, startAt, endAt, attendeeIds } = req.body as {
      workspaceId?: string;
      title?: string;
      description?: string | null;
      startAt?: string;
      endAt?: string;
      attendeeIds?: string[];
    };

    if (!workspaceId || !title || !startAt || !endAt) {
      return res.status(400).json({ error: 'Нужны workspaceId, title, startAt, endAt' });
    }
    if (!(await assertWorkspaceMember(prisma, workspaceId, req.userId!, req.userRole))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ error: 'Некорректный интервал времени' });
    }
    if (start.getTime() < Date.now() - 60_000) {
      return res.status(400).json({ error: 'Нельзя запланировать конференцию в прошлом' });
    }

    const memberIds = await getWorkspaceMemberIds(prisma, workspaceId);
    const rawIds = Array.isArray(attendeeIds) ? attendeeIds : [];
    const validAttendee = rawIds.filter((id) => memberIds.has(id));

    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { name: true },
    });
    const creatorName = user?.name ?? 'Организатор';
    const trimmedTitle = String(title).trim();

    const conference = await prisma.$transaction(async (tx) => {
      const calendarEvent = await tx.calendarEvent.create({
        data: {
          workspaceId,
          title: trimmedTitle,
          description: description ? String(description).trim() : null,
          startAt: start,
          endAt: end,
          createdById: req.userId!,
          attendees: {
            create: validAttendee.map((userId) => ({ userId })),
          },
        },
      });

      return tx.conference.create({
        data: {
          workspaceId,
          title: trimmedTitle,
          roomName: generateRoomName(),
          shareToken: generateShareToken(),
          mode: 'scheduled',
          status: 'scheduled',
          startAt: start,
          endAt: end,
          calendarEventId: calendarEvent.id,
          createdById: req.userId!,
          allowGuests: true,
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true, avatar: true } },
        },
      });
    });

    const inviteAttendeeIds = [...new Set([req.userId!, ...validAttendee])];
    const inviteStats = await sendScheduledConferenceInvites(prisma, {
      conferenceId: conference.id,
      workspaceId,
      creatorId: req.userId!,
      creatorName,
      title: trimmedTitle,
      shareToken: conference.shareToken,
      startAt: start,
      endAt: end,
      attendeeIds: inviteAttendeeIds,
    });

    res.status(201).json({ ...mapConference(conference), inviteStats });
  } catch (error) {
    console.error('Create scheduled conference error:', error);
    res.status(500).json({ error: 'Ошибка планирования конференции' });
  }
});

router.post('/instant', async (req: AuthRequest, res) => {
  try {
    const { workspaceId, title } = req.body;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId обязателен' });
    if (!(await assertWorkspaceMember(prisma, workspaceId, req.userId!, req.userRole))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { name: true },
    });

    const conference = await prisma.conference.create({
      data: {
        workspaceId,
        title: typeof title === 'string' && title.trim() ? title.trim() : `Конференция ${user?.name ?? ''}`.trim(),
        roomName: generateRoomName(),
        shareToken: generateShareToken(),
        mode: 'instant',
        status: 'active',
        startAt: new Date(),
        createdById: req.userId!,
        allowGuests: true,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    res.status(201).json(mapConference(conference));
  } catch (error) {
    console.error('Create instant conference error:', error);
    res.status(500).json({ error: 'Ошибка создания конференции' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const conference = await prisma.conference.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });
    if (!conference) return res.status(404).json({ error: 'Конференция не найдена' });
    if (!(await assertWorkspaceMember(prisma, conference.workspaceId, req.userId!, req.userRole))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    if (!canManageConference(conference, req)) {
      return res.status(403).json({ error: 'Только организатор может изменить конференцию' });
    }
    if (conference.mode !== 'scheduled' || conference.status !== 'scheduled') {
      return res.status(400).json({ error: 'Редактировать можно только запланированную конференцию' });
    }
    if (!conference.calendarEventId) {
      return res.status(400).json({ error: 'Нет связанного события календаря' });
    }

    const { title, description, startAt, endAt, attendeeIds } = req.body as {
      title?: string;
      description?: string | null;
      startAt?: string;
      endAt?: string;
      attendeeIds?: string[];
    };

    const start = startAt != null ? new Date(startAt) : conference.startAt;
    const end = endAt != null ? new Date(endAt) : conference.endAt;
    if (!end || isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ error: 'Некорректный интервал времени' });
    }
    if (start.getTime() < Date.now() - 60_000) {
      return res.status(400).json({ error: 'Нельзя перенести конференцию в прошлое' });
    }

    const trimmedTitle =
      title !== undefined ? String(title).trim() : conference.title;
    if (!trimmedTitle) {
      return res.status(400).json({ error: 'Укажите название' });
    }

    const memberIds = await getWorkspaceMemberIds(prisma, conference.workspaceId);
    const rawIds = attendeeIds !== undefined && Array.isArray(attendeeIds) ? attendeeIds : null;
    const validAttendee = rawIds ? rawIds.filter((id) => memberIds.has(id)) : null;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.calendarEvent.update({
        where: { id: conference.calendarEventId! },
        data: {
          title: trimmedTitle,
          description:
            description === undefined
              ? undefined
              : description
                ? String(description).trim()
                : null,
          startAt: start,
          endAt: end,
          ...(validAttendee
            ? {
                attendees: {
                  deleteMany: {},
                  create: validAttendee.map((userId) => ({ userId })),
                },
              }
            : {}),
        },
      });

      return tx.conference.update({
        where: { id: conference.id },
        data: {
          title: trimmedTitle,
          startAt: start,
          endAt: end,
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true, avatar: true } },
        },
      });
    });

    const meta = await loadCalendarMeta(updated.calendarEventId);
    const notifyIds = [...new Set([req.userId!, ...meta.attendeeIds])];
    const creatorName = updated.createdBy?.name ?? 'Организатор';
    const notifyStats = await sendConferenceUpdateNotices(prisma, {
      conferenceId: updated.id,
      creatorId: req.userId!,
      creatorName,
      title: trimmedTitle,
      shareToken: updated.shareToken,
      startAt: start,
      endAt: end,
      attendeeIds: notifyIds,
    });

    res.json({ ...(await mapConferenceEnriched(updated)), notifyStats });
  } catch (error) {
    console.error('Update conference error:', error);
    res.status(500).json({ error: 'Ошибка обновления конференции' });
  }
});

router.post('/:id/cancel', async (req: AuthRequest, res) => {
  try {
    const conference = await prisma.conference.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });
    if (!conference) return res.status(404).json({ error: 'Конференция не найдена' });
    if (!(await assertWorkspaceMember(prisma, conference.workspaceId, req.userId!, req.userRole))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    if (!canManageConference(conference, req)) {
      return res.status(403).json({ error: 'Только организатор может отменить конференцию' });
    }
    if (conference.mode !== 'scheduled' || conference.status !== 'scheduled') {
      return res.status(400).json({ error: 'Отменить можно только запланированную конференцию' });
    }

    const meta = await loadCalendarMeta(conference.calendarEventId);
    const endAt = conference.endAt ?? conference.startAt;
    const creatorName = conference.createdBy?.name ?? 'Организатор';
    const notifyIds = [...new Set([conference.createdById, ...meta.attendeeIds])];

    await prisma.$transaction(async (tx) => {
      if (conference.calendarEventId) {
        await tx.calendarEvent.delete({ where: { id: conference.calendarEventId } });
      }
      await tx.conference.update({
        where: { id: conference.id },
        data: { status: 'cancelled', endAt: new Date() },
      });
    });

    const notifyStats = await sendConferenceCancellationNotices(prisma, {
      conferenceId: conference.id,
      creatorId: conference.createdById,
      creatorName,
      title: conference.title,
      startAt: conference.startAt,
      endAt,
      attendeeIds: notifyIds,
    });

    res.json({
      message: 'Конференция отменена',
      notifyStats,
    });
  } catch (error) {
    console.error('Cancel conference error:', error);
    res.status(500).json({ error: 'Ошибка отмены конференции' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const conference = await prisma.conference.findUnique({
      where: { id: req.params.id },
    });
    if (!conference) return res.status(404).json({ error: 'Конференция не найдена' });
    if (!(await assertWorkspaceMember(prisma, conference.workspaceId, req.userId!, req.userRole))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    if (!canManageConference(conference, req)) {
      return res.status(403).json({ error: 'Только организатор может удалить конференцию' });
    }

    if (conference.mode === 'instant') {
      await prisma.conference.delete({ where: { id: conference.id } });
      return res.json({ message: 'Конференция удалена' });
    }

    if (conference.mode === 'scheduled' && conference.status === 'scheduled') {
      const meta = await loadCalendarMeta(conference.calendarEventId);
      const hasInvitees = meta.attendeeIds.some((id) => id !== conference.createdById);
      if (hasInvitees) {
        return res.status(400).json({
          error: 'У запланированной конференции с участниками используйте «Отменить» — участники получат уведомление',
          code: 'USE_CANCEL',
        });
      }
      await prisma.$transaction(async (tx) => {
        if (conference.calendarEventId) {
          await tx.calendarEvent.delete({ where: { id: conference.calendarEventId } });
        }
        await tx.conference.delete({ where: { id: conference.id } });
      });
      return res.json({ message: 'Конференция удалена' });
    }

    return res.status(400).json({ error: 'Эту конференцию нельзя удалить' });
  } catch (error) {
    console.error('Delete conference error:', error);
    res.status(500).json({ error: 'Ошибка удаления конференции' });
  }
});

router.post('/:id/end', async (req: AuthRequest, res) => {
  try {
    const conference = await prisma.conference.findUnique({ where: { id: req.params.id } });
    if (!conference) return res.status(404).json({ error: 'Конференция не найдена' });
    if (conference.createdById !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Только организатор может завершить конференцию' });
    }

    if (conference.status === 'ended') {
      const existing = await prisma.conference.findUnique({
        where: { id: conference.id },
        include: { createdBy: { select: { id: true, name: true, email: true, avatar: true } } },
      });
      return res.json(mapConference(existing!));
    }

    const updated = await prisma.conference.update({
      where: { id: conference.id },
      data: { status: 'ended', endAt: new Date() },
      include: {
        createdBy: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    res.json(mapConference(updated));
  } catch (error) {
    console.error('End conference error:', error);
    res.status(500).json({ error: 'Ошибка завершения конференции' });
  }
});

router.post('/:id/share-chat', async (req: AuthRequest, res) => {
  try {
    const channelId =
      typeof req.body?.channelId === 'string' ? req.body.channelId.trim() : '';
    if (!channelId) {
      return res.status(400).json({ error: 'channelId обязателен' });
    }

    const conference = await prisma.conference.findUnique({
      where: { id: req.params.id },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    if (!conference) return res.status(404).json({ error: 'Конференция не найдена' });
    if (!(await assertWorkspaceMember(prisma, conference.workspaceId, req.userId!, req.userRole))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const channel = await prisma.workspaceChatChannel.findUnique({
      where: { id: channelId },
    });
    if (!channel || channel.workspaceId !== conference.workspaceId) {
      return res.status(404).json({ error: 'Канал не найден' });
    }

    if (channel.scope === CHAT_SCOPE.direct) {
      if (!userIsDirectParticipant(req.userId!, channel.directUserIds)) {
        return res.status(403).json({ error: 'Нет доступа к каналу' });
      }
    } else {
      const workspace = await prisma.workspace.findUnique({
        where: { id: channel.workspaceId },
        select: { ownerId: true },
      });
      const isWorkspaceOwner = workspace?.ownerId === req.userId;
      if (req.userRole !== 'admin' && !isWorkspaceOwner) {
        const access = await getUserDocumentAccess(prisma, req.userId!, channel.workspaceId);
        if (!userCanSeeChannel(access, channel, req.userId!)) {
          return res.status(403).json({ error: 'Нет доступа к каналу' });
        }
      }
    }

    await postConferenceToChannel(prisma, {
      channelId: channel.id,
      userId: req.userId!,
      title: conference.title,
      shareToken: conference.shareToken,
      creatorName: conference.createdBy.name,
      startAt: conference.startAt,
      endAt: conference.endAt,
    });

    res.json({ message: `Ссылка отправлена в «${channel.title}»`, channelTitle: channel.title });
  } catch (error) {
    console.error('Share conference to chat error:', error);
    res.status(500).json({ error: 'Ошибка отправки в чат' });
  }
});

export default router;
