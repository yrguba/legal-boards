import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, authorize, requireStaffUser } from '../middleware/auth';
import { ensureChannelForNewGroup } from '../utils/workspaceChatChannels';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);
router.use(requireStaffUser);

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
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!leaderId) return { ok: true };
  const leader = await prisma.user.findUnique({
    where: { id: leaderId },
    select: { id: true, departmentId: true, name: true },
  });
  if (!leader) return { ok: false, error: 'Руководитель не найден' };
  if (leader.departmentId !== departmentId) {
    return { ok: false, error: `«${leader.name}» не относится к отделу этого направления` };
  }
  return { ok: true };
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

router.post('/', authorize('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    const { name, description, workspaceId, departmentId, memberIds, leaderId } = req.body;

    if (!departmentId) {
      return res.status(400).json({ error: 'departmentId обязателен (группа внутри отдела)' });
    }

    const deptGate = await assertGroupDepartment(workspaceId, departmentId);
    if (!deptGate.ok) return res.status(400).json({ error: deptGate.error });

    const leaderGate = await assertGroupLeader(leaderId || null, departmentId);
    if (!leaderGate.ok) return res.status(400).json({ error: leaderGate.error });

    const group = await prisma.group.create({
      data: {
        name,
        description,
        workspaceId,
        departmentId,
        leaderId: leaderId || null,
        users: memberIds
          ? {
              create: memberIds.map((userId: string) => ({ userId })),
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

router.put('/:id', authorize('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
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
      const deptForLeader = departmentId || existing.departmentId;
      const leaderGate = await assertGroupLeader(leaderId || null, deptForLeader);
      if (!leaderGate.ok) return res.status(400).json({ error: leaderGate.error });
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

router.delete('/:id', authorize('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    await prisma.group.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Группа удалена' });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: 'Ошибка удаления группы' });
  }
});

router.post('/:id/members', authorize('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    const { userIds } = req.body;
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      select: { departmentId: true },
    });
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });

    if (userIds?.length) {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, departmentId: true, name: true },
      });
      for (const u of users) {
        if (u.departmentId !== group.departmentId) {
          return res.status(400).json({
            error: `Сотрудник «${u.name}» не в отделе этой группы`,
          });
        }
      }
    }

    await prisma.userGroup.deleteMany({
      where: { groupId: req.params.id },
    });

    if (userIds && userIds.length > 0) {
      await prisma.userGroup.createMany({
        data: userIds.map((userId: string) => ({
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
