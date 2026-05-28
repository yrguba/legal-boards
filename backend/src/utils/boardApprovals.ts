import type { PrismaClient } from '@prisma/client';

export type ParsedApprovalRule = {
  id: string;
  name: string;
  columnId: string;
  approverUserId: string;
  substituteUserIds: string[];
};

/** Правила согласования из Board.advancedSettings (как во фронте mergeBoardAdvanced) */
export function parseBoardApprovalRules(advancedSettings: unknown): ParsedApprovalRule[] {
  if (!advancedSettings || typeof advancedSettings !== 'object') return [];
  const root = advancedSettings as Record<string, unknown>;
  const ap = root.approvals;
  if (!ap || typeof ap !== 'object') return [];
  const obj = ap as Record<string, unknown>;
  const rawList = Array.isArray(obj.rules) ? obj.rules : [];

  const out: ParsedApprovalRule[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const rule = item as Record<string, unknown>;
    const id = typeof rule.id === 'string' ? rule.id.trim() : '';
    const columnId = typeof rule.columnId === 'string' ? rule.columnId.trim() : '';
    const approverUserId = typeof rule.approverUserId === 'string' ? rule.approverUserId.trim() : '';
    if (!id || !columnId || !approverUserId) continue;

    const name = typeof rule.name === 'string' ? rule.name.trim() : '';
    const substituteUserIds =
      Array.isArray(rule.substituteUserIds) &&
      rule.substituteUserIds.every((x) => typeof x === 'string')
        ? rule.substituteUserIds.filter((x) => x.trim().length > 0)
        : [];

    out.push({ id, name, columnId, approverUserId, substituteUserIds });
  }
  return out;
}

export function getApprovalRulesForColumn(
  rules: ParsedApprovalRule[],
  columnId: string,
): ParsedApprovalRule[] {
  return rules.filter((r) => r.columnId === columnId);
}

export function canUserApproveRule(rule: ParsedApprovalRule, userId: string): boolean {
  if (rule.approverUserId === userId) return true;
  return rule.substituteUserIds.includes(userId);
}

export function findApprovalRuleById(
  rules: ParsedApprovalRule[],
  ruleId: string,
): ParsedApprovalRule | undefined {
  return rules.find((r) => r.id === ruleId);
}

export async function getApprovedRuleIdsForTask(
  prisma: PrismaClient,
  taskId: string,
  columnId: string,
): Promise<Set<string>> {
  const rows = await prisma.taskColumnApproval.findMany({
    where: {
      taskId,
      columnId,
      status: { in: ['approved', 'approve'] },
    },
    select: { ruleId: true },
  });
  return new Set(rows.map((r) => r.ruleId));
}

export async function assertColumnApprovalsComplete(
  prisma: PrismaClient,
  taskId: string,
  columnId: string,
  advancedSettings: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const rules = getApprovalRulesForColumn(parseBoardApprovalRules(advancedSettings), columnId);
  if (rules.length === 0) return { ok: true };

  const approved = await getApprovedRuleIdsForTask(prisma, taskId, columnId);
  const pending = rules.filter((r) => !approved.has(r.id));
  if (pending.length === 0) return { ok: true };

  const names = pending.map((r) => r.name || 'Согласование').join(', ');
  return {
    ok: false,
    message: `Перед сменой статуса необходимо получить согласования: ${names}`,
  };
}
