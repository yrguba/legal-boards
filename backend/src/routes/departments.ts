import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, requireStaffUser } from '../middleware/auth';
import { ensureChannelForNewDepartment } from '../utils/workspaceChatChannels';
import { assertCanManageWorkspace } from '../utils/workspaceRole';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);
router.use(requireStaffUser);

async function assertCanManageDepartment(
  userId: string,
  departmentId: string,
): Promise<{ ok: true; workspaceId: string } | { ok: false; status: number; error: string }> {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { workspaceId: true },
  });
  if (!department) {
    return { ok: false, status: 404, error: 'Отдел не найден' };
  }
  const manage = await assertCanManageWorkspace(prisma, userId, department.workspaceId);
  if (!manage.ok) {
    return { ok: false, status: 403, error: 'Недостаточно прав' };
  }
  return { ok: true, workspaceId: department.workspaceId };
}

router.get('/workspace/:workspaceId', async (req: AuthRequest, res) => {
  try {
    const departments = await prisma.department.findMany({
      where: { workspaceId: req.params.workspaceId },
      include: {
        _count: {
          select: { workspaceMembers: true },
        },
      },
    });

    res.json(
      departments.map((d) => ({
        ...d,
        _count: { users: d._count.workspaceMembers },
      })),
    );
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ error: 'Ошибка получения отделов' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const department = await prisma.department.findUnique({
      where: { id: req.params.id },
      include: {
        workspaceMembers: {
          select: {
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

    if (!department) {
      return res.status(404).json({ error: 'Отдел не найден' });
    }

    res.json({
      ...department,
      users: department.workspaceMembers.map((m) => m.user),
    });
  } catch (error) {
    console.error('Get department error:', error);
    res.status(500).json({ error: 'Ошибка получения отдела' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, description, workspaceId } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Название отдела обязательно' });
    }

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId обязателен' });
    }

    const manage = await assertCanManageWorkspace(prisma, req.userId!, workspaceId);
    if (!manage.ok) return res.status(403).json({ error: 'Недостаточно прав' });

    const department = await prisma.department.create({
      data: {
        name: name.trim(),
        description: typeof description === 'string' ? description.trim() || null : null,
        workspaceId,
      },
    });

    await ensureChannelForNewDepartment(prisma, workspaceId, department.id, department.name);

    res.json(department);
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ error: 'Ошибка создания отдела' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const gate = await assertCanManageDepartment(req.userId!, req.params.id);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

    const { name, description } = req.body;

    const department = await prisma.department.update({
      where: { id: req.params.id },
      data: { name, description },
    });

    await ensureChannelForNewDepartment(
      prisma,
      department.workspaceId,
      department.id,
      department.name,
    );

    res.json(department);
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ error: 'Ошибка обновления отдела' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const gate = await assertCanManageDepartment(req.userId!, req.params.id);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

    const groupCount = await prisma.group.count({ where: { departmentId: req.params.id } });

    await prisma.$transaction(async (tx) => {
      if (groupCount > 0) {
        await tx.userGroup.deleteMany({ where: { group: { departmentId: req.params.id } } });
        await tx.group.deleteMany({ where: { departmentId: req.params.id } });
      }
      await tx.workspaceUser.updateMany({
        where: { departmentId: req.params.id },
        data: { departmentId: null },
      });
      await tx.department.delete({ where: { id: req.params.id } });
    });

    res.json({
      message: 'Отдел удален',
      deletedGroups: groupCount,
    });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ error: 'Ошибка удаления отдела' });
  }
});

router.post('/:id/members', async (req: AuthRequest, res) => {
  try {
    const gate = await assertCanManageDepartment(req.userId!, req.params.id);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

    const { userIds: rawUserIds } = req.body;
    const departmentId = req.params.id;
    const workspaceId = gate.workspaceId;
    const userIds: string[] = Array.isArray(rawUserIds)
      ? rawUserIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });
    if (!workspace) {
      return res.status(404).json({ error: 'Пространство не найдено' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.workspaceUser.updateMany({
        where: { workspaceId, departmentId },
        data: { departmentId: null },
      });

      if (userIds.length === 0) return;

      const memberships = await tx.workspaceUser.findMany({
        where: { workspaceId, userId: { in: userIds } },
        select: { userId: true },
      });
      const memberSet = new Set(memberships.map((m) => m.userId));

      await tx.workspaceUser.updateMany({
        where: { workspaceId, userId: { in: userIds } },
        data: { departmentId },
      });

      if (userIds.includes(workspace.ownerId) && !memberSet.has(workspace.ownerId)) {
        await tx.workspaceUser.create({
          data: {
            workspaceId,
            userId: workspace.ownerId,
            role: 'admin',
            departmentId,
          },
        });
      }
    });

    res.json({ message: 'Участники отдела обновлены' });
  } catch (error) {
    console.error('Update department members error:', error);
    res.status(500).json({ error: 'Ошибка обновления участников отдела' });
  }
});

export default router;
