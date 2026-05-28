import { mergeBoardAdvanced } from '../features/board-settings/boardAdvancedSettings.defaults';
import type { BoardApprovalRule } from '../features/board-settings/boardAdvancedSettings.types';
import type { Board } from '../types';

export type TaskColumnApprovalStatus = 'approved' | 'rejected';

export type TaskColumnApprovalRow = {
  id: string;
  ruleId: string;
  columnId: string;
  ruleName?: string;
  approvedByUserId: string;
  status?: TaskColumnApprovalStatus;
  reason?: string | null;
  createdAt: string;
  updatedAt?: string;
  approver?: { id: string; name: string; email?: string; avatar?: string | null };
};

export function normalizeApprovalStatus(status: string | undefined): TaskColumnApprovalStatus | undefined {
  if (status === 'approved' || status === 'approve') return 'approved';
  if (status === 'rejected' || status === 'reject') return 'rejected';
  return undefined;
}

export function normalizeApprovalRow(row: TaskColumnApprovalRow): TaskColumnApprovalRow {
  let status = normalizeApprovalStatus(row.status);
  if (!status && row.reason && row.reason.trim()) {
    status = 'rejected';
  }
  if (!status) {
    status = 'approved';
  }
  return { ...row, status };
}

export function isApprovalApproved(row: TaskColumnApprovalRow): boolean {
  return normalizeApprovalRow(row).status === 'approved';
}

export function isApprovalRejected(row: TaskColumnApprovalRow): boolean {
  return normalizeApprovalRow(row).status === 'rejected';
}

export function getBoardApprovalRules(board: Board | null | undefined): BoardApprovalRule[] {
  if (!board) return [];
  const rules = mergeBoardAdvanced(board.advancedSettings ?? {}).approvals?.rules ?? [];
  return rules.filter((r) => r.columnId.trim().length > 0 && r.approverUserId.trim().length > 0);
}

export function getApprovalRulesForColumn(rules: BoardApprovalRule[], columnId: string): BoardApprovalRule[] {
  return rules.filter((r) => r.columnId === columnId);
}

export function canUserApproveRule(rule: BoardApprovalRule, userId: string | undefined): boolean {
  if (!userId) return false;
  if (rule.approverUserId === userId) return true;
  return rule.substituteUserIds.includes(userId);
}

function columnDecisionByRuleId(
  approvals: TaskColumnApprovalRow[],
  columnId: string,
): Map<string, TaskColumnApprovalRow> {
  const map = new Map<string, TaskColumnApprovalRow>();
  for (const row of approvals) {
    if (row.columnId === columnId) map.set(row.ruleId, row);
  }
  return map;
}

export function getPendingApprovalRules(
  rules: BoardApprovalRule[],
  columnId: string,
  approvals: TaskColumnApprovalRow[],
): BoardApprovalRule[] {
  const decisions = columnDecisionByRuleId(approvals, columnId);
  return getApprovalRulesForColumn(rules, columnId).filter((r) => {
    const decision = decisions.get(r.id);
    return !decision || !isApprovalApproved(decision);
  });
}

export function getCompletedApprovalsForColumn(
  rules: BoardApprovalRule[],
  columnId: string,
  approvals: TaskColumnApprovalRow[],
): TaskColumnApprovalRow[] {
  const ruleIds = new Set(getApprovalRulesForColumn(rules, columnId).map((r) => r.id));
  return approvals.filter(
    (a) => a.columnId === columnId && ruleIds.has(a.ruleId) && isApprovalApproved(a),
  );
}

export function getRejectedApprovalsForColumn(
  rules: BoardApprovalRule[],
  columnId: string,
  approvals: TaskColumnApprovalRow[],
): TaskColumnApprovalRow[] {
  const ruleIds = new Set(getApprovalRulesForColumn(rules, columnId).map((r) => r.id));
  return approvals.filter(
    (a) => a.columnId === columnId && ruleIds.has(a.ruleId) && isApprovalRejected(a),
  );
}

export function getDecisionForRule(
  approvals: TaskColumnApprovalRow[],
  columnId: string,
  ruleId: string,
): TaskColumnApprovalRow | undefined {
  return approvals.find((a) => a.columnId === columnId && a.ruleId === ruleId);
}

export function hasPendingApprovalsForColumn(
  rules: BoardApprovalRule[],
  columnId: string,
  approvals: TaskColumnApprovalRow[],
): boolean {
  return getPendingApprovalRules(rules, columnId, approvals).length > 0;
}

export function formatPendingApprovalsMessage(
  rules: BoardApprovalRule[],
  columnId: string,
  approvals: TaskColumnApprovalRow[],
): string | null {
  const pending = getPendingApprovalRules(rules, columnId, approvals);
  if (pending.length === 0) return null;
  const names = pending.map((r) => r.name.trim() || 'Согласование').join(', ');
  return `Перед сменой статуса необходимо получить согласования: ${names}`;
}

export function mergeApprovalDecision(
  approvals: TaskColumnApprovalRow[],
  decision: TaskColumnApprovalRow,
): TaskColumnApprovalRow[] {
  const normalized = normalizeApprovalRow(decision);
  const idx = approvals.findIndex((a) => a.ruleId === normalized.ruleId);
  if (idx >= 0) {
    const next = [...approvals];
    next[idx] = normalized;
    return next;
  }
  return [...approvals, normalized];
}
