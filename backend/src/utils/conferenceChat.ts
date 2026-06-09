import type { PrismaClient } from '@prisma/client';
import { ensureChannelsForWorkspace } from './workspaceChatChannels';
import { buildPublicJoinUrl } from './conferences';

export async function postConferenceToAllChannels(
  prisma: PrismaClient,
  args: {
    workspaceId: string;
    userId: string;
    title: string;
    shareToken: string;
    creatorName: string;
    startAt?: Date;
    endAt?: Date | null;
  },
): Promise<number> {
  await ensureChannelsForWorkspace(prisma, args.workspaceId);
  const channels = await prisma.workspaceChatChannel.findMany({
    where: { workspaceId: args.workspaceId },
    select: { id: true },
  });

  const joinLink = buildPublicJoinUrl(args.shareToken);
  const timeLine =
    args.startAt && args.endAt
      ? `\n🕐 ${args.startAt.toLocaleString('ru-RU')} — ${args.endAt.toLocaleString('ru-RU')}`
      : args.startAt
        ? `\n🕐 ${args.startAt.toLocaleString('ru-RU')}`
        : '';

  const content = [
    `📹 Конференция «${args.title}»`,
    `👤 Организатор: ${args.creatorName}`,
    timeLine,
    `🔗 ${joinLink}`,
  ]
    .filter(Boolean)
    .join('\n');

  if (channels.length === 0) return 0;

  await prisma.workspaceChatMessage.createMany({
    data: channels.map((c) => ({
      channelId: c.id,
      userId: args.userId,
      content,
    })),
  });

  return channels.length;
}
