import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { getFrontendUrl } from './registration';
import { buildPasswordInviteEmailHtml, isConsoleEmailMode, sendEmail } from './email';

export const PASSWORD_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

/** Письмо с временным паролем (сброс / создание без invite-ссылки). */
export async function sendAdminTempPasswordEmail(opts: {
  to: string;
  name: string;
  tempPassword: string;
  kind: 'welcome' | 'reset';
}): Promise<void> {
  const subject =
    opts.kind === 'reset'
      ? 'Сброс пароля — Legal Boards'
      : 'Приглашение в Legal Boards';
  const loginUrl = `${getFrontendUrl()}/login`;

  await sendEmail({
    to: opts.to,
    subject,
    html: `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0f172a; margin: 0 0 16px;">${subject}</h2>
      <p style="color: #334155; line-height: 1.5;">Здравствуйте, ${opts.name}!</p>
      <p style="color: #334155; line-height: 1.5;">
        Вам назначен временный пароль: <strong style="font-family: monospace;">${opts.tempPassword}</strong>
      </p>
      <p style="color: #334155; line-height: 1.5;">
        Войдите в систему и задайте новый пароль при первом входе.
      </p>
      <p style="margin: 24px 0;">
        <a href="${loginUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          Войти
        </a>
      </p>
    </div>
  `,
  });

  if (isConsoleEmailMode()) {
    console.log(`[temp-password] ${opts.kind} for ${opts.to}:`, opts.tempPassword);
  }
}
