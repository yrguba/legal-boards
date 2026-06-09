import type { PrismaClient } from '@prisma/client';

export async function getWorkspaceMemberIds(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<Set<string>> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });
  if (!ws) return new Set();

  const members = await prisma.workspaceUser.findMany({
    where: { workspaceId },
    select: { userId: true },
  });
  return new Set([ws.ownerId, ...members.map((m) => m.userId)]);
}
