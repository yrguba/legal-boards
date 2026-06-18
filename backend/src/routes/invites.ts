import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, requireStaffUser } from '../middleware/auth';
import { createAndBroadcastNotification } from '../utils/notifications';
import {
  expireStaleWorkspaceInvites,
  parseGroupIds,
} from '../utils/workspaceInviteEmail';
import {
  isAlreadyWorkspaceMember,
} from '../utils/workspaceRole';
import { assertUserGroupsMatchDepartment } from '../utils/employeeProfile';
import {
  handleCancelWorkspaceInvite,
  handleCreateWorkspaceInvite,
  handleListWorkspaceInvites,
} from '../utils/workspaceInviteAdmin';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);
router.use(requireStaffUser);

function mapInvite(invite: {
  id: string;
  workspaceId: string;
  userId: string;
  invitedById: string;
  role: string;
  departmentId: string | null;
  groupIds: unknown;
  status: string;
  expiresAt: Date;
  respondedAt: Date | null;
  createdAt: Date;
  workspace?: { id: string; name: string };
  invitedBy?: { id: string; name: string; email: string };
}) {
  return {
    id: invite.id,
    workspaceId: invite.workspaceId,
    userId: invite.userId,
    invitedById: invite.invitedById,
    role: invite.role,
    departmentId: invite.departmentId,
    groupIds: parseGroupIds(invite.groupIds),
    status: invite.status,
    expiresAt: invite.expiresAt,
    respondedAt: invite.respondedAt,
    createdAt: invite.createdAt,
    workspace: invite.workspace,
    invitedBy: invite.invitedBy,
  };
}

router.get('/mine', async (req: AuthRequest, res) => {
  try {
    await expireStaleWorkspaceInvites(prisma);
    const status = typeof req.query.status === 'string' ? req.query.status : 'pending';

    const invites = await prisma.workspaceInvite.findMany({
      where: {
        userId: req.userId!,
        ...(status ? { status } : {}),
      },
      include: {
        workspace: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(invites.map(mapInvite));
  } catch (error) {
    console.error('List my invites error:', error);
    res.status(500).json({ error: 'Ошибка загрузки приглашений' });
  }
});

router.get('/by-token', async (req: AuthRequest, res) => {
  try {
    await expireStaleWorkspaceInvites(prisma);
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    if (!token) return res.status(400).json({ error: 'token обязателен' });

    const invite = await prisma.workspaceInvite.findUnique({
      where: { token },
      include: {
        workspace: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!invite || invite.userId !== req.userId) {
      return res.status(404).json({ error: 'Приглашение не найдено', code: 'INVITE_NOT_FOUND' });
    }
    if (invite.status !== 'pending') {
      return res.status(400).json({ error: 'Приглашение уже обработано', code: 'INVITE_INACTIVE' });
    }
    if (invite.expiresAt < new Date()) {
      await prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: { status: 'expired' },
      });
      return res.status(410).json({ error: 'Срок приглашения истёк', code: 'INVITE_EXPIRED' });
    }

    res.json(mapInvite(invite));
  } catch (error) {
    console.error('Get invite by token error:', error);
    res.status(500).json({ error: 'Ошибка загрузки приглашения' });
  }
});

router.get('/workspace/:workspaceId', async (req: AuthRequest, res) => {
  try {
    await handleListWorkspaceInvites(req, res, prisma, req.params.workspaceId);
  } catch (error) {
    console.error('List workspace invites error:', error);
    res.status(500).json({ error: 'Ошибка загрузки приглашений' });
  }
});

router.post('/workspace/:workspaceId', async (req: AuthRequest, res) => {
  try {
    await handleCreateWorkspaceInvite(req, res, prisma, req.params.workspaceId);
  } catch (error) {
    console.error('Create workspace invite error:', error);
    res.status(500).json({ error: 'Ошибка отправки приглашения' });
  }
});

router.delete('/workspace/:workspaceId/:inviteId', async (req: AuthRequest, res) => {
  try {
    await handleCancelWorkspaceInvite(req, res, prisma, req.params.workspaceId, req.params.inviteId);
  } catch (error) {
    console.error('Cancel workspace invite error:', error);
    res.status(500).json({ error: 'Ошибка отмены приглашения' });
  }
});

router.post('/:id/accept', async (req: AuthRequest, res) => {
  try {
    await expireStaleWorkspaceInvites(prisma);
    const invite = await prisma.workspaceInvite.findUnique({
      where: { id: req.params.id },
      include: {
        workspace: { select: { id: true, name: true, ownerId: true } },
        user: { select: { id: true, email: true, name: true } },
        invitedBy: { select: { id: true, name: true } },
      },
    });

    if (!invite || invite.userId !== req.userId) {
      return res.status(404).json({ error: 'Приглашение не найдено' });
    }
    if (invite.status !== 'pending') {
      return res.status(400).json({ error: 'Приглашение уже обработано', code: 'INVITE_INACTIVE' });
    }
    if (invite.expiresAt < new Date()) {
      await prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: { status: 'expired' },
      });
      return res.status(410).json({ error: 'Срок приглашения истёк', code: 'INVITE_EXPIRED' });
    }

    if (await isAlreadyWorkspaceMember(prisma, invite.userId, invite.workspaceId)) {
      await prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: { status: 'accepted', respondedAt: new Date() },
      });
      return res.json({
        workspaceId: invite.workspaceId,
        workspaceName: invite.workspace.name,
        alreadyMember: true,
      });
    }

    const groupIds = parseGroupIds(invite.groupIds);
    const groupGate = await assertUserGroupsMatchDepartment(
      prisma,
      invite.userId,
      invite.departmentId,
      groupIds,
    );
    if (!groupGate.ok) return res.status(400).json({ error: groupGate.error });

    await prisma.$transaction(async (tx) => {
      await tx.workspaceUser.create({
        data: {
          workspaceId: invite.workspaceId,
          userId: invite.userId,
          role: invite.role,
          departmentId: invite.departmentId,
          profileFields: {},
        },
      });

      if (groupIds.length > 0) {
        await tx.userGroup.createMany({
          data: groupIds.map((groupId) => ({ userId: invite.userId, groupId })),
          skipDuplicates: true,
        });
      }

      await tx.workspaceInvite.update({
        where: { id: invite.id },
        data: { status: 'accepted', respondedAt: new Date() },
      });

      await tx.workspaceInvite.updateMany({
        where: {
          workspaceId: invite.workspaceId,
          userId: invite.userId,
          status: 'pending',
          id: { not: invite.id },
        },
        data: { status: 'cancelled', respondedAt: new Date() },
      });
    });

    await createAndBroadcastNotification(prisma, {
      type: 'workspace_invite_accepted',
      title: 'Приглашение принято',
      message: `${invite.user.name} принял(а) приглашение в «${invite.workspace.name}»`,
      userId: invite.invitedById,
      relatedId: invite.workspaceId,
    });

    res.json({
      workspaceId: invite.workspaceId,
      workspaceName: invite.workspace.name,
      alreadyMember: false,
    });
  } catch (error) {
    console.error('Accept workspace invite error:', error);
    res.status(500).json({ error: 'Ошибка принятия приглашения' });
  }
});

router.post('/:id/decline', async (req: AuthRequest, res) => {
  try {
    const invite = await prisma.workspaceInvite.findUnique({
      where: { id: req.params.id },
      include: {
        workspace: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
        invitedBy: { select: { id: true } },
      },
    });

    if (!invite || invite.userId !== req.userId) {
      return res.status(404).json({ error: 'Приглашение не найдено' });
    }
    if (invite.status !== 'pending') {
      return res.status(400).json({ error: 'Приглашение уже обработано' });
    }

    await prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { status: 'declined', respondedAt: new Date() },
    });

    await createAndBroadcastNotification(prisma, {
      type: 'workspace_invite_declined',
      title: 'Приглашение отклонено',
      message: `${invite.user.name} отклонил(а) приглашение в «${invite.workspace.name}»`,
      userId: invite.invitedById,
      relatedId: invite.workspaceId,
    });

    res.json({ message: 'Приглашение отклонено' });
  } catch (error) {
    console.error('Decline workspace invite error:', error);
    res.status(500).json({ error: 'Ошибка отклонения приглашения' });
  }
});

export default router;
