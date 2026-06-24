import type { Prisma, PrismaClient } from '@prisma/client';

type DbClient = PrismaClient | Prisma.TransactionClient;

export const TASK_BOARD_TRANSITION_KIND = {
  PLACEMENT_CREATED: 'placement_created',
  COLUMN_CHANGED: 'column_changed',
  PLACEMENT_REMOVED: 'placement_removed',
  AUTO_FORWARD: 'auto_forward',
} as const;

export type WriteTaskBoardTransitionArgs = {
  taskId: string;
  workspaceId: string;
  eventKind: string;
  boardId: string;
  columnId?: string | null;
  fromColumnId?: string | null;
  toColumnId?: string | null;
  targetBoardId?: string | null;
  targetColumnId?: string | null;
  ruleId?: string | null;
  ruleName?: string | null;
  actorUserId?: string | null;
  source?: string;
  payload?: Record<string, unknown>;
};

export async function writeTaskBoardTransition(db: DbClient, args: WriteTaskBoardTransitionArgs) {
  return db.taskBoardTransition.create({
    data: {
      taskId: args.taskId,
      workspaceId: args.workspaceId,
      eventKind: args.eventKind,
      boardId: args.boardId,
      columnId: args.columnId ?? null,
      fromColumnId: args.fromColumnId ?? null,
      toColumnId: args.toColumnId ?? null,
      targetBoardId: args.targetBoardId ?? null,
      targetColumnId: args.targetColumnId ?? null,
      ruleId: args.ruleId ?? null,
      ruleName: args.ruleName ?? null,
      actorUserId: args.actorUserId ?? null,
      source: args.source ?? 'api',
      payload: (args.payload ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export function mapTaskBoardTransition(row: {
  id: string;
  taskId: string;
  workspaceId: string;
  eventKind: string;
  boardId: string;
  columnId: string | null;
  fromColumnId: string | null;
  toColumnId: string | null;
  targetBoardId: string | null;
  targetColumnId: string | null;
  ruleId: string | null;
  ruleName: string | null;
  actorUserId: string | null;
  source: string;
  payload: unknown;
  occurredAt: Date;
  actor?: { id: string; name: string; email: string } | null;
}) {
  return {
    id: row.id,
    taskId: row.taskId,
    workspaceId: row.workspaceId,
    eventKind: row.eventKind,
    boardId: row.boardId,
    columnId: row.columnId,
    fromColumnId: row.fromColumnId,
    toColumnId: row.toColumnId,
    targetBoardId: row.targetBoardId,
    targetColumnId: row.targetColumnId,
    ruleId: row.ruleId,
    ruleName: row.ruleName,
    actorUserId: row.actorUserId,
    source: row.source,
    payload: row.payload,
    occurredAt: row.occurredAt.toISOString(),
    actor: row.actor
      ? { id: row.actor.id, name: row.actor.name, email: row.actor.email }
      : null,
  };
}

export function transitionSummary(
  eventKind: string,
  payload: Record<string, unknown>,
): string {
  switch (eventKind) {
    case TASK_BOARD_TRANSITION_KIND.PLACEMENT_CREATED:
      return `Добавлена на доску «${payload.boardName ?? payload.boardId ?? '—'}»`;
    case TASK_BOARD_TRANSITION_KIND.PLACEMENT_REMOVED:
      return `Снята с доски «${payload.boardName ?? payload.boardId ?? '—'}»`;
    case TASK_BOARD_TRANSITION_KIND.COLUMN_CHANGED: {
      const from = String(payload.fromColumnName ?? payload.fromColumnId ?? '—');
      const to = String(payload.toColumnName ?? payload.toColumnId ?? '—');
      const board = payload.boardName ? ` (${payload.boardName})` : '';
      return `Статус${board}: «${from}» → «${to}»`;
    }
    case TASK_BOARD_TRANSITION_KIND.AUTO_FORWARD: {
      const target = payload.targetBoardName ?? payload.targetBoardId ?? '—';
      const source = payload.sourceBoardName ? ` с «${payload.sourceBoardName}»` : '';
      const rule = payload.ruleName ? ` (${payload.ruleName})` : '';
      return `Автопередача на «${target}»${source}${rule}`;
    }
    default:
      return eventKind;
  }
}
