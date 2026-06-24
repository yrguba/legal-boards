import type { PrismaClient } from '@prisma/client';

export const PRESENCE_STATUS = {
  available: 'available',
  busy: 'busy',
  dnd: 'dnd',
  meeting: 'meeting',
  vacation: 'vacation',
  custom: 'custom',
} as const;

export type PresenceStatus = (typeof PRESENCE_STATUS)[keyof typeof PRESENCE_STATUS];

export const SETTABLE_PRESENCE_STATUSES = new Set<string>([
  PRESENCE_STATUS.available,
  PRESENCE_STATUS.busy,
  PRESENCE_STATUS.dnd,
  PRESENCE_STATUS.meeting,
  PRESENCE_STATUS.custom,
]);

export const ABSENCE_KIND = {
  vacation: 'vacation',
  sick: 'sick',
  business_trip: 'business_trip',
  other: 'other',
} as const;

export type AbsenceKind = (typeof ABSENCE_KIND)[keyof typeof ABSENCE_KIND];

export const ABSENCE_KINDS = Object.values(ABSENCE_KIND);

export type EffectivePresence = {
  status: PresenceStatus;
  customText: string | null;
  onAbsence: boolean;
  absenceKind: string | null;
  absenceId: string | null;
  expiresAt: string | null;
};

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseDateOnly(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseAbsenceDate(raw: unknown): Date | null {
  if (typeof raw !== 'string') return null;
  return parseDateOnly(raw.trim());
}

export function isDateInRange(day: Date, start: Date, end: Date): boolean {
  const t = startOfDay(day).getTime();
  return t >= startOfDay(start).getTime() && t <= startOfDay(end).getTime();
}

function mapAbsenceRow(row: {
  id: string;
  kind: string;
  startDate: Date;
  endDate: Date;
  note: string | null;
  substituteUserId: string | null;
  substitute: { id: string; name: string } | null;
}) {
  return {
    id: row.id,
    kind: row.kind,
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate.toISOString().slice(0, 10),
    note: row.note,
    substituteUserId: row.substituteUserId,
    substitute: row.substitute ? { id: row.substitute.id, name: row.substitute.name } : null,
  };
}

export function resolveEffectivePresence(
  stored: { status: string; customText: string | null; expiresAt: Date | null } | null,
  activeAbsence: { id: string; kind: string } | null,
  now = new Date(),
): EffectivePresence {
  if (activeAbsence) {
    return {
      status: PRESENCE_STATUS.vacation,
      customText: null,
      onAbsence: true,
      absenceKind: activeAbsence.kind,
      absenceId: activeAbsence.id,
      expiresAt: null,
    };
  }

  const base = stored ?? {
    status: PRESENCE_STATUS.available,
    customText: null,
    expiresAt: null,
  };

  if (base.expiresAt && base.expiresAt.getTime() <= now.getTime()) {
    return {
      status: PRESENCE_STATUS.available,
      customText: null,
      onAbsence: false,
      absenceKind: null,
      absenceId: null,
      expiresAt: null,
    };
  }

  const status = SETTABLE_PRESENCE_STATUSES.has(base.status)
    ? (base.status as PresenceStatus)
    : PRESENCE_STATUS.available;

  return {
    status,
    customText: status === PRESENCE_STATUS.custom ? base.customText : null,
    onAbsence: false,
    absenceKind: null,
    absenceId: null,
    expiresAt: base.expiresAt?.toISOString() ?? null,
  };
}

export async function findActiveAbsence(
  prisma: PrismaClient,
  userId: string,
  workspaceId: string,
  now = new Date(),
) {
  const day = startOfDay(now);
  return prisma.userAbsence.findFirst({
    where: {
      userId,
      workspaceId,
      startDate: { lte: day },
      endDate: { gte: day },
    },
    orderBy: { startDate: 'desc' },
    select: { id: true, kind: true },
  });
}

export async function getEffectivePresenceForUser(
  prisma: PrismaClient,
  userId: string,
  workspaceId: string,
  now = new Date(),
): Promise<EffectivePresence> {
  const [stored, activeAbsence] = await Promise.all([
    prisma.userPresence.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { status: true, customText: true, expiresAt: true },
    }),
    findActiveAbsence(prisma, userId, workspaceId, now),
  ]);
  return resolveEffectivePresence(stored, activeAbsence, now);
}

export async function loadEffectivePresencesForUsers(
  prisma: PrismaClient,
  workspaceId: string,
  userIds: string[],
  now = new Date(),
): Promise<Map<string, EffectivePresence>> {
  const result = new Map<string, EffectivePresence>();
  if (userIds.length === 0) return result;

  const day = startOfDay(now);
  const [presences, absences] = await Promise.all([
    prisma.userPresence.findMany({
      where: { workspaceId, userId: { in: userIds } },
      select: { userId: true, status: true, customText: true, expiresAt: true },
    }),
    prisma.userAbsence.findMany({
      where: {
        workspaceId,
        userId: { in: userIds },
        startDate: { lte: day },
        endDate: { gte: day },
      },
      select: { id: true, userId: true, kind: true, startDate: true },
      orderBy: { startDate: 'desc' },
    }),
  ]);

  const presenceByUser = new Map(presences.map((p) => [p.userId, p]));
  const absenceByUser = new Map<string, { id: string; kind: string }>();
  for (const a of absences) {
    if (!absenceByUser.has(a.userId)) {
      absenceByUser.set(a.userId, { id: a.id, kind: a.kind });
    }
  }

  for (const userId of userIds) {
    result.set(
      userId,
      resolveEffectivePresence(presenceByUser.get(userId) ?? null, absenceByUser.get(userId) ?? null, now),
    );
  }
  return result;
}

export async function listUserAbsences(
  prisma: PrismaClient,
  userId: string,
  workspaceId: string,
) {
  const rows = await prisma.userAbsence.findMany({
    where: { userId, workspaceId },
    orderBy: [{ startDate: 'desc' }],
    include: {
      substitute: { select: { id: true, name: true } },
    },
  });
  const today = startOfDay(new Date());
  return rows.map((row) => ({
    ...mapAbsenceRow(row),
    isActive: isDateInRange(today, row.startDate, row.endDate),
    isUpcoming: startOfDay(row.startDate).getTime() > today.getTime(),
  }));
}

export async function assertWorkspaceMemberUser(
  prisma: PrismaClient,
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });
  if (!ws) return false;
  if (ws.ownerId === userId) return true;
  const m = await prisma.workspaceUser.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { id: true },
  });
  return !!m;
}

export function validateAbsenceInput(body: {
  kind?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  note?: unknown;
  substituteUserId?: unknown;
}):
  | {
      ok: true;
      data: {
        kind: string;
        startDate: Date;
        endDate: Date;
        note: string | null;
        substituteUserId: string | null;
      };
    }
  | { ok: false; error: string } {
  const kindRaw = typeof body.kind === 'string' ? body.kind.trim() : ABSENCE_KIND.vacation;
  if (!ABSENCE_KINDS.includes(kindRaw as AbsenceKind)) {
    return { ok: false, error: 'Некорректный тип отсутствия' };
  }

  const startDate = parseAbsenceDate(body.startDate);
  const endDate = parseAbsenceDate(body.endDate);
  if (!startDate || !endDate) {
    return { ok: false, error: 'Укажите даты начала и окончания (ГГГГ-ММ-ДД)' };
  }
  if (startDate.getTime() > endDate.getTime()) {
    return { ok: false, error: 'Дата окончания не может быть раньше начала' };
  }

  let note: string | null = null;
  if (typeof body.note === 'string' && body.note.trim()) {
    note = body.note.trim().slice(0, 500);
  }

  let substituteUserId: string | null = null;
  if (typeof body.substituteUserId === 'string' && body.substituteUserId.trim()) {
    substituteUserId = body.substituteUserId.trim();
  }

  return { ok: true, data: { kind: kindRaw, startDate, endDate, note, substituteUserId } };
}
