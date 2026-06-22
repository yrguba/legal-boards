import type { PrismaClient } from '@prisma/client';
import { broadcast } from '../realtime';
import { isNotificationEnabledForUser } from './notificationSettings/preferences';

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
  const enabled = await isNotificationEnabledForUser(args.userId, args.type);
  if (!enabled) {
    return null;
  }

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
    ...(args.relatedId ? { taskId: args.relatedId } : {}),
  });

  return notification;
}
