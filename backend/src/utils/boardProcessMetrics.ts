import type { PrismaClient } from '@prisma/client';
import { ACTIVITY_EVENT_TYPES } from './activityLog';
import type { BoardReportingCfg } from './boardReportingConfig';

export type ColumnChangeLog = {
  taskId: string;
  occurredAt: Date;
  fromColumnId: string | null;
  toColumnId: string | null;
};

export type TaskMetricRow = {
  id: string;
  createdAt: Date;
  columnId: string;
};

type TimelineSegment = { columnId: string; from: Date; to: Date };

function payloadField(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const val = (payload as Record<string, unknown>)[key];
  return typeof val === 'string' ? val : null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function msToDays(ms: number): number {
  return ms / (1000 * 60 * 60 * 24);
}

function buildTimeline(
  task: TaskMetricRow,
  changesAsc: ColumnChangeLog[],
  now: Date,
): TimelineSegment[] {
  const taskChanges = changesAsc.filter((c) => c.taskId === task.id);
  if (taskChanges.length === 0) {
    return [{ columnId: task.columnId, from: task.createdAt, to: now }];
  }

  const segments: TimelineSegment[] = [];
  const first = taskChanges[0];
  const startColumn = first.fromColumnId ?? task.columnId;
  segments.push({ columnId: startColumn, from: task.createdAt, to: first.occurredAt });

  for (let i = 0; i < taskChanges.length; i++) {
    const col = taskChanges[i].toColumnId;
    if (!col) continue;
    const from = taskChanges[i].occurredAt;
    const to = i + 1 < taskChanges.length ? taskChanges[i + 1].occurredAt : now;
    segments.push({ columnId: col, from, to });
  }
  return segments;
}

function firstDoneEntry(segments: TimelineSegment[], doneColumnId: string): Date | null {
  for (const seg of segments) {
    if (seg.columnId === doneColumnId) return seg.from;
  }
  return null;
}

function cycleTimeMs(segments: TimelineSegment[], cfg: BoardReportingCfg): number {
  let total = 0;
  for (const seg of segments) {
    if (seg.columnId === cfg.doneColumnId) break;
    if (cfg.ignoreColumnIds.has(seg.columnId)) continue;
    total += Math.max(0, seg.to.getTime() - seg.from.getTime());
  }
  return total;
}

function columnDwellMs(segments: TimelineSegment[], columnId: string): number {
  return segments
    .filter((s) => s.columnId === columnId)
    .reduce((sum, s) => sum + Math.max(0, s.to.getTime() - s.from.getTime()), 0);
}

export async function loadBoardColumnChangeLogs(
  prisma: PrismaClient,
  boardId: string,
  taskIds: string[],
): Promise<ColumnChangeLog[]> {
  if (taskIds.length === 0) return [];

  const rows = await prisma.activityLog.findMany({
    where: {
      boardId,
      taskId: { in: taskIds },
      eventType: ACTIVITY_EVENT_TYPES.COLUMN_CHANGED,
    },
    orderBy: { occurredAt: 'asc' },
    select: { taskId: true, occurredAt: true, payload: true },
  });

  return rows.map((r) => ({
    taskId: r.taskId,
    occurredAt: r.occurredAt,
    fromColumnId: payloadField(r.payload, 'fromColumnId'),
    toColumnId: payloadField(r.payload, 'toColumnId'),
  }));
}

export type ProcessMetricsResult = {
  doneColumnId: string;
  doneColumnName: string;
  periodDays: number;
  throughput: { created: number; completed: number };
  leadTime: { avgDays: number | null; medianDays: number | null; sampleSize: number };
  cycleTime: { avgDays: number | null; medianDays: number | null; sampleSize: number };
  inProgressCount: number;
  columnHeatmap: { columnId: string; columnName: string; avgDays: number; sampleSize: number }[];
};

export function computeProcessMetrics(
  tasks: TaskMetricRow[],
  columnChanges: ColumnChangeLog[],
  columns: { id: string; name: string; position: number }[],
  cfg: BoardReportingCfg,
  periodDays: number,
  now = new Date(),
): ProcessMetricsResult {
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  let createdInPeriod = 0;
  let completedInPeriod = 0;
  let inProgressCount = 0;
  const leadTimes: number[] = [];
  const cycleTimes: number[] = [];

  const heatmapAccum = new Map<string, { totalDays: number; count: number }>();
  for (const col of columns) {
    heatmapAccum.set(col.id, { totalDays: 0, count: 0 });
  }

  for (const task of tasks) {
    if (task.createdAt >= periodStart) createdInPeriod += 1;

    const segments = buildTimeline(task, columnChanges, now);
    const doneAt = firstDoneEntry(segments, cfg.doneColumnId);

    if (!doneAt) {
      inProgressCount += 1;
    } else if (doneAt >= periodStart) {
      completedInPeriod += 1;
      const leadMs = doneAt.getTime() - task.createdAt.getTime();
      if (leadMs >= 0) leadTimes.push(msToDays(leadMs));
      const cycleMs = cycleTimeMs(segments, cfg);
      if (cycleMs >= 0) cycleTimes.push(msToDays(cycleMs));
    }

    for (const col of columns) {
      const dwellMs = columnDwellMs(segments, col.id);
      if (dwellMs <= 0) continue;
      const bucket = heatmapAccum.get(col.id)!;
      bucket.totalDays += msToDays(dwellMs);
      bucket.count += 1;
    }
  }

  const columnHeatmap = columns
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((col) => {
      const bucket = heatmapAccum.get(col.id) ?? { totalDays: 0, count: 0 };
      return {
        columnId: col.id,
        columnName: col.name,
        avgDays: bucket.count > 0 ? round1(bucket.totalDays / bucket.count) : 0,
        sampleSize: bucket.count,
      };
    });

  const leadMedian = median(leadTimes);
  const leadAvg = leadTimes.length
    ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
    : null;
  const cycleMedian = median(cycleTimes);
  const cycleAvg = cycleTimes.length
    ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
    : null;

  return {
    doneColumnId: cfg.doneColumnId,
    doneColumnName: cfg.doneColumnName,
    periodDays,
    throughput: { created: createdInPeriod, completed: completedInPeriod },
    leadTime: {
      avgDays: leadAvg != null ? round1(leadAvg) : null,
      medianDays: leadMedian != null ? round1(leadMedian) : null,
      sampleSize: leadTimes.length,
    },
    cycleTime: {
      avgDays: cycleAvg != null ? round1(cycleAvg) : null,
      medianDays: cycleMedian != null ? round1(cycleMedian) : null,
      sampleSize: cycleTimes.length,
    },
    inProgressCount,
    columnHeatmap,
  };
}

export type ApprovalAnalyticsResult = {
  approved: number;
  rejected: number;
  rejectRate: number | null;
  medianWaitHours: number | null;
  topRejectReasons: { reason: string; count: number }[];
};

export async function computeApprovalAnalytics(
  prisma: PrismaClient,
  boardId: string,
  tasks: TaskMetricRow[],
  columnChanges: ColumnChangeLog[],
  periodDays: number,
  now = new Date(),
): Promise<ApprovalAnalyticsResult> {
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const logs = await prisma.activityLog.findMany({
    where: {
      boardId,
      eventType: ACTIVITY_EVENT_TYPES.APPROVAL_DECIDED,
      occurredAt: { gte: periodStart },
    },
    orderBy: { occurredAt: 'asc' },
    select: { taskId: true, occurredAt: true, payload: true },
  });

  let approved = 0;
  let rejected = 0;
  const waitHours: number[] = [];
  const reasonCounts = new Map<string, number>();

  const changesByTask = new Map<string, ColumnChangeLog[]>();
  for (const c of columnChanges) {
    const list = changesByTask.get(c.taskId) ?? [];
    list.push(c);
    changesByTask.set(c.taskId, list);
  }

  function columnEnteredAt(taskId: string, columnId: string, before: Date): Date | null {
    const list = (changesByTask.get(taskId) ?? []).filter((c) => c.occurredAt <= before);
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].toColumnId === columnId) return list[i].occurredAt;
    }
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.columnId === columnId && task.createdAt <= before) {
      return task.createdAt;
    }
    return null;
  }

  for (const log of logs) {
    const decision = payloadField(log.payload, 'decision');
    const columnId = payloadField(log.payload, 'columnId');
    if (decision === 'rejected') {
      rejected += 1;
      const reason = payloadField(log.payload, 'reason')?.trim() || 'Без указания причины';
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    } else {
      approved += 1;
    }

    if (columnId) {
      const entered = columnEnteredAt(log.taskId, columnId, log.occurredAt);
      if (entered) {
        const hours = (log.occurredAt.getTime() - entered.getTime()) / (1000 * 60 * 60);
        if (hours >= 0) waitHours.push(hours);
      }
    }
  }

  const totalDecisions = approved + rejected;
  const medianWait = median(waitHours);

  const topRejectReasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));

  return {
    approved,
    rejected,
    rejectRate: totalDecisions > 0 ? round1((rejected / totalDecisions) * 100) : null,
    medianWaitHours: medianWait != null ? round1(medianWait) : null,
    topRejectReasons,
  };
}
