import type { PrismaClient } from '@prisma/client';

export type ParsedAutoAssignRule = {
  taskTypeId: string;
  targetKind: 'department' | 'group' | 'user';
  targetId: string;
  assignmentMode: 'on_load' | 'by_priority';
  priorityUserIds: string[];
};

async function workspaceMemberIds(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<Set<string>> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true, users: { select: { userId: true } } },
  });
  if (!ws) return new Set();
  const s = new Set<string>([ws.ownerId]);
  for (const row of ws.users) s.add(row.userId);
  return s;
}

/** Правила автоназначения из Board.advancedSettings (как во фронте mergeBoardAdvanced) */
export function parseBoardAutoAssignmentRules(advancedSettings: unknown): ParsedAutoAssignRule[] {
  if (!advancedSettings || typeof advancedSettings !== 'object') return [];
  const root = advancedSettings as Record<string, unknown>;
  const aa = root.autoAssignment;
  if (!aa || typeof aa !== 'object') return [];
  const obj = aa as Record<string, unknown>;
  const rawList = Array.isArray(obj.rules) ? obj.rules : [];

  const legacyLp =
    Array.isArray(obj.lawyerPriorityUserIds) &&
    obj.lawyerPriorityUserIds.every((x) => typeof x === 'string')
      ? (obj.lawyerPriorityUserIds as string[])
      : [];
  const legacyAssignOnLoad = obj.assignOnLoad === true;

  const out: ParsedAutoAssignRule[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const rule = item as Record<string, unknown>;
    const taskTypeId = typeof rule.taskTypeId === 'string' ? rule.taskTypeId.trim() : '';
    const targetId = typeof rule.targetId === 'string' ? rule.targetId.trim() : '';
    if (!taskTypeId || !targetId) continue;

    const targetKind =
      rule.targetKind === 'department' || rule.targetKind === 'group' || rule.targetKind === 'user'
        ? rule.targetKind
        : 'department';

    let assignmentMode: 'on_load' | 'by_priority' = 'on_load';
    if (rule.assignmentMode === 'by_priority' || rule.assignmentMode === 'on_load') {
      assignmentMode = rule.assignmentMode;
    } else if (legacyAssignOnLoad) {
      assignmentMode = 'on_load';
    } else if (legacyLp.length > 0) {
      assignmentMode = 'by_priority';
    }

    let priorityUserIds =
      Array.isArray(rule.priorityUserIds) && rule.priorityUserIds.every((x) => typeof x === 'string')
        ? [...rule.priorityUserIds]
        : [];
    if (assignmentMode === 'by_priority' && priorityUserIds.length === 0 && legacyLp.length > 0) {
      priorityUserIds = [...legacyLp];
    }

    out.push({ taskTypeId, targetKind, targetId, assignmentMode, priorityUserIds });
  }
  return out;
}

async function taskCountByAssignee(
  prisma: PrismaClient,
  boardId: string,
  candidateIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const id of candidateIds) map.set(id, 0);
  if (candidateIds.length === 0) return map;

  const rows = await prisma.task.groupBy({
    by: ['assigneeId'],
    where: { boardId, assigneeId: { not: null, in: candidateIds } },
    _count: { _all: true },
  });
  for (const r of rows) {
    if (r.assigneeId) map.set(r.assigneeId, r._count._all);
  }
  return map;
}

/** Минимум открытых задач на доске; при равном числе — более ранний в orderedPreferred */
function pickLeastLoadedUserId(
  orderedPreferred: string[],
  counts: Map<string, number>,
): string | null {
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const id of orderedPreferred) {
    if (id && !seen.has(id)) {
      seen.add(id);
      uniq.push(id);
    }
  }
  let bestId: string | null = null;
  let bestCount = Infinity;
  let bestIdx = Infinity;
  for (let i = 0; i < uniq.length; i++) {
    const id = uniq[i];
    const c = counts.get(id) ?? 0;
    if (c < bestCount || (c === bestCount && i < bestIdx)) {
      bestCount = c;
      bestIdx = i;
      bestId = id;
    }
  }
  return bestId;
}

async function usersForOnLoadTarget(
  prisma: PrismaClient,
  members: Set<string>,
  targetKind: ParsedAutoAssignRule['targetKind'],
  targetId: string,
): Promise<string[]> {
  const memberArr = [...members];
  if (memberArr.length === 0) return [];

  if (targetKind === 'user') {
    return members.has(targetId) ? [targetId] : [];
  }

  if (targetKind === 'department') {
    const rows = await prisma.user.findMany({
      where: {
        id: { in: memberArr },
        departmentId: targetId,
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  const inGroup = await prisma.userGroup.findMany({
    where: { groupId: targetId, userId: { in: memberArr } },
    select: { userId: true },
  });
  return [...new Set(inGroup.map((x) => x.userId).filter((id) => members.has(id)))];
}

async function filterByTarget(
  prisma: PrismaClient,
  userIds: string[],
  targetKind: ParsedAutoAssignRule['targetKind'],
  targetId: string,
): Promise<string[]> {
  if (userIds.length === 0) return [];
  if (targetKind === 'user') {
    return userIds.includes(targetId) ? [targetId] : [];
  }
  if (targetKind === 'department') {
    const rows = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        departmentId: targetId,
      },
      select: { id: true },
    });
    const set = new Set(rows.map((r) => r.id));
    return userIds.filter((id) => set.has(id));
  }
  const inGroup = await prisma.userGroup.findMany({
    where: { groupId: targetId, userId: { in: userIds } },
    select: { userId: true },
  });
  const set = new Set(inGroup.map((g) => g.userId));
  return userIds.filter((id) => set.has(id));
}

/**
 * По правилам расширенных настроек доски возвращает id исполнителя или null.
 * Учитывается первое правило, у которого taskTypeId совпадает с создаваемой задачей.
 */
export async function resolveAssigneeFromBoardRules(
  prisma: PrismaClient,
  opts: {
    boardId: string;
    workspaceId: string;
    typeId: string;
    advancedSettings: unknown;
  },
): Promise<string | null> {
  const rules = parseBoardAutoAssignmentRules(opts.advancedSettings);
  const rule = rules.find((r) => r.taskTypeId === opts.typeId);
  if (!rule) return null;

  const members = await workspaceMemberIds(prisma, opts.workspaceId);

  if (rule.assignmentMode === 'by_priority') {
    let ordered = rule.priorityUserIds.filter((id) => members.has(id));
    ordered = await filterByTarget(prisma, ordered, rule.targetKind, rule.targetId);
    if (ordered.length === 0 && rule.targetKind === 'user' && members.has(rule.targetId)) {
      ordered = [rule.targetId];
    }
    if (ordered.length === 0) return null;
    const counts = await taskCountByAssignee(prisma, opts.boardId, ordered);
    return pickLeastLoadedUserId(ordered, counts);
  }

  const pool = await usersForOnLoadTarget(prisma, members, rule.targetKind, rule.targetId);
  if (pool.length === 0) return null;

  pool.sort((a, b) => a.localeCompare(b));
  const counts = await taskCountByAssignee(prisma, opts.boardId, pool);
  return pickLeastLoadedUserId(pool, counts);
}
