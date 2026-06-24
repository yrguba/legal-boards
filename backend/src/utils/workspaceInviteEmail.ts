import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { getFrontendUrl } from './registration';
import { isConsoleEmailMode, isEmailConfigured, sendEmail } from './email';
import { parseEnvFlag } from './envFlags';

export const WORKSPACE_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function isWorkspaceInviteEmailEnabled(): boolean {
  return parseEnvFlag('WORKSPACE_INVITE_EMAIL', false);
}

export function createWorkspaceInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function buildWorkspaceInviteUrl(token: string): string {
  return `${getFrontendUrl()}/workspace-invite?token=${encodeURIComponent(token)}`;
}

export function buildWorkspaceInviteEmailHtml(args: {
  inviteeName: string;
  workspaceName: string;
  inviterName: string;
  inviteUrl: string;
}): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0f172a; margin: 0 0 16px;">Приглашение в пространство</h2>
      <p style="color: #334155; line-height: 1.5;">
        Здравствуйте, ${args.inviteeName}!
      </p>
      <p style="color: #334155; line-height: 1.5;">
        ${args.inviterName} приглашает вас в рабочее пространство <strong>${args.workspaceName}</strong>.
      </p>
      <p style="margin: 24px 0;">
        <a href="${args.inviteUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          Принять приглашение
        </a>
      </p>
      <p style="color: #94a3b8; font-size: 12px; word-break: break-all;">${args.inviteUrl}</p>
    </div>
  `;
}

export async function maybeSendWorkspaceInviteEmail(opts: {
  to: string;
  inviteeName: string;
  workspaceName: string;
  inviterName: string;
  inviteUrl: string;
}): Promise<boolean> {
  if (!isWorkspaceInviteEmailEnabled()) return false;
  if (!isEmailConfigured()) {
    console.warn('[workspace-invite] Email skipped: RESEND not configured');
    return false;
  }

  try {
    await sendEmail({
      to: opts.to,
      subject: `Приглашение в «${opts.workspaceName}» — Legal Boards`,
      html: buildWorkspaceInviteEmailHtml(opts),
    });
    if (isConsoleEmailMode()) {
      console.log(`[workspace-invite] Email sent to ${opts.to}:`, opts.inviteUrl);
    }
    return true;
  } catch (e) {
    console.error(`[workspace-invite] Email failed for ${opts.to}:`, e);
    return false;
  }
}

export async function validateInviteWorkspacePayload(
  prisma: PrismaClient,
  workspaceId: string,
  departmentId: string | null | undefined,
  groupIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (departmentId) {
    const dept = await prisma.department.findFirst({
      where: { id: departmentId, workspaceId },
      select: { id: true },
    });
    if (!dept) return { ok: false, error: 'Отдел не принадлежит этому пространству' };
  }

  if (groupIds.length > 0) {
    const inWs = await prisma.group.findMany({
      where: { workspaceId, id: { in: groupIds } },
      select: { id: true, departmentId: true },
    });
    if (inWs.length !== groupIds.length) {
      return { ok: false, error: 'Одна или несколько групп не принадлежат этому пространству' };
    }
    if (departmentId) {
      const bad = inWs.some((g) => g.departmentId !== departmentId);
      if (bad) return { ok: false, error: 'Группы должны относиться к выбранному отделу' };
    }
  }

  return { ok: true };
}

export function parseGroupIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id): id is string => typeof id === 'string' && id.length > 0))];
}

export async function expireStaleWorkspaceInvites(prisma: PrismaClient): Promise<void> {
  await prisma.workspaceInvite.updateMany({
    where: { status: 'pending', expiresAt: { lt: new Date() } },
    data: { status: 'expired' },
  });
}
