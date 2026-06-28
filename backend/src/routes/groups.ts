import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, requireStaffUser } from '../middleware/auth';
import { ensureChannelForNewGroup } from '../utils/workspaceChatChannels';
import { assertCanManageWorkspace, getWorkspaceMemberProfile, isWorkspaceMember } from '../utils/workspaceRole';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);
router.use(requireStaffUser);

async function assertCanManageGroup(
  userId: string,
  groupId: string,
): Promise<{ ok: true; workspaceId: string } | { ok: false; status: number; error: string }> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { workspaceId: true },
  });
  if (!group) {
    return { ok: false, status: 404, error: 'Группа не найдена' };
  }
  const manage = await assertCanManageWorkspace(prisma, userId, group.workspaceId);
  if (!manage.ok) {
    return { ok: false, status: 403, error: 'Недостаточно прав' };
  }
  return { ok: true, workspaceId: group.workspaceId };
}

async function assertGroupDepartment(
  workspaceId: string,
  departmentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const dept = await prisma.department.findFirst({
    where: { id: departmentId, workspaceId },
    select: { id: true },
  });
  if (!dept) return { ok: false, error: 'Отдел не найден в этом пространстве' };
  return { ok: true };
}

/** Руководитель направления должен относиться к тому же отделу. */
async function assertGroupLeader(
  leaderId: string | null | undefined,
  departmentId: string,
  workspaceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!leaderId) return { ok: true };

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });
  if (!workspace) return { ok: false, error: 'Пространство не найдено' };

  const leader = await prisma.user.findUnique({
    where: { id: leaderId },
    select: { id: true, name: true },
  });
  if (!leader) return { ok: false, error: 'Руководитель не найден' };

  const profile = await getWorkspaceMemberProfile(
    prisma,
    leaderId,
    workspaceId,
    workspace.ownerId,
  );
  if (profile?.departmentId !== departmentId) {
    return { ok: false, error: `«${leader.name}» не относится к отделу этого направления` };
  }
  return { ok: true };
}

async function assertUsersInDepartment(
  workspaceId: string,
  departmentId: string,
  userIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (userIds.length === 0) return { ok: true };

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });
  if (!workspace) return { ok: false, error: 'Пространство не найдено' };

  for (const userId of userIds) {
    const profile = await getWorkspaceMemberProfile(
      prisma,
      userId,
      workspaceId,
      workspace.ownerId,
    );
    if (profile?.departmentId !== departmentId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      return {
        ok: false,
        error: `Сотрудник «${user?.name ?? userId}» не в отделе этой группы`,
      };
    }
  }
  return { ok: true };
}

async function assertUsersInWorkspace(
  workspaceId: string,
  userIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (userIds.length === 0) return { ok: true };

  for (const userId of userIds) {
    const ok = await isWorkspaceMember(prisma, userId, workspaceId);
    if (!ok) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      return {
        ok: false,
        error: `Сотрудник «${user?.name ?? userId}» не состоит в этом пространстве`,
      };
    }
  }
  return { ok: true };
}

async function assertLeaderInWorkspace(
  leaderId: string | null | undefined,
  workspaceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!leaderId) return { ok: true };
  const ok = await isWorkspaceMember(prisma, leaderId, workspaceId);
  if (ok) return { ok: true };
  return { ok: false, error: 'Руководитель не найден в этом пространстве' };
}

function parseDepartmentId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

router.get('/workspace/:workspaceId', async (req: AuthRequest, res) => {
  try {
    const groups = await prisma.group.findMany({
      where: { workspaceId: req.params.workspaceId },
      include: {
        users: { select: { userId: true } },
        department: { select: { id: true, name: true } },
        leader: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: [{ departmentId: 'asc' }, { name: 'asc' }],
    });

    res.json(
      groups.map((g) => ({
        ...g,
        memberIds: g.users.map((u) => u.userId),
      })),
    );
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Ошибка получения групп' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: {
        department: { select: { id: true, name: true } },
        leader: { select: { id: true, name: true, email: true, avatar: true } },
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ error: 'Группа не найдена' });
    }

    res.json({
      ...group,
      memberIds: group.users.map((u) => u.userId),
      members: group.users.map((u) => u.user),
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Ошибка получения группы' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, description, workspaceId, departmentId, memberIds, leaderId } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId обязателен' });
    }

    const manage = await assertCanManageWorkspace(prisma, req.userId!, workspaceId);
    if (!manage.ok) return res.status(403).json({ error: 'Недостаточно прав' });

    const deptId = parseDepartmentId(departmentId);
    const memberIdsList: string[] = Array.isArray(memberIds) ? memberIds : [];

    if (deptId) {
      const deptGate = await assertGroupDepartment(workspaceId, deptId);
      if (!deptGate.ok) return res.status(400).json({ error: deptGate.error });

      const leaderGate = await assertGroupLeader(leaderId || null, deptId, workspaceId);
      if (!leaderGate.ok) return res.status(400).json({ error: leaderGate.error });

      const membersGate = await assertUsersInDepartment(workspaceId, deptId, memberIdsList);
      if (!membersGate.ok) return res.status(400).json({ error: membersGate.error });
    } else {
      const leaderGate = await assertLeaderInWorkspace(leaderId || null, workspaceId);
      if (!leaderGate.ok) return res.status(400).json({ error: leaderGate.error });

      const membersGate = await assertUsersInWorkspace(workspaceId, memberIdsList);
      if (!membersGate.ok) return res.status(400).json({ error: membersGate.error });
    }

    const group = await prisma.group.create({
      data: {
        name,
        description,
        workspaceId,
        departmentId: deptId,
        leaderId: leaderId || null,
        users: memberIdsList.length
          ? {
              create: memberIdsList.map((userId: string) => ({ userId })),
            }
          : undefined,
      },
      include: {
        department: { select: { id: true, name: true } },
        leader: { select: { id: true, name: true, email: true, avatar: true } },
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    await ensureChannelForNewGroup(prisma, workspaceId, group.id, group.name);

    res.json({ ...group, memberIds: group.users.map((u) => u.userId) });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Ошибка создания группы' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const gate = await assertCanManageGroup(req.userId!, req.params.id);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

    const { name, description, departmentId, leaderId } = req.body;
    const existing = await prisma.group.findUnique({
      where: { id: req.params.id },
      select: { workspaceId: true, departmentId: true },
    });
    if (!existing) return res.status(404).json({ error: 'Группа не найдена' });

    if (departmentId) {
      const deptGate = await assertGroupDepartment(existing.workspaceId, departmentId);
      if (!deptGate.ok) return res.status(400).json({ error: deptGate.error });
    }

    if (leaderId !== undefined) {
      if (existing.departmentId) {
        const deptForLeader = departmentId || existing.departmentId;
        const leaderGate = await assertGroupLeader(leaderId || null, deptForLeader!, existing.workspaceId);
        if (!leaderGate.ok) return res.status(400).json({ error: leaderGate.error });
      } else {
        const leaderGate = await assertLeaderInWorkspace(leaderId || null, existing.workspaceId);
        if (!leaderGate.ok) return res.status(400).json({ error: leaderGate.error });
      }
    }

    const group = await prisma.group.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(departmentId !== undefined ? { departmentId } : {}),
        ...(leaderId !== undefined ? { leaderId: leaderId || null } : {}),
      },
      include: {
        department: { select: { id: true, name: true } },
        leader: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    await ensureChannelForNewGroup(prisma, group.workspaceId, group.id, group.name);

    res.json(group);
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ error: 'Ошибка обновления группы' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const gate = await assertCanManageGroup(req.userId!, req.params.id);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

    await prisma.group.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Группа удалена' });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: 'Ошибка удаления группы' });
  }
});

router.post('/:id/members', async (req: AuthRequest, res) => {
  try {
    const gate = await assertCanManageGroup(req.userId!, req.params.id);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

    const { userIds } = req.body;
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      select: { departmentId: true, workspaceId: true },
    });
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });

    const userIdsList: string[] = Array.isArray(userIds)
      ? userIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];
    const membersGate = group.departmentId
      ? await assertUsersInDepartment(group.workspaceId, group.departmentId, userIdsList)
      : await assertUsersInWorkspace(group.workspaceId, userIdsList);
    if (!membersGate.ok) return res.status(400).json({ error: membersGate.error });

    await prisma.userGroup.deleteMany({
      where: { groupId: req.params.id },
    });

    if (userIdsList.length > 0) {
      await prisma.userGroup.createMany({
        data: userIdsList.map((userId: string) => ({
          groupId: req.params.id,
          userId,
        })),
      });
    }

    res.json({ message: 'Участники группы обновлены' });
  } catch (error) {
    console.error('Update group members error:', error);
    res.status(500).json({ error: 'Ошибка обновления участников группы' });
  }
});

export default router;
