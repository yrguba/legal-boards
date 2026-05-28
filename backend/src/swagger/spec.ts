import { parameters, schemas, securitySchemes } from './components';
import { allPaths } from './paths';

const port = process.env.PORT || '5004';

export const openApiSpec = {
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
      url: `http://localhost:${port}`,
      description: 'Локальный сервер',
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

export type OpenApiSpec = typeof openApiSpec;
