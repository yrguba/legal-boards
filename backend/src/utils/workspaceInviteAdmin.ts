import type { Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth';
import { createAndBroadcastNotification } from './notifications';
import {
  assertCanManageWorkspace,
  isAlreadyWorkspaceMember,
  normalizeEmail,
} from './workspaceRole';
import {
  buildWorkspaceInviteUrl,
  createWorkspaceInviteToken,
  expireStaleWorkspaceInvites,
  maybeSendWorkspaceInviteEmail,
  parseGroupIds,
  validateInviteWorkspacePayload,
  WORKSPACE_INVITE_TTL_MS,
} from './workspaceInviteEmail';

export async function handleWorkspaceMemberLookup(
  req: AuthRequest,
  res: Response,
  prisma: PrismaClient,
  workspaceId: string,
) {
  const emailRaw = typeof req.query.email === 'string' ? req.query.email : '';
  const email = normalizeEmail(emailRaw);
  if (!email) return res.status(400).json({ error: 'email обязателен' });

  const manage = await assertCanManageWorkspace(prisma, req.userId!, workspaceId);
  if (!manage.ok) return res.status(403).json({ error: 'Недостаточно прав' });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    return res.json({ exists: false });
  }

  const alreadyMember = await isAlreadyWorkspaceMember(prisma, user.id, workspaceId);
  await expireStaleWorkspaceInvites(prisma);
  const pendingInvite = await prisma.workspaceInvite.findFirst({
    where: { workspaceId, userId: user.id, status: 'pending', expiresAt: { gt: new Date() } },
    select: { id: true },
  });

  return res.json({
    exists: true,
    userId: user.id,
    name: user.name,
    email: user.email,
    alreadyMember,
    pendingInviteId: pendingInvite?.id ?? null,
  });
}

export async function handleListWorkspaceInvites(
  req: AuthRequest,
  res: Response,
  prisma: PrismaClient,
  workspaceId: string,
) {
  const manage = await assertCanManageWorkspace(prisma, req.userId!, workspaceId);
  if (!manage.ok) return res.status(403).json({ error: 'Недостаточно прав' });

  await expireStaleWorkspaceInvites(prisma);
  const status = typeof req.query.status === 'string' ? req.query.status : 'pending';

  const invites = await prisma.workspaceInvite.findMany({
    where: { workspaceId, ...(status ? { status } : {}) },
    include: {
      user: { select: { id: true, name: true, email: true } },
      invitedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(
    invites.map((inv) => ({
      id: inv.id,
      workspaceId: inv.workspaceId,
      userId: inv.userId,
      role: inv.role,
      departmentId: inv.departmentId,
      groupIds: parseGroupIds(inv.groupIds),
      status: inv.status,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      user: inv.user,
      invitedBy: inv.invitedBy,
    })),
  );
}

export async function handleCreateWorkspaceInvite(
  req: AuthRequest,
  res: Response,
  prisma: PrismaClient,
  workspaceId: string,
) {
  const { email: emailRaw, role = 'member', departmentId, groupIds: rawGroupIds } = req.body ?? {};
  const email = typeof emailRaw === 'string' ? normalizeEmail(emailRaw) : '';
  const groupIds = parseGroupIds(rawGroupIds);

  if (!email) return res.status(400).json({ error: 'email обязателен' });

  const manage = await assertCanManageWorkspace(prisma, req.userId!, workspaceId);
  if (!manage.ok) return res.status(403).json({ error: 'Недостаточно прав' });

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, ownerId: true },
  });
  if (!workspace) return res.status(404).json({ error: 'Рабочее пространство не найдено' });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден', code: 'USER_NOT_FOUND' });
  }

  if (await isAlreadyWorkspaceMember(prisma, user.id, workspaceId)) {
    return res.status(409).json({ error: 'Пользователь уже в этом пространстве', code: 'ALREADY_MEMBER' });
  }

  const payloadGate = await validateInviteWorkspacePayload(
    prisma,
    workspaceId,
    departmentId || null,
    groupIds,
  );
  if (!payloadGate.ok) return res.status(400).json({ error: payloadGate.error });

  await expireStaleWorkspaceInvites(prisma);

  const inviter = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { name: true },
  });

  const token = createWorkspaceInviteToken();
  const expiresAt = new Date(Date.now() + WORKSPACE_INVITE_TTL_MS);
  const inviteUrl = buildWorkspaceInviteUrl(token);

  const existingPending = await prisma.workspaceInvite.findFirst({
    where: { workspaceId, userId: user.id, status: 'pending', expiresAt: { gt: new Date() } },
  });

  const invite = existingPending
    ? await prisma.workspaceInvite.update({
        where: { id: existingPending.id },
        data: {
          invitedById: req.userId!,
          role,
          departmentId: departmentId || null,
          groupIds,
          token,
          expiresAt,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      })
    : await prisma.workspaceInvite.create({
        data: {
          workspaceId,
          userId: user.id,
          invitedById: req.userId!,
          role,
          departmentId: departmentId || null,
          groupIds,
          token,
          expiresAt,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

  await createAndBroadcastNotification(prisma, {
    type: 'workspace_invite',
    title: 'Приглашение в пространство',
    message: `Вас пригласили в «${workspace.name}»`,
    userId: user.id,
    relatedId: invite.id,
  });

  const emailSent = await maybeSendWorkspaceInviteEmail({
    to: user.email,
    inviteeName: user.name,
    workspaceName: workspace.name,
    inviterName: inviter?.name ?? 'Администратор',
    inviteUrl,
  });

  return res.status(existingPending ? 200 : 201).json({
    id: invite.id,
    status: invite.status,
    emailSent,
    user: invite.user,
  });
}

export async function handleCancelWorkspaceInvite(
  req: AuthRequest,
  res: Response,
  prisma: PrismaClient,
  workspaceId: string,
  inviteId: string,
) {
  const manage = await assertCanManageWorkspace(prisma, req.userId!, workspaceId);
  if (!manage.ok) return res.status(403).json({ error: 'Недостаточно прав' });

  const invite = await prisma.workspaceInvite.findFirst({
    where: { id: inviteId, workspaceId },
  });
  if (!invite) return res.status(404).json({ error: 'Приглашение не найдено' });
  if (invite.status !== 'pending') {
    return res.status(400).json({ error: 'Можно отменить только ожидающее приглашение' });
  }

  await prisma.workspaceInvite.update({
    where: { id: inviteId },
    data: { status: 'cancelled', respondedAt: new Date() },
  });

  return res.json({ message: 'Приглашение отменено' });
}
