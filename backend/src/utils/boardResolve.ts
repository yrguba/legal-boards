import type { Board, PrismaClient } from '@prisma/client';

/** Доска по id, текущему code или устаревшему alias. */
export async function resolveBoardRef(
  prisma: PrismaClient,
  ref: string,
): Promise<Board | null> {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  const byId = await prisma.board.findUnique({ where: { id: trimmed } });
  if (byId) return byId;

  const byCode = await prisma.board.findUnique({ where: { code: trimmed } });
  if (byCode) return byCode;

  const alias = await prisma.boardCodeAlias.findUnique({
    where: { code: trimmed },
    include: { board: true },
  });
  return alias?.board ?? null;
}
