import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get('/workspace/:workspaceId', async (req: AuthRequest, res) => {
  try {
    const departments = await prisma.department.findMany({
      where: { workspaceId: req.params.workspaceId },
    });
    res.json(departments);
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ error: 'Ошибка получения отделов' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const department = await prisma.department.findUnique({
      where: { id: req.params.id },
    });

    if (!department) {
      return res.status(404).json({ error: 'Отдел не найден' });
    }

    res.json(department);
  } catch (error) {
    console.error('Get department error:', error);
    res.status(500).json({ error: 'Ошибка получения отдела' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, description, workspaceId } = req.body;

    const department = await prisma.department.create({
      data: {
        name,
        description,
        workspaceId,
      },
    });

    res.json(department);
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ error: 'Ошибка создания отдела' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;

    const department = await prisma.department.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
    });

    res.json(department);
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ error: 'Ошибка обновления отдела' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.department.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Отдел удален' });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ error: 'Ошибка удаления отдела' });
  }
});

router.post('/:departmentId/members', async (req: AuthRequest, res) => {
  try {
    const { userIds } = req.body;

    await prisma.user.updateMany({
      where: { departmentId: req.params.departmentId },
      data: { departmentId: null },
    });

    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { departmentId: req.params.departmentId },
    });

    res.json({ message: 'Участники отдела обновлены' });
  } catch (error) {
    console.error('Update department members error:', error);
    res.status(500).json({ error: 'Ошибка обновления участников отдела' });
  }
});

export default router;
