import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, requireStaffUser } from '../middleware/auth';
import { assertWorkspaceMember } from '../utils/documentAccess';
import { resolveWorkspaceRole } from '../utils/workspaceRole';
import { parseBoardApprovalRules } from '../utils/boardApprovals';
import {
  buildBoardAging,
  buildBoardFunnel,
  buildPendingApprovals,
  loadBoardReportTasks,
} from '../utils/boardReports';
import { parseBoardReportingCfg } from '../utils/boardReportingConfig';
import {
  computeApprovalAnalytics,
  computeProcessMetrics,
  loadBoardColumnChangeLogs,
} from '../utils/boardProcessMetrics';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);
router.use(requireStaffUser);

async function resolveBoard(boardIdOrCode: string) {
  return prisma.board.findFirst({
    where: { OR: [{ id: boardIdOrCode }, { code: boardIdOrCode }] },
    include: {
      columns: { orderBy: { position: 'asc' } },
    },
  });
}

const ANALYTICS_ROLES = new Set(['admin', 'manager']);

async function assertAnalyticsAccess(
  req: AuthRequest,
  boardIdOrCode: string,
): Promise<
  | { ok: true; board: Awaited<ReturnType<typeof resolveBoard>> & { id: string } }
  | { ok: false; status: number; error: string }
> {
  const board = await resolveBoard(boardIdOrCode);
  if (!board) {
    return { ok: false, status: 404, error: 'Доска не найдена' };
  }

  if (!req.userId) {
    return { ok: false, status: 403, error: 'Недостаточно прав' };
  }

  const isMember = await assertWorkspaceMember(
    prisma,
    board.workspaceId,
    req.userId,
    req.userRole,
  );
  if (!isMember) {
    return { ok: false, status: 403, error: 'Нет доступа к этому пространству' };
  }

  const workspaceRole = await resolveWorkspaceRole(prisma, req.userId, board.workspaceId);
  const canView = workspaceRole !== null && ANALYTICS_ROLES.has(workspaceRole);

  if (!canView) {
    return { ok: false, status: 403, error: 'Аналитика доступна руководителям и администраторам' };
  }

  return { ok: true, board };
}

function parseAssigneeFilter(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

function parseAgingDays(raw: unknown): number {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 1) return 7;
  return Math.min(n, 90);
}

function parsePeriodDays(raw: unknown): number {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 1) return 30;
  return Math.min(n, 365);
}

router.get('/boards/:boardId/dashboard', async (req: AuthRequest, res) => {
  try {
    const gate = await assertAnalyticsAccess(req, req.params.boardId);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.error });
    }
    const board = gate.board!;
    const assigneeId = parseAssigneeFilter(req.query.assigneeId);
    const agingDays = parseAgingDays(req.query.agingDays);
    const periodDays = parsePeriodDays(req.query.periodDays);

    const tasks = await loadBoardReportTasks(prisma, board.id, assigneeId);
    const approvalRules = parseBoardApprovalRules(board.advancedSettings ?? {});
    const reportingCfg = parseBoardReportingCfg(board.advancedSettings ?? {}, board.columns);
    const taskIds = tasks.map((t) => t.id);
    const columnChanges = await loadBoardColumnChangeLogs(prisma, board.id, taskIds);

    const [funnel, aging, pendingApprovals, processMetrics, approvalAnalytics] = await Promise.all([
      buildBoardFunnel(prisma, board.columns, tasks),
      buildBoardAging(prisma, tasks, agingDays),
      Promise.resolve(buildPendingApprovals(approvalRules, tasks)),
      reportingCfg
        ? Promise.resolve(
            computeProcessMetrics(tasks, columnChanges, board.columns, reportingCfg, periodDays),
          )
        : Promise.resolve(null),
      computeApprovalAnalytics(prisma, board.id, tasks, columnChanges, periodDays),
    ]);

    res.json({
      boardId: board.id,
      boardName: board.name,
      workspaceId: board.workspaceId,
      generatedAt: new Date().toISOString(),
      filters: { assigneeId: assigneeId ?? null, agingDays, periodDays },
      funnel,
      aging,
      pendingApprovals,
      processMetrics,
      approvalAnalytics,
      summary: {
        totalTasks: tasks.length,
        staleTasksCount: aging.length,
        pendingApprovalsCount: pendingApprovals.length,
        inProgressCount: processMetrics?.inProgressCount ?? null,
        completedInPeriod: processMetrics?.throughput.completed ?? null,
      },
    });
  } catch (error) {
    console.error('Board dashboard report error:', error);
    res.status(500).json({ error: 'Ошибка формирования отчёта' });
  }
});

export default router;
