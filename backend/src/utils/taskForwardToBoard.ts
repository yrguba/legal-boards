import type { PrismaClient } from '@prisma/client';
import { createAndBroadcastNotification } from './notifications';
import {
  getColumnActionRulesFor,
  parseBoardColumnActionRules,
  parseForwardToBoardConfig,
} from './boardColumnActions';
import {
  addTaskToBoard,
  getPlacementForBoard,
  type TaskBoardPlacementDto,
} from './taskPlacements';
import {
  TASK_BOARD_TRANSITION_KIND,
  writeTaskBoardTransition,
} from './taskBoardTransitions';

export async function applyForwardToBoardRules(
  prisma: PrismaClient,
  args: {
    taskId: string;
    sourceBoardId: string;
    fromColumnId: string;
    toColumnId: string;
    advancedSettings: unknown;
    actorUserId?: string | null;
    taskTitle?: string;
    assigneeId?: string | null;
    createdBy?: string | null;
  },
): Promise<{ placements: TaskBoardPlacementDto[] }> {
  const allRules = parseBoardColumnActionRules(args.advancedSettings);
  const matched = [
    ...getColumnActionRulesFor(allRules, args.toColumnId, 'on_enter').filter(
      (r) => r.actionKind === 'forward_to_board',
    ),
    ...getColumnActionRulesFor(allRules, args.fromColumnId, 'on_exit').filter(
      (r) => r.actionKind === 'forward_to_board',
    ),
  ];

  const seen = new Set<string>();
  const rules = matched.filter((rule) => {
    if (seen.has(rule.id)) return false;
    seen.add(rule.id);
    return true;
  });

  const placements: TaskBoardPlacementDto[] = [];

  for (const rule of rules) {
    const cfg = parseForwardToBoardConfig(rule.config);
    if (!cfg.targetBoardId || cfg.targetBoardId === args.sourceBoardId) continue;

    if (cfg.skipIfAlreadyOnBoard) {
      const existing = await getPlacementForBoard(prisma, args.taskId, cfg.targetBoardId);
      if (existing) continue;
    }

    try {
      const result = await addTaskToBoard(prisma, {
        taskId: args.taskId,
        boardId: cfg.targetBoardId,
        columnId: cfg.targetColumnId || null,
        actorUserId: args.actorUserId,
        forwardLink: {
          sourceBoardId: args.sourceBoardId,
          sourceColumnId: args.toColumnId,
          ruleId: rule.id,
          ruleName: rule.name,
        },
      });

      if (!result.created) continue;

      placements.push(result.placement);

      const [sourceBoard, targetBoard] = await Promise.all([
        prisma.board.findUnique({
          where: { id: args.sourceBoardId },
          select: { name: true, workspaceId: true },
        }),
        prisma.board.findUnique({
          where: { id: cfg.targetBoardId },
          select: { name: true },
        }),
      ]);

      const sourceColumn = await prisma.boardColumn.findUnique({
        where: { id: args.toColumnId },
        select: { name: true },
      });

      await writeTaskBoardTransition(prisma, {
        taskId: args.taskId,
        workspaceId: sourceBoard?.workspaceId ?? '',
        eventKind: TASK_BOARD_TRANSITION_KIND.AUTO_FORWARD,
        boardId: args.sourceBoardId,
        columnId: args.toColumnId,
        fromColumnId: args.fromColumnId,
        toColumnId: args.toColumnId,
        targetBoardId: cfg.targetBoardId,
        targetColumnId: result.placement.columnId,
        ruleId: rule.id,
        ruleName: rule.name || null,
        actorUserId: args.actorUserId,
        source: 'rule',
        payload: {
          sourceBoardName: sourceBoard?.name ?? null,
          sourceColumnName: sourceColumn?.name ?? null,
          targetBoardName: targetBoard?.name ?? result.placement.boardName,
          targetColumnName: result.placement.columnName,
          ruleName: rule.name || null,
        },
      });

      const message = `Задача «${args.taskTitle ?? '—'}» передана на доску «${result.placement.boardName}»`;
      const notifyUserIds = Array.from(
        new Set([args.assigneeId, args.createdBy].filter((id): id is string => Boolean(id))),
      );
      await Promise.all(
        notifyUserIds.map((userId) =>
          createAndBroadcastNotification(prisma, {
            type: 'status_change',
            title: 'Задача на другой доске',
            message,
            userId,
            relatedId: args.taskId,
          }),
        ),
      );
    } catch (err) {
      console.error('forward_to_board rule failed:', rule.id, err);
    }
  }

  return { placements };
}
