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
DATABASE_URL="postgresql://user:password@localhost:5432/legalboards?schema=public"
JWT_SECRET="your-secret-key"
PORT=5004
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
- `POST /api/workspaces/:id/users` - Добавление пользователя в workspace

### Доски
- `GET /api/boards/workspace/:workspaceId` - Список досок workspace
- `GET /api/boards/:id` - Получение доски
- `POST /api/boards` - Создание доски
- `PUT /api/boards/:id` - Обновление доски
- `DELETE /api/boards/:id` - Удаление доски
- `POST /api/boards/:id/columns` - Создание колонки
- `PUT /api/boards/columns/:columnId` - Обновление колонки
- `DELETE /api/boards/columns/:columnId` - Удаление колонки

### Задачи
- `GET /api/tasks/board/:boardId` - Список задач доски
- `GET /api/tasks/:id` - Получение задачи
- `POST /api/tasks` - Создание задачи
- `PUT /api/tasks/:id` - Обновление задачи
- `DELETE /api/tasks/:id` - Удаление задачи
- `POST /api/tasks/:id/comments` - Добавление комментария
- `POST /api/tasks/:id/chat` - Отправка сообщения в чат

### Пользователи
- `GET /api/users` - Список пользователей
- `GET /api/users/:id` - Получение пользователя
- `PUT /api/users/:id` - Обновление пользователя (admin/manager)
- `DELETE /api/users/:id` - Удаление пользователя (admin)

### Отделы
- `GET /api/departments/workspace/:workspaceId` - Список отделов
- `GET /api/departments/:id` - Получение отдела
- `POST /api/departments` - Создание отдела (admin/manager)
- `PUT /api/departments/:id` - Обновление отдела (admin/manager)
- `DELETE /api/departments/:id` - Удаление отдела (admin/manager)
- `POST /api/departments/:id/members` - Управление участниками (admin/manager)

### Группы
- `GET /api/groups/workspace/:workspaceId` - Список групп
- `GET /api/groups/:id` - Получение группы
- `POST /api/groups` - Создание группы (admin/manager)
- `PUT /api/groups/:id` - Обновление группы (admin/manager)
- `DELETE /api/groups/:id` - Удаление группы (admin/manager)
- `POST /api/groups/:id/members` - Управление участниками (admin/manager)

### Документы
- `GET /api/documents/workspace/:workspaceId` - Список документов
- `GET /api/documents/:id` - Получение документа
- `POST /api/documents/upload` - Загрузка документа
- `DELETE /api/documents/:id` - Удаление документа

### Уведомления
- `GET /api/notifications` - Список уведомлений
- `GET /api/notifications/unread` - Количество непрочитанных
- `PUT /api/notifications/:id/read` - Отметить как прочитанное
- `PUT /api/notifications/read-all` - Отметить все как прочитанные
- `DELETE /api/notifications/:id` - Удалить уведомление

## WebSocket

WebSocket сервер работает на том же порту, что и HTTP сервер, путь **`/ws`** (например `ws://localhost:5004/ws`).

Полная документация: **[docs/WEBSOCKET.md](../docs/WEBSOCKET.md)** — подключение, переменные `VITE_WS_URL` / `VITE_API_ORIGIN`, nginx, все типы событий и примеры на клиенте.

Кратко, типы событий (`type` в JSON):

| Событие | Назначение |
|---------|------------|
| `notification` | Персональное уведомление (`userId` + объект `notification`) |
| `chat_message` | Сообщение в чате задачи |
| `task_status_history` | История статуса для клиента LEXPRO |
| `task_conclusion_updated` | Обновлено заключение по задаче |
| `task_approval_updated` | Решение согласования |
| `task_column_action_updated` | Выполнено действие колонки |
| `document_uploaded` | Загружен документ в пространство |

Доставка — broadcast всем подключённым клиентам; фильтрация на стороне браузера.

## Groq (ассистент в чате задачи)

Чат ассистента на доске вызывает OpenAI‑совместимый endpoint Groq. Переменные окружения:

| Переменная | Описание |
|------------|----------|
| `GROQ_API_KEY` | Секретный ключ из [Groq Console](https://console.groq.com/) |
| `GROQ_MODEL` | Необязательно; по умолчанию `llama-3.3-70b-versatile` |

При недоступности Groq клиент получает **503** и JSON `{ "error": "…", "details": "…" }` (техническая причина в `details`, см. логи сервера).

**Ответ API `403 Forbidden` или текст вида «model … blocked»**

У Groq есть ограничения **по модели** на уровне организации и проекта: если модель не разрешена, запрос вернётся с кодом `permissions_error`. Нужно в консоли открыть [Organization Limits](https://console.groq.com/settings/limits) и [Project Limits](https://console.groq.com/settings/project/limits) и либо добавить используемую модель в список разрешённых (режим «Only Allow»), либо убрать блокировку. Либо задайте в `GROQ_MODEL` модель, которая уже разрешена для вашего ключа (например `llama-3.1-8b-instant`).

Подробнее: [Model Permissions](https://console.groq.com/docs/model-permissions).

После смены переменных на проде перезапустите процесс (например `pm2 restart`).

## Структура проекта

```
backend/
├── prisma/
│   └── schema.prisma       # Схема базы данных
├── src/
│   ├── routes/            # API маршруты
│   │   ├── auth.ts
│   │   ├── workspaces.ts
│   │   ├── boards.ts
│   │   ├── tasks.ts
│   │   ├── users.ts
│   │   ├── departments.ts
│   │   ├── groups.ts
│   │   ├── documents.ts
│   │   └── notifications.ts
│   ├── middleware/        # Middleware
│   │   └── auth.ts        # Аутентификация и авторизация
│   └── index.ts           # Точка входа
├── .env.example
├── package.json
└── tsconfig.json
```

## Prisma Studio

Для визуального управления базой данных:
```bash
pnpm prisma:studio
```
