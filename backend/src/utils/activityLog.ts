import type { Prisma, PrismaClient } from '@prisma/client';

export const ACTIVITY_EVENT_TYPES = {
  COLUMN_CHANGED: 'task.column_changed',
  ASSIGNEE_CHANGED: 'task.assignee_changed',
  APPROVAL_DECIDED: 'task.approval_decided',
  COLUMN_ACTION_COMPLETED: 'task.column_action_completed',
  LEGACY_STATUS: 'legacy.status_event',
} as const;

type DbClient = PrismaClient | Prisma.TransactionClient;

export type WriteActivityLogArgs = {
  workspaceId: string;
  boardId: string;
  taskId: string;
  eventType: string;
  actorUserId?: string | null;
  actorLexClientId?: string | null;
  payload?: Record<string, unknown>;
  snapshot?: Record<string, unknown>;
  source?: string;
};

export async function writeActivityLog(db: DbClient, args: WriteActivityLogArgs) {
  return db.activityLog.create({
    data: {
      workspaceId: args.workspaceId,
      boardId: args.boardId,
      taskId: args.taskId,
      eventType: args.eventType,
      actorUserId: args.actorUserId ?? null,
      actorLexClientId: args.actorLexClientId ?? null,
      payload: (args.payload ?? {}) as Prisma.InputJsonValue,
      snapshot: args.snapshot ? (args.snapshot as Prisma.InputJsonValue) : undefined,
      source: args.source ?? 'api',
    },
    include: {
      actorUser: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });
}

export type ActivityFeedItem = {
  id: string;
  eventType: string;
  occurredAt: string;
  source: string;
  payload: Record<string, unknown>;
  snapshot: Record<string, unknown> | null;
  actor: { id: string; name: string; email?: string; avatar?: string | null } | null;
  summary: string;
};

function payloadRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function formatActivitySummary(eventType: string, payload: Record<string, unknown>): string {
  switch (eventType) {
    case ACTIVITY_EVENT_TYPES.COLUMN_CHANGED: {
      const from = String(payload.fromColumnName ?? payload.fromColumnId ?? '—');
      const to = String(payload.toColumnName ?? payload.toColumnId ?? '—');
      return `Статус: «${from}» → «${to}»`;
    }
    case ACTIVITY_EVENT_TYPES.ASSIGNEE_CHANGED: {
      const toName = payload.toUserName ?? payload.toUserId;
      if (!toName) return 'Исполнитель снят';
      const fromName = payload.fromUserName ?? payload.fromUserId;
      if (!fromName) return `Назначен исполнитель: ${toName}`;
      return `Исполнитель: «${fromName}» → «${toName}»`;
    }
    case ACTIVITY_EVENT_TYPES.APPROVAL_DECIDED: {
      const rule = payload.ruleName ?? payload.ruleId ?? 'Согласование';
      const decision = payload.decision === 'rejected' ? 'отклонено' : 'согласовано';
      if (payload.decision === 'rejected' && payload.reason) {
        return `${rule}: ${decision} — ${payload.reason}`;
      }
      return `${rule}: ${decision}`;
    }
    case ACTIVITY_EVENT_TYPES.COLUMN_ACTION_COMPLETED: {
      const rule = payload.ruleName ?? payload.ruleId ?? 'Действие';
      const kind = payload.actionKind ?? '';
      if (kind === 'confirm') return `${rule}: подтверждено`;
      if (kind === 'form') return `${rule}: форма заполнена`;
      return `${rule}: выполнено`;
    }
    case ACTIVITY_EVENT_TYPES.LEGACY_STATUS:
      return String(payload.message ?? 'Изменение статуса');
    default:
      return eventType;
  }
}

function mapLogRow(row: {
  id: string;
  eventType: string;
  occurredAt: Date;
  source: string;
  payload: unknown;
  snapshot: unknown;
  actorUser: { id: string; name: string; email: string; avatar: string | null } | null;
}): ActivityFeedItem {
  const payload = payloadRecord(row.payload);
  return {
    id: row.id,
    eventType: row.eventType,
    occurredAt: row.occurredAt.toISOString(),
    source: row.source,
    payload,
    snapshot:
      row.snapshot && typeof row.snapshot === 'object' && !Array.isArray(row.snapshot)
        ? (row.snapshot as Record<string, unknown>)
        : null,
    actor: row.actorUser
      ? {
          id: row.actorUser.id,
          name: row.actorUser.name,
          email: row.actorUser.email,
          avatar: row.actorUser.avatar,
        }
      : null,
    summary: formatActivitySummary(row.eventType, payload),
  };
}

export async function getTaskActivityFeed(
  db: PrismaClient,
  taskId: string,
): Promise<ActivityFeedItem[]> {
  const [logs, legacyEvents] = await Promise.all([
    db.activityLog.findMany({
      where: { taskId },
      orderBy: { occurredAt: 'desc' },
      include: {
        actorUser: { select: { id: true, name: true, email: true, avatar: true } },
      },
    }),
    db.taskStatusEvent.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, kind: true, message: true, createdAt: true },
    }),
  ]);

  const items: ActivityFeedItem[] = logs.map(mapLogRow);

  const loggedColumnMessages = new Set(
    items
      .filter((i) => i.eventType === ACTIVITY_EVENT_TYPES.COLUMN_CHANGED)
      .map((i) => {
        const from = String(i.payload.fromColumnName ?? '');
        const to = String(i.payload.toColumnName ?? '');
        return `${from}→${to}`;
      }),
  );

  for (const ev of legacyEvents) {
    const msg = ev.message;
    if (ev.kind === 'column') {
      const arrowMatch = msg.match(/: "([^"]*)" → "([^"]*)"/);
      if (arrowMatch) {
        const key = `${arrowMatch[1]}→${arrowMatch[2]}`;
        if (loggedColumnMessages.has(key)) continue;
      }
    }
    items.push({
      id: `legacy-${ev.id}`,
      eventType: ACTIVITY_EVENT_TYPES.LEGACY_STATUS,
      occurredAt: ev.createdAt.toISOString(),
      source: 'legacy',
      payload: { kind: ev.kind, message: ev.message },
      snapshot: null,
      actor: null,
      summary: formatActivitySummary(ACTIVITY_EVENT_TYPES.LEGACY_STATUS, {
        message: ev.message,
      }),
    });
  }

  items.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  return items;
}

export async function resolveUserNames(
  db: PrismaClient,
  userIds: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();
  const rows = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r) => [r.id, r.name]));
}
