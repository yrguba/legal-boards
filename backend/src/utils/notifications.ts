import type { PrismaClient } from '@prisma/client';
import { broadcast } from '../realtime';

export async function createAndBroadcastNotification(
  prisma: PrismaClient,
  args: {
    type: string;
    title: string;
    message: string;
    userId: string;
    relatedId?: string;
  },
) {
  const notification = await prisma.notification.create({
    data: {
      type: args.type,
      title: args.title,
      message: args.message,
      userId: args.userId,
      relatedId: args.relatedId,
    },
  });

  broadcast({
    type: 'notification',
    userId: args.userId,
    notification,
  });

  return notification;
}
