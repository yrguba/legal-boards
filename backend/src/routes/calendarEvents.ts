import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { assertWorkspaceMember } from '../utils/documentAccess';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

async function getWorkspaceMemberIds(workspaceId: string): Promise<Set<string>> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });
  if (!ws) {
    return new Set();
  }
  const members = await prisma.workspaceUser.findMany({
    where: { workspaceId },
    select: { userId: true },
  });
  return new Set([ws.ownerId, ...members.map((m) => m.userId)]);
}

const eventInclude = {
  createdBy: { select: { id: true, name: true, email: true, avatar: true } },
  attendees: {
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
  },
} as const;

function mapEvent(
  e: {
    id: string;
    workspaceId: string;
    title: string;
    description: string | null;
    startAt: Date;
    endAt: Date;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: { id: string; name: string; email: string; avatar: string | null };
    attendees: { user: { id: string; name: string; email: string; avatar: string | null } }[];
  },
) {
  return {
    id: e.id,
    workspaceId: e.workspaceId,
    title: e.title,
    description: e.description,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt.toISOString(),
    createdById: e.createdById,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    createdBy: e.createdBy,
    attendeeUserIds: (e.attendees ?? []).map((a) => a.user.id),
    attendees: (e.attendees ?? []).map((a) => a.user).filter((u) => u != null),
  };
}

/** События, пересекающиеся с интервалом [from, to) */
function firstQueryVal(v: string | string[] | undefined): string | undefined {
  if (v == null) {
    return undefined;
  }
  return Array.isArray(v) ? v[0] : v;
}

router.get('/workspace/:workspaceId', async (req: AuthRequest, res) => {
  try {
    const { workspaceId } = req.params;
    const fromRaw = firstQueryVal(req.query.from as string | string[] | undefined);
    const toRaw = firstQueryVal(req.query.to as string | string[] | undefined);
    if (!fromRaw || !toRaw) {
      return res.status(400).json({ error: 'Укажите from и to (ISO 8601)' });
    }
    const from = new Date(fromRaw);
    const to = new Date(toRaw);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return res.status(400).json({ error: 'Некорректные даты' });
    }
    if (!(await assertWorkspaceMember(prisma, workspaceId, req.userId!, req.userRole))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const rows = await prisma.calendarEvent.findMany({
      where: {
        workspaceId,
        startAt: { lt: to },
        endAt: { gt: from },
      },
      orderBy: { startAt: 'asc' },
      include: eventInclude,
    });

    return res.json(rows.map(mapEvent));
  } catch (e) {
    console.error('Calendar list error:', e);
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({
      error: 'Ошибка загрузки событий',
      ...(process.env.NODE_ENV === 'development' ? { details: msg } : {}),
    });
  }
});

router.post('/', async (req: AuthRequest, res) => {
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

    const memberIds = await getWorkspaceMemberIds(workspaceId);
    const rawIds = Array.isArray(attendeeIds) ? attendeeIds : [];
    const validAttendee = rawIds.filter((id) => memberIds.has(id));

    const created = await prisma.calendarEvent.create({
      data: {
        workspaceId,
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        startAt: start,
        endAt: end,
        createdById: req.userId!,
        attendees: {
          create: validAttendee.map((userId) => ({ userId })),
        },
      },
      include: eventInclude,
    });

    return res.json(mapEvent(created));
  } catch (e) {
    console.error('Calendar create error:', e);
    return res.status(500).json({ error: 'Ошибка создания события' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { title, description, startAt, endAt, attendeeIds } = req.body as {
      title?: string;
      description?: string | null;
      startAt?: string;
      endAt?: string;
      attendeeIds?: string[];
    };

    const existing = await prisma.calendarEvent.findUnique({
      where: { id: req.params.id },
      include: { attendees: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Событие не найдено' });
    }
    if (!(await assertWorkspaceMember(prisma, existing.workspaceId, req.userId!, req.userRole))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const memberIds = await getWorkspaceMemberIds(existing.workspaceId);
    const start = startAt != null ? new Date(startAt) : existing.startAt;
    const end = endAt != null ? new Date(endAt) : existing.endAt;
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ error: 'Некорректный интервал времени' });
    }

    const nextTitle = title !== undefined ? String(title).trim() : existing.title;
    if (!nextTitle) {
      return res.status(400).json({ error: 'Пустой заголовок' });
    }
    const nextDesc =
      description === undefined
        ? existing.description
        : description
          ? String(description).trim()
          : null;

    const attendeeData =
      attendeeIds !== undefined
        ? (() => {
            const rawIds = Array.isArray(attendeeIds) ? attendeeIds : [];
            const validAttendee = rawIds.filter((id) => memberIds.has(id));
            return {
              deleteMany: {} as const,
              create: validAttendee.map((userId) => ({ userId })),
            };
          })()
        : undefined;

    const updated = await prisma.calendarEvent.update({
      where: { id: existing.id },
      data: {
        title: nextTitle,
        description: nextDesc,
        startAt: start,
        endAt: end,
        ...(attendeeData ? { attendees: attendeeData } : {}),
      },
      include: eventInclude,
    });

    return res.json(mapEvent(updated));
  } catch (e) {
    console.error('Calendar update error:', e);
    return res.status(500).json({ error: 'Ошибка обновления события' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.calendarEvent.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Событие не найдено' });
    }
    if (!(await assertWorkspaceMember(prisma, existing.workspaceId, req.userId!, req.userRole))) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    if (existing.createdById !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Удалить может только автор' });
    }

    await prisma.calendarEvent.delete({ where: { id: existing.id } });
    return res.json({ ok: true });
  } catch (e) {
    console.error('Calendar delete error:', e);
    return res.status(500).json({ error: 'Ошибка удаления события' });
  }
});

export default router;
