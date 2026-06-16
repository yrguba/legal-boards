import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { getFrontendUrl } from './registration';
import { buildPasswordInviteEmailHtml, isConsoleEmailMode, sendEmail } from './email';

export const PASSWORD_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** По умолчанию false: пароль в UI. true — письмо со ссылкой. */
export function isEmployeeInviteEmailEnabled(): boolean {
  const raw = process.env.EMPLOYEE_INVITE_EMAIL?.trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function createPasswordInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function buildPasswordInviteUrl(token: string): string {
  return `${getFrontendUrl()}/invite?token=${encodeURIComponent(token)}`;
}

export async function assignPasswordInviteToken(
  db: PrismaClient,
  userId: string,
): Promise<string> {
  const token = createPasswordInviteToken();
  const expiresAt = new Date(Date.now() + PASSWORD_INVITE_TTL_MS);
  await db.user.update({
    where: { id: userId },
    data: {
      passwordInviteToken: token,
      passwordInviteExpiresAt: expiresAt,
    },
  });
  return token;
}

export async function sendPasswordInviteEmail(opts: {
  to: string;
  name: string;
  workspaceName?: string;
  inviteUrl: string;
  kind: 'welcome' | 'reset';
}): Promise<void> {
  const subject =
    opts.kind === 'reset'
      ? 'Сброс пароля — Legal Boards'
      : 'Приглашение в Legal Boards';

  await sendEmail({
    to: opts.to,
    subject,
    html: buildPasswordInviteEmailHtml(opts),
  });

  if (isConsoleEmailMode()) {
    console.log(`[password-invite] ${opts.kind} link for ${opts.to}:`, opts.inviteUrl);
  }
}
