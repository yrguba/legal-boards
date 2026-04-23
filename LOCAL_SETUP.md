# Установка и запуск Legal Boards локально

## Быстрый старт

**Backend:**
```bash
cd backend
pnpm install
cp .env.example .env
# Настройте DATABASE_URL в .env
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

**Frontend:**
```bash
pnpm install
pnpm dev
```

**Откройте:** http://localhost:5173

Полная инструкция в файле.