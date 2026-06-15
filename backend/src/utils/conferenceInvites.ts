import type { PrismaClient } from '@prisma/client';
import { buildPublicJoinUrl } from './conferences';
import { createAndBroadcastNotification } from './notifications';
import { sendEmail, isEmailConfigured, isConsoleEmailMode } from './email';

function formatRuDateTime(d: Date): string {
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildConferenceInviteEmailHtml(args: {
  title: string;
  creatorName: string;
  startAt: Date;
  endAt: Date;
  joinUrl: string;
}): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0f172a; margin: 0 0 16px;">Приглашение на конференцию</h2>
      <p style="color: #334155; line-height: 1.5;"><strong>${args.title}</strong></p>
      <p style="color: #334155; line-height: 1.5;">Организатор: ${args.creatorName}</p>
      <p style="color: #334155; line-height: 1.5;">
        ${formatRuDateTime(args.startAt)} — ${formatRuDateTime(args.endAt)}
      </p>
      <p style="margin: 24px 0;">
        <a href="${args.joinUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          Присоединиться
        </a>
      </p>
      <p style="color: #94a3b8; font-size: 12px; word-break: break-all;">${args.joinUrl}</p>
    </div>
  `;
}

export async function sendScheduledConferenceInvites(
  prisma: PrismaClient,
  args: {
    conferenceId: string;
    workspaceId: string;
    creatorId: string;
    creatorName: string;
    title: string;
    shareToken: string;
    startAt: Date;
    endAt: Date;
    attendeeIds: string[];
  },
): Promise<{ notifications: number; emails: number; emailsFailed: number }> {
  const joinUrl = buildPublicJoinUrl(args.shareToken);
  const timeStr = `${formatRuDateTime(args.startAt)} — ${formatRuDateTime(args.endAt)}`;

  let notifications = 0;
  for (const userId of args.attendeeIds) {
    if (userId === args.creatorId) continue;
    await createAndBroadcastNotification(prisma, {
      type: 'conference_invite',
      title: 'Приглашение на конференцию',
      message: `«${args.title}» — ${timeStr}. Организатор: ${args.creatorName}`,
      userId,
      relatedId: args.conferenceId,
    });
    notifications += 1;
  }

  const recipientIds = args.attendeeIds.filter((id) => id !== args.creatorId);
  let emails = 0;
  let emailsFailed = 0;

  if (recipientIds.length === 0) {
    console.log('[conference-invite] No attendees to email (only creator or empty list)');
  } else if (!isEmailConfigured()) {
    console.warn(
      '[conference-invite] Email not sent: set RESEND_API_KEY and RESEND_FROM in backend/.env',
    );
  } else {
    const users = await prisma.user.findMany({
      where: { id: { in: recipientIds } },
      select: { id: true, email: true },
    });
    const html = buildConferenceInviteEmailHtml({
      title: args.title,
      creatorName: args.creatorName,
      startAt: args.startAt,
      endAt: args.endAt,
      joinUrl,
    });
    for (const u of users) {
      try {
        await sendEmail({
          to: u.email,
          subject: `Приглашение: ${args.title}`,
          html,
        });
        emails += 1;
        console.log(`[conference-invite] Email sent to ${u.email}`);
      } catch (e) {
        emailsFailed += 1;
        console.error(`[conference-invite] Email failed for ${u.email}:`, e);
      }
    }
    if (isConsoleEmailMode()) {
      console.log(
        `[conference-invite] Console mode: ${emails} email(s) logged, not delivered via Resend`,
      );
    }
  }

  return { notifications, emails, emailsFailed };
}

export function buildConferenceCancelledEmailHtml(args: {
  title: string;
  creatorName: string;
  startAt: Date;
  endAt: Date;
}): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0f172a; margin: 0 0 16px;">Конференция отменена</h2>
      <p style="color: #334155; line-height: 1.5;"><strong>${args.title}</strong></p>
      <p style="color: #334155; line-height: 1.5;">Организатор: ${args.creatorName}</p>
      <p style="color: #334155; line-height: 1.5;">
        Было запланировано: ${formatRuDateTime(args.startAt)} — ${formatRuDateTime(args.endAt)}
      </p>
      <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
        Встреча отменена организатором. Ссылка для входа больше не действует.
      </p>
    </div>
  `;
}

export function buildConferenceUpdatedEmailHtml(args: {
  title: string;
  creatorName: string;
  startAt: Date;
  endAt: Date;
  joinUrl: string;
}): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0f172a; margin: 0 0 16px;">Изменения в конференции</h2>
      <p style="color: #334155; line-height: 1.5;"><strong>${args.title}</strong></p>
      <p style="color: #334155; line-height: 1.5;">Организатор: ${args.creatorName}</p>
      <p style="color: #334155; line-height: 1.5;">
        Новое время: ${formatRuDateTime(args.startAt)} — ${formatRuDateTime(args.endAt)}
      </p>
      <p style="margin: 24px 0;">
        <a href="${args.joinUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          Присоединиться
        </a>
      </p>
      <p style="color: #94a3b8; font-size: 12px; word-break: break-all;">${args.joinUrl}</p>
    </div>
  `;
}

async function notifyConferenceAttendees(
  prisma: PrismaClient,
  args: {
    attendeeIds: string[];
    creatorId: string;
    creatorName: string;
    conferenceId: string;
    title: string;
    message: string;
    notificationType: string;
    emailSubject: string;
    emailHtml: string;
  },
): Promise<{ notifications: number; emails: number; emailsFailed: number }> {
  let notifications = 0;
  for (const userId of args.attendeeIds) {
    if (userId === args.creatorId) continue;
    await createAndBroadcastNotification(prisma, {
      type: args.notificationType,
      title: args.title,
      message: args.message,
      userId,
      relatedId: args.conferenceId,
    });
    notifications += 1;
  }

  const recipientIds = args.attendeeIds.filter((id) => id !== args.creatorId);
  let emails = 0;
  let emailsFailed = 0;

  if (recipientIds.length === 0) {
    return { notifications, emails, emailsFailed };
  }
  if (!isEmailConfigured()) {
    console.warn('[conference-notify] Email not sent: RESEND not configured');
    return { notifications, emails, emailsFailed };
  }

  const users = await prisma.user.findMany({
    where: { id: { in: recipientIds } },
    select: { id: true, email: true },
  });

  for (const u of users) {
    try {
      await sendEmail({
        to: u.email,
        subject: args.emailSubject,
        html: args.emailHtml,
      });
      emails += 1;
    } catch (e) {
      emailsFailed += 1;
      console.error(`[conference-notify] Email failed for ${u.email}:`, e);
    }
  }

  return { notifications, emails, emailsFailed };
}

export async function sendConferenceCancellationNotices(
  prisma: PrismaClient,
  args: {
    conferenceId: string;
    creatorId: string;
    creatorName: string;
    title: string;
    startAt: Date;
    endAt: Date;
    attendeeIds: string[];
  },
): Promise<{ notifications: number; emails: number; emailsFailed: number }> {
  const timeStr = `${formatRuDateTime(args.startAt)} — ${formatRuDateTime(args.endAt)}`;
  return notifyConferenceAttendees(prisma, {
    attendeeIds: args.attendeeIds,
    creatorId: args.creatorId,
    creatorName: args.creatorName,
    conferenceId: args.conferenceId,
    title: 'Конференция отменена',
    message: `«${args.title}» (${timeStr}) отменена. Организатор: ${args.creatorName}`,
    notificationType: 'conference_cancelled',
    emailSubject: `Отмена: ${args.title}`,
    emailHtml: buildConferenceCancelledEmailHtml({
      title: args.title,
      creatorName: args.creatorName,
      startAt: args.startAt,
      endAt: args.endAt,
    }),
  });
}

export async function sendConferenceUpdateNotices(
  prisma: PrismaClient,
  args: {
    conferenceId: string;
    creatorId: string;
    creatorName: string;
    title: string;
    shareToken: string;
    startAt: Date;
    endAt: Date;
    attendeeIds: string[];
  },
): Promise<{ notifications: number; emails: number; emailsFailed: number }> {
  const joinUrl = buildPublicJoinUrl(args.shareToken);
  const timeStr = `${formatRuDateTime(args.startAt)} — ${formatRuDateTime(args.endAt)}`;
  return notifyConferenceAttendees(prisma, {
    attendeeIds: args.attendeeIds,
    creatorId: args.creatorId,
    creatorName: args.creatorName,
    conferenceId: args.conferenceId,
    title: 'Конференция изменена',
    message: `«${args.title}» — новое время: ${timeStr}. Организатор: ${args.creatorName}`,
    notificationType: 'conference_updated',
    emailSubject: `Изменения: ${args.title}`,
    emailHtml: buildConferenceUpdatedEmailHtml({
      title: args.title,
      creatorName: args.creatorName,
      startAt: args.startAt,
      endAt: args.endAt,
      joinUrl,
    }),
  });
}
