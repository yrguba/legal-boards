import type { UserDocAccess } from './documentAccess';

type BoardVisibility = {
  departmentIds?: string[];
  groupIds?: string[];
};

function parseBoardVisibility(raw: unknown): BoardVisibility {
  if (!raw || typeof raw !== 'object') return {};
  return raw as BoardVisibility;
}

/** Доступ к сводной доске по её visibility (отдельно от source-досок). */
export function canSeeAggregatedBoard(
  visibilityRaw: unknown,
  access: UserDocAccess,
  opts?: { isAdmin?: boolean; isWorkspaceOwner?: boolean },
): boolean {
  if (opts?.isAdmin || opts?.isWorkspaceOwner) {
    return true;
  }

  const vis = parseBoardVisibility(visibilityRaw);
  const deptIds = Array.isArray(vis.departmentIds) ? vis.departmentIds : [];
  const groupIds = Array.isArray(vis.groupIds) ? vis.groupIds : [];

  if (deptIds.length === 0 && groupIds.length === 0) {
    return true;
  }

  if (deptIds.length > 0) {
    if (!access.departmentId) return false;
    if (deptIds.includes(access.departmentId)) return true;
  }

  if (groupIds.length > 0) {
    const allowed = new Set(groupIds);
    if (access.groupIds.some((g) => allowed.has(g))) return true;
  }

  return deptIds.length === 0 && groupIds.length === 0;
}
