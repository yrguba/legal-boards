import type { Board, BoardColumn, PrismaClient, QuickCreateTaskPreset } from '@prisma/client';
import { isAggregatedBoard } from './aggregatedBoard';

export type QuickCreatePresetDto = {
  id: string;
  workspaceId: string;
  name: string;
  boardId: string;
  boardName: string;
  columnId: string;
  columnName: string;
  position: number;
  enabled: boolean;
};

type BoardWithRelations = Board & {
  columns: BoardColumn[];
};

export function serializeQuickCreatePreset(
  preset: QuickCreateTaskPreset,
  board: BoardWithRelations | null,
): QuickCreatePresetDto | null {
  if (!board || isAggregatedBoard(board)) return null;

  const column = board.columns.find((c) => c.id === preset.columnId);
  if (!column) return null;

  return {
    id: preset.id,
    workspaceId: preset.workspaceId,
    name: preset.name,
    boardId: preset.boardId,
    boardName: board.name,
    columnId: preset.columnId,
    columnName: column.name,
    position: preset.position,
    enabled: preset.enabled,
  };
}

export async function listQuickCreatePresets(
  prisma: PrismaClient,
  workspaceId: string,
  options: { enabledOnly?: boolean } = {},
): Promise<QuickCreatePresetDto[]> {
  const presets = await prisma.quickCreateTaskPreset.findMany({
    where: {
      workspaceId,
      ...(options.enabledOnly ? { enabled: true } : {}),
    },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
  });

  if (presets.length === 0) return [];

  const boardIds = [...new Set(presets.map((p) => p.boardId))];
  const boards = await prisma.board.findMany({
    where: { id: { in: boardIds }, workspaceId },
    include: {
      columns: { orderBy: { position: 'asc' } },
    },
  });
  const boardById = new Map(boards.map((b) => [b.id, b]));

  const out: QuickCreatePresetDto[] = [];
  for (const preset of presets) {
    const dto = serializeQuickCreatePreset(preset, boardById.get(preset.boardId) ?? null);
    if (dto) out.push(dto);
  }
  return out;
}

type IncomingPreset = {
  id?: string;
  name?: string;
  boardId?: string;
  columnId?: string;
  position?: number;
  enabled?: boolean;
};

export async function replaceQuickCreatePresets(
  prisma: PrismaClient,
  workspaceId: string,
  incoming: IncomingPreset[],
): Promise<QuickCreatePresetDto[]> {
  if (!Array.isArray(incoming)) {
    throw new Error('presets должен быть массивом');
  }

  const boardIds = [
    ...new Set(incoming.map((p) => String(p.boardId ?? '').trim()).filter(Boolean)),
  ];
  const boards = await prisma.board.findMany({
    where: { id: { in: boardIds }, workspaceId },
    include: { columns: true },
  });
  const boardById = new Map(boards.map((b) => [b.id, b]));

  for (let idx = 0; idx < incoming.length; idx++) {
    const row = incoming[idx];
    const name = String(row.name ?? '').trim();
    const boardId = String(row.boardId ?? '').trim();
    const columnId = String(row.columnId ?? '').trim();

    if (!name) throw new Error(`Пресет ${idx + 1}: укажите название`);
    if (!boardId) throw new Error(`Пресет «${name}»: выберите доску`);
    if (!columnId) throw new Error(`Пресет «${name}»: выберите колонку`);

    const board = boardById.get(boardId);
    if (!board) throw new Error(`Пресет «${name}»: доска не найдена в пространстве`);
    if (isAggregatedBoard(board)) {
      throw new Error(`Пресет «${name}»: нельзя использовать сводную доску`);
    }
    if (!board.columns.some((c) => c.id === columnId)) {
      throw new Error(`Пресет «${name}»: колонка не принадлежит выбранной доске`);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.quickCreateTaskPreset.deleteMany({ where: { workspaceId } });
    for (let idx = 0; idx < incoming.length; idx++) {
      const row = incoming[idx];
      await tx.quickCreateTaskPreset.create({
        data: {
          workspaceId,
          name: String(row.name ?? '').trim(),
          boardId: String(row.boardId ?? '').trim(),
          columnId: String(row.columnId ?? '').trim(),
          position: typeof row.position === 'number' ? row.position : idx,
          enabled: row.enabled !== false,
        },
      });
    }
  });

  return listQuickCreatePresets(prisma, workspaceId);
}

export async function assertWorkspaceMember(
  prisma: PrismaClient,
  workspaceId: string,
  userId: string,
): Promise<{ ownerId: string } | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, ownerId: true },
  });
  if (!workspace) return null;

  if (workspace.ownerId === userId) return workspace;

  const member = await prisma.workspaceUser.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { id: true },
  });
  if (!member) return null;

  return workspace;
}
