import { parameters, schemas, securitySchemes } from './components';
import { allPaths } from './paths';

/** Базовый URL для Swagger «Try it out» (без суффикса /api). */
export function resolveSwaggerServerUrl(): string {
  const explicit = process.env.SWAGGER_SERVER_URL?.trim().replace(/\/$/, '');
  if (explicit) return explicit;

  const port = process.env.PORT || '5004';
  return `http://localhost:${port}`;
}

export function buildOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Legal Boards API',
      version: '1.0.0',
      description:
        'REST API для Legal Boards: доски, задачи, согласования, аналитика и интеграция с LEXPRO.\n\n' +
        'Авторизация: выполните **POST /api/auth/login** или **POST /api/lex/auth/login**, ' +
        'скопируйте `token` и нажмите **Authorize** (Bearer JWT).',
    },
    servers: [
      {
        url: resolveSwaggerServerUrl(),
        description: 'API server',
      },
    ],
    tags: [
      { name: 'Auth', description: 'Аутентификация сотрудников Legal Boards' },
      { name: 'Lex Auth', description: 'Аутентификация клиентов LEXPRO' },
      { name: 'Workspaces', description: 'Рабочие пространства' },
      { name: 'Boards', description: 'Доски и колонки' },
      { name: 'Tasks', description: 'Задачи, согласования, активность' },
      { name: 'Users', description: 'Пользователи и клиенты' },
      { name: 'Departments', description: 'Отделы' },
      { name: 'Groups', description: 'Группы' },
      { name: 'Documents', description: 'Документы' },
      { name: 'Notifications', description: 'Уведомления' },
      { name: 'Config', description: 'Конфигурация UI (feature flags)' },
      { name: 'Push', description: 'Push-уведомления (FCM / APNS, staff mobile)' },
      { name: 'Workspace Chats', description: 'Чаты пространства' },
      { name: 'Calendar', description: 'Календарь' },
      { name: 'Knowledge', description: 'База знаний' },
      { name: 'Reports', description: 'Аналитика и отчёты' },
    ],
    paths: allPaths,
    components: {
      securitySchemes,
      schemas,
      parameters,
    },
    security: [{ bearerAuth: [] }],
  };
}

export type OpenApiSpec = ReturnType<typeof buildOpenApiSpec>;
