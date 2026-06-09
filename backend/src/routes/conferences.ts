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
import { postConferenceToAllChannels } from '../utils/conferenceChat';
import { sendScheduledConferenceInvites } from '../utils/conferenceInvites';
import { getWorkspaceMemberIds } from '../utils/workspaceMembers';

const router = Router();
const prisma = new PrismaClient();

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

    res.json(rows.map(mapConference));
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

    res.json(mapConference(conference));
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
    const conference = await prisma.conference.findUnique({
      where: { id: req.params.id },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    if (!conference) return res.status(404).json({ error: 'Конференция не найдена' });
    if (!(await assertWorkspaceMember(prisma, conference.workspaceId, req.userId!, req.userRole))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const count = await postConferenceToAllChannels(prisma, {
      workspaceId: conference.workspaceId,
      userId: req.userId!,
      title: conference.title,
      shareToken: conference.shareToken,
      creatorName: conference.createdBy.name,
      startAt: conference.startAt,
      endAt: conference.endAt,
    });

    res.json({ message: `Ссылка отправлена в ${count} канал(ов)`, channelsCount: count });
  } catch (error) {
    console.error('Share conference to chat error:', error);
    res.status(500).json({ error: 'Ошибка отправки в чат' });
  }
});

export default router;
