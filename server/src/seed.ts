import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  const user1 = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Администратор',
      role: 'admin',
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      password: hashedPassword,
      name: 'Иван Иванов',
      role: 'member',
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: 'Юридическая фирма',
      description: 'Основное рабочее пространство',
      members: {
        create: [
          { userId: user1.id, role: 'admin' },
          { userId: user2.id, role: 'member' },
        ],
      },
    },
  });

  const department = await prisma.department.create({
    data: {
      name: 'Юридический отдел',
      description: 'Основной юридический отдел',
      workspaceId: workspace.id,
    },
  });

  await prisma.user.update({
    where: { id: user2.id },
    data: { departmentId: department.id },
  });

  const group = await prisma.group.create({
    data: {
      name: 'Корпоративные дела',
      description: 'Группа для корпоративных дел',
      workspaceId: workspace.id,
      members: {
        create: [{ userId: user2.id }],
      },
    },
  });

  console.log('Seed completed successfully!');
  console.log('---');
  console.log('Admin user: admin@example.com / password123');
  console.log('Regular user: user@example.com / password123');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
