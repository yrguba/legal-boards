# Установка и запуск Legal Boards локально

## 1. Установка зависимостей

### Установите PostgreSQL:

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Скачайте установщик с https://www.postgresql.org/download/windows/

## 2. Создайте базу данных

```bash
# Подключитесь к PostgreSQL
psql postgres

# В psql выполните:
CREATE DATABASE legalboards;
CREATE USER legaluser WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE legalboards TO legaluser;
\q
```

## 3. Настройка Backend

```bash
cd backend

# Установите зависимости
pnpm install

# Создайте .env файл
cp .env.example .env
```

Отредактируйте `backend/.env`:
```env
DATABASE_URL="postgresql://legaluser:yourpassword@localhost:5432/legalboards?schema=public"
JWT_SECRET="your-random-secret-key-here-change-this"
PORT=5004
NODE_ENV=development
UPLOAD_DIR=./uploads
```

Выполните миграции БД:
```bash
pnpm db:push
```

(Опционально) Заполните БД тестовыми данными:
```bash
pnpm db:seed
```

Запустите backend:
```bash
pnpm dev
```

Backend будет работать на **http://localhost:5004**

## 4. Настройка Frontend

Откройте **новый терминал** в корневой папке проекта:

```bash
# Установите зависимости
pnpm install

# Запустите dev server (команда теперь доступна)
pnpm dev
```

Frontend будет работать на **http://localhost:5173**

## 5. Откройте приложение

Откройте браузер: **http://localhost:5173**

Вы увидите страницу входа. По умолчанию используйте mock-данные или зарегистрируйте нового пользователя.

## 6. Первый вход

Если вы выполнили `pnpm db:seed`, используйте тестовые учетные данные:
- Email: `admin@example.com`
- Password: `password123`

Или зарегистрируйте нового пользователя через API:

```bash
curl -X POST http://localhost:5004/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@legalboards.com",
    "password": "admin123",
    "name": "Администратор",
    "role": "admin"
  }'
```

Затем войдите на странице входа с этими данными:
- Email: `admin@legalboards.com`
- Password: `admin123`

## Структура запущенного проекта

```
Terminal 1: Backend (http://localhost:5004)
Terminal 2: Frontend (http://localhost:5173)
PostgreSQL: База данных (localhost:5432)
```

## Полезные команды

### Backend:
```bash
cd backend
pnpm dev              # Запуск в режиме разработки
pnpm build            # Сборка для production
pnpm start            # Запуск production версии
pnpm db:studio        # Открыть Prisma Studio для управления БД
pnpm db:seed          # Заполнить БД тестовыми данными
```

### Frontend:
```bash
pnpm dev              # Запуск в режиме разработки
pnpm build            # Сборка для production
```

## Troubleshooting

### Ошибка подключения к БД
- Проверьте что PostgreSQL запущен: `pg_isready`
- Проверьте DATABASE_URL в `backend/.env`
- Проверьте что БД создана: `psql -l | grep legalboards`

### Ошибка миграций Prisma
```bash
cd backend
pnpm db:push  # Пересоздаст схему БД
```

### Порт занят
- Backend: измените PORT в `backend/.env`
- Frontend: измените в `vite.config.ts`

### Ошибка CORS
- Убедитесь что backend запущен на порту 5004
- Проверьте настройки cors в `backend/src/index.ts`

### node_modules не установлены
```bash
# Корневая папка
pnpm install

# Backend
cd backend
pnpm install
```

## Проверка что всё работает

1. **Backend API:** http://localhost:5004/api/auth/verify (должен вернуть ошибку 401)
2. **Frontend:** http://localhost:5173 (должна открыться страница входа)
3. **База данных:** `psql legalboards -c "SELECT version();"` (должна вывести версию PostgreSQL)

## Следующие шаги

После успешного запуска:
1. Войдите в систему с учетными данными администратора
2. Создайте рабочее пространство
3. Добавьте отделы и группы
4. Создайте доску
5. Начните работу с задачами!
