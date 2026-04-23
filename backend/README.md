# Legal Boards Backend

Backend API для системы управления юридическими делами Legal Boards.

## Технологии

- Node.js + TypeScript
- Express.js
- Prisma ORM
- PostgreSQL
- JWT аутентификация
- WebSocket для real-time уведомлений
- Multer для загрузки файлов

## Установка

1. Установите зависимости:
```bash
pnpm install
```

2. Создайте файл `.env` на основе `.env.example`:
```bash
cp .env.example .env
```

3. Настройте переменные окружения в `.env`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/legalboards"
JWT_SECRET="your-secret-key"
PORT=3001
```

4. Создайте базу данных и выполните миграции:
```bash
pnpm prisma:migrate
```

5. Сгенерируйте Prisma Client:
```bash
pnpm prisma:generate
```

## Запуск

### Разработка
```bash
pnpm dev
```

### Production
```bash
pnpm build
pnpm start
```

## API Endpoints

### Аутентификация
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход
- `POST /api/auth/verify` - Проверка токена

### Рабочие пространства
- `GET /api/workspaces` - Список workspace
- `POST /api/workspaces` - Создание workspace
- `GET /api/workspaces/:id` - Получение workspace
- `PUT /api/workspaces/:id` - Обновление workspace
- `DELETE /api/workspaces/:id` - Удаление workspace

### Доски
- `GET /api/boards/workspace/:workspaceId` - Список досок
- `GET /api/boards/:id` - Получение доски
- `POST /api/boards` - Создание доски
- `PUT /api/boards/:id` - Обновление доски
- `DELETE /api/boards/:id` - Удаление доски

### Задачи
- `GET /api/tasks/board/:boardId` - Список задач
- `GET /api/tasks/:id` - Получение задачи
- `POST /api/tasks` - Создание задачи
- `PUT /api/tasks/:id` - Обновление задачи
- `POST /api/tasks/:id/comments` - Добавление комментария
- `POST /api/tasks/:id/chat` - Отправка сообщения в чат

## WebSocket

WebSocket сервер работает на том же порту. События:
- `notification` - Новое уведомление
- `chat_message` - Новое сообщение в чате
- `document_uploaded` - Загружен документ

## Структура проекта

```
backend/
├── prisma/
│   └── schema.prisma       # Схема базы данных
├── src/
│   ├── routes/            # API маршруты
│   ├── middleware/        # Middleware
│   └── index.ts           # Точка входа
├── .env.example
├── package.json
└── tsconfig.json
```