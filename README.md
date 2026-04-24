# Legal Boards

Полнофункциональная система управления юридическими делами с Kanban-досками, управлением задачами, документами и сотрудниками.

## Возможности

- 🔐 Аутентификация с ролевым доступом (admin, manager, member, guest)
- 🏢 Управление рабочими пространствами
- 👥 Управление сотрудниками, отделами и группами
- 📋 Kanban и List доски с настраиваемыми колонками
- ✅ Задачи с кастомными полями (7 типов)
- 💬 Чаты клиента и ассистента для каждой задачи
- 📄 Хранилище документов с настройкой видимости
- 🔔 Система уведомлений в реальном времени
- 🌐 WebSocket для real-time обновлений

## Технологии

### Frontend
- React 18 + TypeScript
- React Router (data mode)
- Tailwind CSS v4
- Lucide React (иконки)
- Vite

### Backend
- Node.js + TypeScript
- Express.js
- Prisma ORM
- PostgreSQL
- JWT аутентификация
- WebSocket (ws)
- Multer (загрузка файлов)

## Установка и запуск

### Требования
- Node.js 18+
- PostgreSQL 14+
- pnpm (рекомендуется)

### Backend

```bash
cd backend
pnpm install
cp .env.example .env
# Настройте DATABASE_URL в .env
pnpm prisma:migrate
pnpm dev
```

Backend будет доступен на `http://localhost:5004`

### Frontend

```bash
pnpm install
pnpm dev
```

Frontend будет доступен на `http://localhost:5173`

## Статус проекта

⚠️ **Проект находится в стадии загрузки кода**

Полный код скоро будет доступен в этом репозитории.

## Лицензия

MIT
