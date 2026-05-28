import type { PrismaClient } from '@prisma/client';
import { ACTIVITY_EVENT_TYPES } from './activityLog';
import {
  getApprovalRulesForColumn,
  type ParsedApprovalRule,
} from './boardApprovals';

const APPROVED_STATUSES = new Set(['approved', 'approve']);

export type BoardReportTaskRow = {
  id: string;
  title: string;
  columnId: string;
  assigneeId: string | null;
  createdAt: Date;
  assignee: { id: string; name: string } | null;
  column: { id: string; name: string; position: number };
};

function payloadToColumnId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const to = (payload as Record<string, unknown>).toColumnId;
  return typeof to === 'string' ? to : null;
}

export async function resolveTasksColumnEnteredAt(
  prisma: PrismaClient,
  tasks: BoardReportTaskRow[],
): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  if (tasks.length === 0) return out;

  const taskIds = tasks.map((t) => t.id);
  const logs = await prisma.activityLog.findMany({
    where: {
      taskId: { in: taskIds },
      eventType: ACTIVITY_EVENT_TYPES.COLUMN_CHANGED,
    },
    orderBy: { occurredAt: 'desc' },
    select: { taskId: true, occurredAt: true, payload: true },
  });

  for (const task of tasks) {
    const hit = logs.find(
      (l) => l.taskId === task.id && payloadToColumnId(l.payload) === task.columnId,
    );
    out.set(task.id, hit?.occurredAt ?? task.createdAt);
  }
  return out;
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export type FunnelColumnStat = {
  columnId: string;
  columnName: string;
  position: number;
  taskCount: number;
  avgDaysInColumn: number;
};

export async function buildBoardFunnel(
  prisma: PrismaClient,
  columns: { id: string; name: string; position: number }[],
  tasks: BoardReportTaskRow[],
  now = new Date(),
): Promise<FunnelColumnStat[]> {
  const enteredAt = await resolveTasksColumnEnteredAt(prisma, tasks);
  const byColumn = new Map<string, { count: number; totalDays: number }>();

  for (const col of columns) {
    byColumn.set(col.id, { count: 0, totalDays: 0 });
  }

  for (const task of tasks) {
    const bucket = byColumn.get(task.columnId);
    if (!bucket) continue;
    const since = enteredAt.get(task.id) ?? task.createdAt;
    bucket.count += 1;
    bucket.totalDays += daysBetween(since, now);
  }

  return columns
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((col) => {
      const bucket = byColumn.get(col.id) ?? { count: 0, totalDays: 0 };
      return {
        columnId: col.id,
        columnName: col.name,
        position: col.position,
        taskCount: bucket.count,
        avgDaysInColumn:
          bucket.count > 0 ? Math.round((bucket.totalDays / bucket.count) * 10) / 10 : 0,
      };
    });
}

export type AgingTaskRow = {
  taskId: string;
  title: string;
  columnId: string;
  columnName: string;
  daysInColumn: number;
  enteredAt: string;
  assigneeId: string | null;
  assigneeName: string | null;
};

export async function buildBoardAging(
  prisma: PrismaClient,
  tasks: BoardReportTaskRow[],
  thresholdDays: number,
  now = new Date(),
): Promise<AgingTaskRow[]> {
  const enteredAt = await resolveTasksColumnEnteredAt(prisma, tasks);
  const rows: AgingTaskRow[] = [];

  for (const task of tasks) {
    const since = enteredAt.get(task.id) ?? task.createdAt;
    const days = daysBetween(since, now);
    if (days < thresholdDays) continue;
    rows.push({
      taskId: task.id,
      title: task.title,
      columnId: task.columnId,
      columnName: task.column.name,
      daysInColumn: Math.floor(days),
      enteredAt: since.toISOString(),
      assigneeId: task.assigneeId,
      assigneeName: task.assignee?.name ?? null,
    });
  }

  rows.sort((a, b) => b.daysInColumn - a.daysInColumn);
  return rows;
}

export type PendingApprovalRow = {
  taskId: string;
  title: string;
  columnId: string;
  columnName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  pendingRules: { id: string; name: string }[];
};

function pendingRulesForTask(
  rules: ParsedApprovalRule[],
  columnId: string,
  approvals: { ruleId: string; columnId: string; status: string }[],
): ParsedApprovalRule[] {
  const columnRules = getApprovalRulesForColumn(rules, columnId);
  if (columnRules.length === 0) return [];

  const approved = new Set(
    approvals
      .filter((a) => a.columnId === columnId && APPROVED_STATUSES.has(a.status))
      .map((a) => a.ruleId),
  );
  return columnRules.filter((r) => !approved.has(r.id));
}

export function buildPendingApprovals(
  rules: ParsedApprovalRule[],
  tasks: Array<
    BoardReportTaskRow & {
      columnApprovals: { ruleId: string; columnId: string; status: string }[];
    }
  >,
): PendingApprovalRow[] {
  if (rules.length === 0) return [];

  const rows: PendingApprovalRow[] = [];
  for (const task of tasks) {
    const pending = pendingRulesForTask(rules, task.columnId, task.columnApprovals);
    if (pending.length === 0) continue;
    rows.push({
      taskId: task.id,
      title: task.title,
      columnId: task.columnId,
      columnName: task.column.name,
      assigneeId: task.assigneeId,
      assigneeName: task.assignee?.name ?? null,
      pendingRules: pending.map((r) => ({
        id: r.id,
        name: r.name || 'Согласование',
      })),
    });
  }

  rows.sort((a, b) => a.columnName.localeCompare(b.columnName, 'ru'));
  return rows;
}

export async function loadBoardReportTasks(
  prisma: PrismaClient,
  boardId: string,
  assigneeId?: string | null,
) {
  return prisma.task.findMany({
    where: {
      boardId,
      ...(assigneeId ? { assigneeId } : {}),
    },
    select: {
      id: true,
      title: true,
      columnId: true,
      assigneeId: true,
      createdAt: true,
      assignee: { select: { id: true, name: true } },
      column: { select: { id: true, name: true, position: true } },
      columnApprovals: {
        select: { ruleId: true, columnId: true, status: true },
      },
    },
  });
}
