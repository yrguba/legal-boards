import type { Prisma, PrismaClient } from '@prisma/client';

type DbClient = PrismaClient | Prisma.TransactionClient;
import { resolveBoardRef } from './boardResolve';

const CUID_LIKE_RE = /^c[a-z0-9]{20,}$/i;

export function formatTaskKey(boardCode: string, number: number): string {
  return `${boardCode}-${number}`;
}

export function parseTaskKeyRef(ref: string): { boardCode: string; number: number } | null {
  const trimmed = ref.trim();
  const match = trimmed.match(/^(.+)-(\d+)$/);
  if (!match) return null;
  const number = Number.parseInt(match[2], 10);
  if (!Number.isFinite(number) || number < 1) return null;
  return { boardCode: match[1], number };
}

export function isTaskKeyRef(ref: string): boolean {
  return parseTaskKeyRef(ref) != null;
}

export type ResolvedTaskRef = {
  taskId: string;
  boardId: string;
  boardCode: string;
  number: number;
  key: string;
};

export async function resolveTaskRef(
  prisma: PrismaClient,
  ref: string,
): Promise<ResolvedTaskRef | null> {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  const parsed = parseTaskKeyRef(trimmed);
  if (parsed) {
    const board = await resolveBoardRef(prisma, parsed.boardCode);
    if (!board) return null;
    const task = await prisma.task.findUnique({
      where: { boardId_number: { boardId: board.id, number: parsed.number } },
      select: { id: true, number: true, boardId: true },
    });
    if (!task) return null;
    return {
      taskId: task.id,
      boardId: board.id,
      boardCode: board.code,
      number: task.number,
      key: formatTaskKey(board.code, task.number),
    };
  }

  if (CUID_LIKE_RE.test(trimmed)) {
    const task = await prisma.task.findUnique({
      where: { id: trimmed },
      include: { board: { select: { code: true } } },
    });
    if (!task) return null;
    return {
      taskId: task.id,
      boardId: task.boardId,
      boardCode: task.board.code,
      number: task.number,
      key: formatTaskKey(task.board.code, task.number),
    };
  }

  return null;
}

export async function nextTaskNumber(
  prisma: DbClient,
  boardId: string,
): Promise<number> {
  const agg = await prisma.task.aggregate({
    where: { boardId },
    _max: { number: true },
  });
  return (agg._max.number ?? 0) + 1;
}

export function enrichTaskWithKey<T extends Record<string, unknown>>(
  task: T,
  boardCode?: string,
): T & { number?: number; boardCode?: string; key?: string } {
  const number = task.number as number | undefined;
  const code =
    boardCode ??
    (task.board as { code?: string } | undefined)?.code ??
    (task.boardCode as string | undefined);
  if (code == null || number == null) return task as T & { number?: number; boardCode?: string; key?: string };
  const key = formatTaskKey(code, number);
  return { ...task, boardCode: code, number, key };
}
