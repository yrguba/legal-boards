import fs from 'fs';
import path from 'path';
import type { PrismaClient } from '@prisma/client';
import { getUploadsPath } from '../uploadsPath';
import { getFrontendUrl } from './registration';
import { isConsoleEmailMode, isEmailConfigured, sendEmail, type EmailAttachment } from './email';
import { parseEnvFlag } from './envFlags';

export const FEEDBACK_CATEGORIES = ['bug', 'improvement', 'question', 'other'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_STATUS = {
  new: 'new',
  in_progress: 'in_progress',
  resolved: 'resolved',
  closed: 'closed',
} as const;

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: 'Ошибка',
  improvement: 'Улучшение',
  question: 'Вопрос',
  other: 'Другое',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'Новое',
  in_progress: 'В работе',
  resolved: 'Решено',
  closed: 'Закрыто',
};

export function isFeedbackEnabled(): boolean {
  return parseEnvFlag('FEEDBACK_ENABLED', true);
}

export function getFeedbackNotifyEmail(): string | null {
  const raw = process.env.FEEDBACK_NOTIFY_EMAIL?.trim();
  return raw || null;
}

export function getFeedbackMaxAttachments(): number {
  const n = Number(process.env.FEEDBACK_MAX_ATTACHMENTS ?? 3);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 5) : 3;
}

export function getFeedbackMaxAttachmentBytes(): number {
  const mb = Number(process.env.FEEDBACK_MAX_ATTACHMENT_MB ?? 5);
  const safeMb = Number.isFinite(mb) && mb > 0 ? Math.min(mb, 10) : 5;
  return safeMb * 1024 * 1024;
}

export function feedbackCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category as FeedbackCategory] ?? category;
}

export function feedbackStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function isFeedbackCategory(value: string): value is FeedbackCategory {
  return (FEEDBACK_CATEGORIES as readonly string[]).includes(value);
}

export function mapFeedbackTicket(row: {
  id: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  userId: string;
  workspaceId: string | null;
  pageUrl: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: { id: string; name: string; email: string };
  workspace?: { id: string; name: string } | null;
  attachments?: {
    id: string;
    name: string;
    type: string;
    size: number;
    path: string;
    createdAt: Date;
  }[];
}) {
  return {
    id: row.id,
    shortId: row.id.slice(-8).toUpperCase(),
    category: row.category,
    categoryLabel: feedbackCategoryLabel(row.category),
    subject: row.subject,
    description: row.description,
    status: row.status,
    statusLabel: feedbackStatusLabel(row.status),
    userId: row.userId,
    workspaceId: row.workspaceId,
    pageUrl: row.pageUrl,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    user: row.user
      ? { id: row.user.id, name: row.user.name, email: row.user.email }
      : undefined,
    workspace: row.workspace
      ? { id: row.workspace.id, name: row.workspace.name }
      : row.workspaceId
        ? null
        : undefined,
    attachments: (row.attachments ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      size: a.size,
      path: a.path,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

export async function assertFeedbackRateLimit(
  prisma: PrismaClient,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const count = await prisma.feedbackTicket.count({
    where: { userId, createdAt: { gte: since } },
  });
  if (count >= 10) {
    return { ok: false, error: 'Слишком много обращений. Попробуйте через час.' };
  }
  return { ok: true };
}

function loadFeedbackEmailAttachments(
  attachments: { name: string; type: string; path: string }[],
): EmailAttachment[] {
  const result: EmailAttachment[] = [];
  for (const att of attachments) {
    const fp = path.join(getUploadsPath(), path.basename(att.path));
    if (!fs.existsSync(fp)) {
      console.warn(`[feedback] attachment missing on disk: ${fp}`);
      continue;
    }
    try {
      result.push({
        filename: att.name,
        content: fs.readFileSync(fp),
        contentType: att.type || undefined,
      });
    } catch (err) {
      console.warn(`[feedback] failed to read attachment ${fp}:`, err);
    }
  }
  return result;
}

export async function sendFeedbackNotifyEmail(args: {
  ticketId: string;
  category: string;
  subject: string;
  description: string;
  userName: string;
  userEmail: string;
  workspaceName?: string | null;
  pageUrl?: string | null;
  attachments?: { name: string; type: string; path: string }[];
}): Promise<void> {
  const to = getFeedbackNotifyEmail();
  if (!to) {
    if (isConsoleEmailMode()) {
      console.log('[feedback] notify skipped: FEEDBACK_NOTIFY_EMAIL not set');
    }
    return;
  }
  if (!isEmailConfigured()) {
    console.warn('[feedback] Email skipped: RESEND not configured');
    return;
  }

  const shortId = args.ticketId.slice(-8).toUpperCase();
  const settingsUrl = `${getFrontendUrl()}/settings`;
  const attachmentRows = args.attachments ?? [];
  const emailAttachments = loadFeedbackEmailAttachments(attachmentRows);
  const attachmentsHtml =
    attachmentRows.length > 0
      ? `<p style="color: #334155; line-height: 1.5;"><strong>Вложения (${attachmentRows.length}):</strong> ${attachmentRows
          .map((a) => a.name.replace(/</g, '&lt;'))
          .join(', ')}</p>${
          emailAttachments.length > 0
            ? '<p style="color: #64748b; font-size: 13px;">Файлы прикреплены к этому письму.</p>'
            : '<p style="color: #b45309; font-size: 13px;">Файлы сохранены в системе, но не удалось прикрепить к письму.</p>'
        }`
      : '';

  await sendEmail({
    to,
    subject: `[Legal Boards #${shortId}] ${feedbackCategoryLabel(args.category)}: ${args.subject}`,
    html: `
    <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0f172a; margin: 0 0 16px;">Новое обращение #${shortId}</h2>
      <p style="color: #334155; line-height: 1.5;"><strong>Тип:</strong> ${feedbackCategoryLabel(args.category)}</p>
      <p style="color: #334155; line-height: 1.5;"><strong>Тема:</strong> ${args.subject}</p>
      <p style="color: #334155; line-height: 1.5;"><strong>От:</strong> ${args.userName} &lt;${args.userEmail}&gt;</p>
      ${args.workspaceName ? `<p style="color: #334155; line-height: 1.5;"><strong>Пространство:</strong> ${args.workspaceName}</p>` : ''}
      ${args.pageUrl ? `<p style="color: #334155; line-height: 1.5;"><strong>Страница:</strong> ${args.pageUrl}</p>` : ''}
      ${attachmentsHtml}
      <div style="margin: 16px 0; padding: 12px; background: #f8fafc; border-radius: 8px; white-space: pre-wrap; color: #334155;">${args.description.replace(/</g, '&lt;')}</div>
      <p style="color: #64748b; font-size: 13px;">ID: ${args.ticketId}</p>
      <p style="margin-top: 16px;"><a href="${settingsUrl}" style="color: #2563eb;">Открыть настройки</a></p>
    </div>
  `,
    attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
  });

  if (isConsoleEmailMode()) {
    console.log(
      `[feedback] notify sent to ${to}, ticket ${args.ticketId}, attachments ${emailAttachments.length}/${attachmentRows.length}`,
    );
  }
}
