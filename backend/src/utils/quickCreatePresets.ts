import type { Board, BoardColumn, PrismaClient, QuickCreateTaskPreset, TaskType } from '@prisma/client';
import { isAggregatedBoard } from './aggregatedBoard';
import { NOT_ARCHIVED } from './archiveScope';

export type QuickCreatePresetDto = {
  id: string;
  workspaceId: string;
  name: string;
  boardId: string;
  boardName: string;
  columnId: string;
  columnName: string;
  typeId?: string;
  typeName?: string;
  legalFormsEnabled: boolean;
  legalFormsPath?: string;
  legalFormsAccessToken?: string;
  position: number;
  enabled: boolean;
};

type BoardWithRelations = Board & {
  columns: BoardColumn[];
  taskTypes: TaskType[];
};

export function serializeQuickCreatePreset(
  preset: QuickCreateTaskPreset,
  board: BoardWithRelations | null,
): QuickCreatePresetDto | null {
  if (!board || isAggregatedBoard(board) || board.archivedAt) return null;

  const column = board.columns.find((c) => c.id === preset.columnId);
  if (!column) return null;

  if (preset.typeId && !board.taskTypes.some((t) => t.id === preset.typeId)) {
    return null;
  }

  const typeName = preset.typeId
    ? board.taskTypes.find((t) => t.id === preset.typeId)?.name
    : undefined;

  return {
    id: preset.id,
    workspaceId: preset.workspaceId,
    name: preset.name,
    boardId: preset.boardId,
    boardName: board.name,
    columnId: preset.columnId,
    columnName: column.name,
    typeId: preset.typeId ?? undefined,
    typeName,
    legalFormsEnabled: preset.legalFormsEnabled,
    legalFormsPath: preset.legalFormsPath ?? undefined,
    legalFormsAccessToken: preset.legalFormsAccessToken ?? undefined,
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
    where: { id: { in: boardIds }, workspaceId, ...NOT_ARCHIVED },
    include: {
      columns: { orderBy: { position: 'asc' } },
      taskTypes: { orderBy: { name: 'asc' } },
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
  typeId?: string | null;
  legalFormsEnabled?: boolean;
  legalFormsPath?: string | null;
  legalFormsAccessToken?: string | null;
  position?: number;
  enabled?: boolean;
};

function normalizeOptionalString(raw: unknown): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : null;
}

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
    where: { id: { in: boardIds }, workspaceId, ...NOT_ARCHIVED },
    include: {
      columns: true,
      taskTypes: true,
    },
  });
  const boardById = new Map(boards.map((b) => [b.id, b]));

  for (let idx = 0; idx < incoming.length; idx++) {
    const row = incoming[idx];
    const name = String(row.name ?? '').trim();
    const boardId = String(row.boardId ?? '').trim();
    const columnId = String(row.columnId ?? '').trim();
    const typeId = normalizeOptionalString(row.typeId);
    const legalFormsEnabled = row.legalFormsEnabled === true;
    const legalFormsPath = normalizeOptionalString(row.legalFormsPath);

    if (!name) throw new Error(`Пресет ${idx + 1}: укажите название`);
    if (!boardId) throw new Error(`Пресет «${name}»: выберите доску`);
    if (!columnId) throw new Error(`Пресет «${name}»: выберите колонку`);

    const board = boardById.get(boardId);
    if (!board) throw new Error(`Пресет «${name}»: доска не найдена в пространстве`);
    if (isAggregatedBoard(board)) {
      throw new Error(`Пресет «${name}»: нельзя использовать сводную доску`);
    }
    if (board.archivedAt) {
      throw new Error(`Пресет «${name}»: доска в архиве`);
    }
    if (!board.columns.some((c) => c.id === columnId)) {
      throw new Error(`Пресет «${name}»: колонка не принадлежит выбранной доске`);
    }
    if (typeId && !board.taskTypes.some((t) => t.id === typeId)) {
      throw new Error(`Пресет «${name}»: тип задачи не принадлежит выбранной доске`);
    }
    if (legalFormsEnabled && !legalFormsPath) {
      throw new Error(`Пресет «${name}»: укажите путь к форме Legal Forms`);
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
          typeId: normalizeOptionalString(row.typeId),
          legalFormsEnabled: row.legalFormsEnabled === true,
          legalFormsPath: normalizeOptionalString(row.legalFormsPath),
          legalFormsAccessToken: normalizeOptionalString(row.legalFormsAccessToken),
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
