import crypto from 'crypto';
import { getFrontendUrl } from './registration';

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export function createPasswordResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function buildPasswordResetUrl(token: string): string {
  return `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}

export function buildPasswordResetEmailHtml(name: string, resetUrl: string): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0f172a; margin: 0 0 16px;">Восстановление пароля</h2>
      <p style="color: #334155; line-height: 1.5;">Здравствуйте, ${name}!</p>
      <p style="color: #334155; line-height: 1.5;">
        Вы запросили сброс пароля в Legal Boards. Чтобы задать новый пароль, перейдите по ссылке:
      </p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          Задать новый пароль
        </a>
      </p>
      <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
        Ссылка действительна 1 час. Если вы не запрашивали сброс, проигнорируйте это письмо.
      </p>
      <p style="color: #94a3b8; font-size: 12px; word-break: break-all;">${resetUrl}</p>
    </div>
  `;
}
