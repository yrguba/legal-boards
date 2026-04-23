# Legal Boards - Backend

Express.js REST API с PostgreSQL и Prisma ORM для управления юридическими делами.

## Установка

1. Установите зависимости:
```bash
cd server
pnpm install
```

2. Создайте файл `.env` на основе `.env.example`:
```bash
cp .env.example .env
```

3. Обновите `DATABASE_URL` в `.env` с вашими данными PostgreSQL:
```
DATABASE_URL="postgresql://user:password@localhost:5432/legal_boards"
```

4. Сгенерируйте Prisma Client и примените миграции:
```bash
pnpm db:push
```

5. (Опционально) Заполните базу тестовыми данными:
```bash
pnpm db:seed
```

## Запуск

Режим разработки с автоперезагрузкой:
```bash
pnpm dev
```

Сборка для продакшена:
```bash
pnpm build
pnpm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Регистрация нового пользователя
- `POST /api/auth/login` - Вход в систему
- `POST /api/auth/verify` - Проверка токена

### Users
- `GET /api/users` - Получить всех пользователей
- `GET /api/users/:id` - Получить пользователя по ID
- `PUT /api/users/:id` - Обновить пользователя
- `DELETE /api/users/:id` - Удалить пользователя

### Workspaces
- `GET /api/workspaces` - Получить рабочие пространства пользователя
- `GET /api/workspaces/:id` - Получить рабочее пространство по ID
- `POST /api/workspaces` - Создать рабочее пространство
- `PUT /api/workspaces/:id` - Обновить рабочее пространство
- `DELETE /api/workspaces/:id` - Удалить рабочее пространство
- `POST /api/workspaces/:workspaceId/users` - Добавить пользователя в пространство

### Departments
- `GET /api/departments/workspace/:workspaceId` - Получить отделы пространства
- `GET /api/departments/:id` - Получить отдел по ID
- `POST /api/departments` - Создать отдел
- `PUT /api/departments/:id` - Обновить отдел
- `DELETE /api/departments/:id` - Удалить отдел
- `POST /api/departments/:departmentId/members` - Обновить участников отдела

### Groups
- `GET /api/groups/workspace/:workspaceId` - Получить группы пространства
- `GET /api/groups/:id` - Получить группу по ID
- `POST /api/groups` - Создать группу
- `PUT /api/groups/:id` - Обновить группу
- `DELETE /api/groups/:id` - Удалить группу
- `POST /api/groups/:groupId/members` - Обновить участников группы

### Boards
- `GET /api/boards/workspace/:workspaceId` - Получить доски пространства
- `GET /api/boards/:id` - Получить доску по ID
- `POST /api/boards` - Создать доску
- `PUT /api/boards/:id` - Обновить доску
- `DELETE /api/boards/:id` - Удалить доску

### Tasks
- `GET /api/tasks/board/:boardId` - Получить задачи доски
- `GET /api/tasks/:id` - Получить задачу по ID
- `POST /api/tasks` - Создать задачу
- `PUT /api/tasks/:id` - Обновить задачу
- `DELETE /api/tasks/:id` - Удалить задачу
- `POST /api/tasks/:taskId/comments` - Добавить комментарий
- `POST /api/tasks/:taskId/chat` - Добавить сообщение в чат

### Documents
- `GET /api/documents/workspace/:workspaceId` - Получить документы пространства
- `POST /api/documents/upload` - Загрузить документ
- `DELETE /api/documents/:id` - Удалить документ

### Notifications
- `GET /api/notifications` - Получить уведомления пользователя
- `GET /api/notifications/unread` - Получить количество непрочитанных
- `PUT /api/notifications/:id/read` - Отметить как прочитанное
- `PUT /api/notifications/read-all` - Отметить все как прочитанные
- `DELETE /api/notifications/:id` - Удалить уведомление

## Тестовые данные

После выполнения `pnpm db:seed` будут созданы:

- Администратор: `admin@example.com` / `password123`
- Пользователь: `user@example.com` / `password123`
- Рабочее пространство "Юридическая фирма"
- Отдел "Юридический отдел"
- Группа "Корпоративные дела"

## Структура базы данных

Основные модели:
- **User** - Пользователи системы
- **Workspace** - Рабочие пространства
- **Department** - Отделы организации
- **Group** - Группы пользователей
- **Board** - Доски с задачами
- **Task** - Задачи (дела)
- **Document** - Документы с настройками видимости
- **Notification** - Уведомления пользователей

## Разработка

Просмотр базы данных через Prisma Studio:
```bash
pnpm db:studio
```

Создание новой миграции:
```bash
pnpm db:migrate
```
