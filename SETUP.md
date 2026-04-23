# Инструкция по установке Legal Boards

## ⚠️ Важно

Этот репозиторий содержит частичный код проекта. Полный код включает:
- Все API routes (auth, workspaces, boards, tasks, users, departments, groups, documents, notifications)
- Frontend React приложение с TypeScript
- UI компоненты и страницы
- Типы TypeScript
- Mock данные для демонстрации

## Загрузка полного кода

### Вариант 1: Через архив

1. Скачайте архив `legal-boards.tar.gz` из Figma Make
2. Распакуйте и загрузите в этот репозиторий:

```bash
# Распаковка
tar -xzf legal-boards.tar.gz
cd legal-boards

# Инициализация git
git init
git branch -m main

# Добавление файлов
git add .
git commit -m "feat: add complete Legal Boards application"

# Подключение к репозиторию
git remote add origin https://github.com/yrguba/legal-boards.git

# Загрузка (с force т.к. уже есть коммиты)
git push -u origin main --force
```

### Вариант 2: Ручное копирование

1. Клонируйте репозиторий:
```bash
git clone https://github.com/yrguba/legal-boards.git
cd legal-boards
```

2. Скопируйте недостающие файлы из архива:
   - `src/` - весь frontend код
   - `backend/src/routes/` - все API routes
   - `package.json`, `vite.config.ts` и другие конфигурационные файлы

3. Добавьте и закоммитьте:
```bash
git add .
git commit -m "feat: add missing application files"
git push origin main
```

## Что нужно добавить

### Backend Routes
- ✅ `backend/src/routes/auth.ts` - (добавьте из архива)
- ✅ `backend/src/routes/workspaces.ts` - (добавьте из архива)
- ✅ `backend/src/routes/boards.ts` - (добавьте из архива)
- ✅ `backend/src/routes/tasks.ts` - (добавьте из архива)
- ✅ `backend/src/routes/users.ts` - (добавьте из архива)
- ✅ `backend/src/routes/departments.ts` - (добавьте из архива)
- ✅ `backend/src/routes/groups.ts` - (добавьте из архива)
- ✅ `backend/src/routes/documents.ts` - (добавьте из архива)
- ✅ `backend/src/routes/notifications.ts` - (добавьте из архива)

### Frontend
- `src/app/` - компоненты, страницы, роуты
- `src/styles/` - CSS стили
- `package.json` - зависимости frontend
- `vite.config.ts` - конфигурация Vite

## После добавления всех файлов

Следуйте инструкциям в README.md для установки и запуска приложения.

## Структура проекта

```
legal-boards/
├── backend/                    # Backend API
│   ├── prisma/
│   │   └── schema.prisma      ✅ Добавлено
│   ├── src/
│   │   ├── middleware/
│   │   │   └── auth.ts        ✅ Добавлено
│   │   ├── routes/            ⚠️ Добавьте из архива
│   │   └── index.ts           ✅ Добавлено
│   ├── .env.example           ✅ Добавлено
│   ├── package.json           ✅ Добавлено
│   └── tsconfig.json          ✅ Добавлено
├── src/                        ⚠️ Добавьте из архива
│   ├── app/
│   └── styles/
├── package.json                ⚠️ Добавьте из архива
├── vite.config.ts              ⚠️ Добавьте из архива
├── .gitignore                  ✅ Добавлено
└── README.md                   ✅ Добавлено
```
