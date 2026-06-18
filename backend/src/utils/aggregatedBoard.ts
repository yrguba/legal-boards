import type { Board, PrismaClient } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth';
import { assertWorkspaceMember, getUserDocumentAccess } from './documentAccess';
import { canSeeAggregatedBoard } from './boardAccess';

export const BOARD_KIND_STANDARD = 'standard';
export const BOARD_KIND_AGGREGATED = 'aggregated';

export function isAggregatedBoard(board: Pick<Board, 'kind'>): boolean {
  return board.kind === BOARD_KIND_AGGREGATED;
}

export async function validateAggregatedSourceBoardIds(
  prisma: PrismaClient,
  workspaceId: string,
  sourceBoardIds: string[],
  aggregatedBoardId?: string,
): Promise<{ ok: true; boards: Board[] } | { ok: false; error: string }> {
  const unique = [...new Set(sourceBoardIds.filter((id) => typeof id === 'string' && id.trim()))];
  if (unique.length === 0) {
    return { ok: false, error: 'Выберите хотя бы одну доску' };
  }

  const boards = await prisma.board.findMany({
    where: { id: { in: unique }, workspaceId },
  });

  if (boards.length !== unique.length) {
    return { ok: false, error: 'Некорректные доски для сводной' };
  }

  for (const b of boards) {
    if (isAggregatedBoard(b)) {
      return { ok: false, error: 'Сводная доска не может включать другую сводную' };
    }
    if (aggregatedBoardId && b.id === aggregatedBoardId) {
      return { ok: false, error: 'Нельзя добавить сводную доску в саму себя' };
    }
  }

  return { ok: true, boards };
}

export type AggregatedSourceDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  position: number;
  columns: { id: string; name: string; position: number }[];
};

export async function loadAggregatedSourcesDto(
  prisma: PrismaClient,
  aggregatedBoardId: string,
): Promise<AggregatedSourceDto[]> {
  const rows = await prisma.aggregatedBoardSource.findMany({
    where: { aggregatedBoardId },
    orderBy: { position: 'asc' },
    include: {
      sourceBoard: {
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          columns: {
            orderBy: { position: 'asc' },
            select: { id: true, name: true, position: true },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.sourceBoard.id,
    code: row.sourceBoard.code,
    name: row.sourceBoard.name,
    description: row.sourceBoard.description,
    position: row.position,
    columns: row.sourceBoard.columns,
  }));
}

export async function assertAggregatedBoardView(
  prisma: PrismaClient,
  req: AuthRequest,
  board: { id: string; workspaceId: string; kind: string; visibility: unknown },
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!isAggregatedBoard(board)) {
    return { ok: true };
  }
  if (!req.userId) {
    return { ok: false, status: 403, error: 'Недостаточно прав' };
  }

  const member = await assertWorkspaceMember(
    prisma,
    board.workspaceId,
    req.userId,
    req.userRole,
  );
  if (!member) {
    return { ok: false, status: 403, error: 'Нет доступа к этому пространству' };
  }

  const [access, workspace] = await Promise.all([
    getUserDocumentAccess(prisma, req.userId, board.workspaceId),
    prisma.workspace.findUnique({
      where: { id: board.workspaceId },
      select: { ownerId: true },
    }),
  ]);

  const allowed = canSeeAggregatedBoard(board.visibility, access, {
    isAdmin: req.userRole === 'admin',
    isWorkspaceOwner: workspace?.ownerId === req.userId,
  });
  if (!allowed) {
    return { ok: false, status: 403, error: 'Нет доступа к этой сводной доске' };
  }

  return { ok: true };
}
