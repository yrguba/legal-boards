import { parameters } from '../components';
import { jsonBody, jsonBodyObject, jsonResponse, multipartBody, op } from '../helpers';

export const authPaths = {
  '/api/auth/register': {
    post: op('Auth', 'Регистрация сотрудника Legal Boards', {
      secured: false,
      requestBody: jsonBody('#/components/schemas/RegisterRequest'),
      responses: {
        '200': {
          description: 'Успешная регистрация',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthTokenResponse' } } },
        },
        '400': { description: 'Email уже занят', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      },
    }),
  },
  '/api/auth/login': {
    post: op('Auth', 'Вход сотрудника Legal Boards', {
      secured: false,
      requestBody: jsonBody('#/components/schemas/LoginRequest'),
      responses: {
        '200': {
          description: 'Успешный вход',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthTokenResponse' } } },
        },
        '401': { description: 'Неверные учётные данные', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      },
    }),
  },
  '/api/auth/verify': {
    post: op('Auth', 'Проверка JWT и получение профиля', {
      responses: { '200': { description: 'Текущий пользователь' } },
    }),
  },
};

export const lexAuthPaths = {
  '/api/lex/auth/register': {
    post: op('Lex Auth', 'Регистрация клиента LEXPRO', {
      secured: false,
      requestBody: jsonBodyObject('email, password, name, …'),
      responses: { '200': { description: 'Токен и профиль клиента' } },
    }),
  },
  '/api/lex/auth/login': {
    post: op('Lex Auth', 'Вход клиента LEXPRO', {
      secured: false,
      requestBody: jsonBody('#/components/schemas/LoginRequest'),
      responses: { '200': { description: 'Токен и профиль клиента' } },
    }),
  },
  '/api/lex/auth/verify': {
    post: op('Lex Auth', 'Проверка JWT клиента LEXPRO', {
      responses: { '200': { description: 'Профиль клиента' } },
    }),
  },
  '/api/lex/auth/profile': {
    post: op('Lex Auth', 'Обновление профиля клиента (POST)', {
      requestBody: jsonBodyObject(),
      responses: { '200': { description: 'Обновлённый профиль' } },
    }),
    patch: op('Lex Auth', 'Обновление профиля клиента (PATCH)', {
      requestBody: jsonBodyObject(),
      responses: { '200': { description: 'Обновлённый профиль' } },
    }),
    put: op('Lex Auth', 'Обновление профиля клиента (PUT)', {
      requestBody: jsonBodyObject(),
      responses: { '200': { description: 'Обновлённый профиль' } },
    }),
  },
};

export const workspacePaths = {
  '/api/workspaces': {
    get: op('Workspaces', 'Список пространств текущего пользователя'),
    post: op('Workspaces', 'Создать пространство', {
      requestBody: jsonBodyObject('name, description, …'),
      responses: { '201': { description: 'Созданное пространство' } },
    }),
  },
  '/api/workspaces/{id}': {
    get: op('Workspaces', 'Получить пространство', { parameters: [parameters.entityId] }),
    put: op('Workspaces', 'Обновить пространство', {
      parameters: [parameters.entityId],
      requestBody: jsonBodyObject(),
    }),
    delete: op('Workspaces', 'Удалить пространство', { parameters: [parameters.entityId] }),
  },
  '/api/workspaces/{id}/users': {
    post: op('Workspaces', 'Добавить пользователя в пространство', {
      parameters: [parameters.entityId],
      requestBody: jsonBodyObject('userId, role, …'),
    }),
  },
};

export const boardPaths = {
  '/api/boards/workspace/{workspaceId}': {
    get: op('Boards', 'Доски пространства', { parameters: [parameters.workspaceId] }),
  },
  '/api/boards/{id}': {
    get: op('Boards', 'Получить доску по ID или code', { parameters: [parameters.entityId] }),
    put: op('Boards', 'Обновить доску', {
      parameters: [parameters.entityId],
      requestBody: jsonBodyObject('name, columns, taskFields, taskTypes, …'),
    }),
    delete: op('Boards', 'Удалить доску (admin/manager)', { parameters: [parameters.entityId] }),
  },
  '/api/boards': {
    post: op('Boards', 'Создать доску', {
      requestBody: jsonBodyObject('workspaceId, name, columns, …'),
      responses: { '201': { description: 'Созданная доска' } },
    }),
  },
  '/api/boards/{boardId}/advanced-settings': {
    patch: op('Boards', 'Обновить расширенные настройки доски (PATCH)', {
      parameters: [parameters.boardId],
      requestBody: jsonBodyObject('approvals, columnActions, timeTracking, reporting, …'),
    }),
    put: op('Boards', 'Обновить расширенные настройки доски (PUT)', {
      parameters: [parameters.boardId],
      requestBody: jsonBodyObject(),
    }),
    post: op('Boards', 'Обновить расширенные настройки доски (POST)', {
      parameters: [parameters.boardId],
      requestBody: jsonBodyObject(),
    }),
  },
  '/api/boards/{id}/settings': {
    patch: op('Boards', 'Настройки доски (deprecated)', {
      deprecated: true,
      parameters: [parameters.entityId],
      requestBody: jsonBodyObject(),
    }),
    put: op('Boards', 'Настройки доски (deprecated)', {
      deprecated: true,
      parameters: [parameters.entityId],
      requestBody: jsonBodyObject(),
    }),
  },
  '/api/boards/{boardId}/columns/{columnId}/move-tasks': {
    post: op('Boards', 'Переместить задачи из колонки', {
      parameters: [parameters.boardId, parameters.columnId],
      requestBody: jsonBodyObject('targetColumnId'),
    }),
  },
  '/api/boards/{boardId}/types/{typeId}/move-tasks': {
    post: op('Boards', 'Переместить задачи с типом', {
      parameters: [parameters.boardId, parameters.typeId],
      requestBody: jsonBodyObject('targetTypeId'),
    }),
  },
  '/api/boards/{id}/columns': {
    post: op('Boards', 'Добавить колонку', {
      parameters: [parameters.entityId],
      requestBody: jsonBodyObject('name, position, …'),
    }),
  },
  '/api/boards/columns/{columnId}': {
    put: op('Boards', 'Обновить колонку', {
      parameters: [parameters.columnId],
      requestBody: jsonBodyObject('name, position, …'),
    }),
    delete: op('Boards', 'Удалить колонку', { parameters: [parameters.columnId] }),
  },
};

export const taskPaths = {
  '/api/tasks/board/{boardId}': {
    get: op('Tasks', 'Задачи доски', { parameters: [parameters.boardId] }),
  },
  '/api/tasks/{id}': {
    get: op('Tasks', 'Получить задачу', { parameters: [parameters.taskId] }),
    put: op('Tasks', 'Обновить задачу (колонка, поля, исполнитель)', {
      parameters: [parameters.taskId],
      requestBody: jsonBodyObject('columnId, title, description, assigneeId, customFields, …'),
    }),
    delete: op('Tasks', 'Удалить задачу', { parameters: [parameters.taskId] }),
  },
  '/api/tasks': {
    post: op('Tasks', 'Создать задачу', {
      requestBody: jsonBodyObject('boardId, columnId, title, typeId, …'),
      responses: { '201': { description: 'Созданная задача' } },
    }),
  },
  '/api/tasks/{id}/attachments': {
    post: op('Tasks', 'Загрузить вложение', {
      parameters: [parameters.taskId],
      requestBody: multipartBody('Файл задачи'),
      responses: { '201': { description: 'Вложение' } },
    }),
  },
  '/api/tasks/{id}/attachments/{attachmentId}': {
    delete: op('Tasks', 'Удалить вложение', {
      parameters: [parameters.taskId, parameters.attachmentId],
    }),
  },
  '/api/tasks/{id}/conclusion': {
    patch: op('Tasks', 'Обновить заключение задачи', {
      parameters: [parameters.taskId],
      requestBody: jsonBodyObject('conclusion'),
    }),
  },
  '/api/tasks/{id}/activity': {
    get: op('Tasks', 'Лента активности задачи (audit)', { parameters: [parameters.taskId] }),
  },
  '/api/tasks/{id}/status-history': {
    get: op('Tasks', 'История статусов (legacy)', { parameters: [parameters.taskId] }),
  },
  '/api/tasks/{id}/approvals': {
    post: op('Tasks', 'Решение по согласованию', {
      parameters: [parameters.taskId],
      requestBody: jsonBodyObject('ruleId, decision: approved|rejected, comment'),
    }),
  },
  '/api/tasks/{id}/column-actions': {
    post: op('Tasks', 'Выполнить column action', {
      parameters: [parameters.taskId],
      requestBody: jsonBodyObject('ruleId, action: confirm|form, payload'),
    }),
  },
  '/api/tasks/{id}/comments': {
    post: op('Tasks', 'Добавить комментарий', {
      parameters: [parameters.taskId],
      requestBody: jsonBodyObject('text'),
    }),
  },
  '/api/tasks/{id}/client-interactions': {
    post: op('Tasks', 'Добавить взаимодействие с клиентом', {
      parameters: [parameters.taskId],
      requestBody: jsonBodyObject(),
    }),
  },
  '/api/tasks/{id}/chat': {
    post: op('Tasks', 'Отправить сообщение в чат задачи', {
      parameters: [parameters.taskId],
      requestBody: jsonBodyObject('message'),
    }),
  },
  '/api/tasks/{id}/chat/assistant': {
    post: op('Tasks', 'Запрос к AI-ассистенту задачи', {
      parameters: [parameters.taskId],
      requestBody: jsonBodyObject('message'),
    }),
  },
};

export const userPaths = {
  '/api/users': {
    get: op('Users', 'Список пользователей (admin/manager)'),
    post: op('Users', 'Создать пользователя (admin/manager)', {
      requestBody: jsonBodyObject('email, password, name, role, …'),
    }),
  },
  '/api/users/{id}': {
    get: op('Users', 'Получить пользователя', { parameters: [parameters.entityId] }),
    put: op('Users', 'Обновить пользователя (admin/manager)', {
      parameters: [parameters.entityId],
      requestBody: jsonBodyObject(),
    }),
    delete: op('Users', 'Удалить пользователя (admin)', { parameters: [parameters.entityId] }),
  },
  '/api/users/workspace/{workspaceId}': {
    get: op('Users', 'Пользователи пространства', { parameters: [parameters.workspaceId] }),
  },
  '/api/users/workspace/{workspaceId}/clients': {
    get: op('Users', 'Клиенты LEXPRO пространства', { parameters: [parameters.workspaceId] }),
  },
  '/api/users/workspace/{workspaceId}/lex-directory': {
    get: op('Users', 'Справочник LEX для пространства', { parameters: [parameters.workspaceId] }),
  },
};

export const orgPaths = {
  '/api/departments/workspace/{workspaceId}': {
    get: op('Departments', 'Отделы пространства', { parameters: [parameters.workspaceId] }),
  },
  '/api/departments/{id}': {
    get: op('Departments', 'Получить отдел', { parameters: [parameters.entityId] }),
    put: op('Departments', 'Обновить отдел (admin/manager)', {
      parameters: [parameters.entityId],
      requestBody: jsonBodyObject(),
    }),
    delete: op('Departments', 'Удалить отдел (admin/manager)', { parameters: [parameters.entityId] }),
  },
  '/api/departments': {
    post: op('Departments', 'Создать отдел (admin/manager)', { requestBody: jsonBodyObject() }),
  },
  '/api/departments/{id}/members': {
    post: op('Departments', 'Добавить участника отдела', {
      parameters: [parameters.entityId],
      requestBody: jsonBodyObject('userId'),
    }),
  },
  '/api/groups/workspace/{workspaceId}': {
    get: op('Groups', 'Группы пространства', { parameters: [parameters.workspaceId] }),
  },
  '/api/groups/{id}': {
    get: op('Groups', 'Получить группу', { parameters: [parameters.entityId] }),
    put: op('Groups', 'Обновить группу (admin/manager)', {
      parameters: [parameters.entityId],
      requestBody: jsonBodyObject(),
    }),
    delete: op('Groups', 'Удалить группу (admin/manager)', { parameters: [parameters.entityId] }),
  },
  '/api/groups': {
    post: op('Groups', 'Создать группу (admin/manager)', { requestBody: jsonBodyObject() }),
  },
  '/api/groups/{id}/members': {
    post: op('Groups', 'Добавить участника группы', {
      parameters: [parameters.entityId],
      requestBody: jsonBodyObject('userId'),
    }),
  },
};

export const documentPaths = {
  '/api/documents/workspace/{workspaceId}': {
    get: op('Documents', 'Документы пространства', { parameters: [parameters.workspaceId] }),
  },
  '/api/documents/{id}': {
    get: op('Documents', 'Получить документ', { parameters: [parameters.entityId] }),
    delete: op('Documents', 'Удалить документ', { parameters: [parameters.entityId] }),
  },
  '/api/documents/upload': {
    post: op('Documents', 'Загрузить документ', {
      requestBody: multipartBody('Файл и метаданные (workspaceId, name, …)'),
      responses: { '201': { description: 'Загруженный документ' } },
    }),
  },
};

export const notificationPaths = {
  '/api/notifications': {
    get: op('Notifications', 'Все уведомления'),
  },
  '/api/notifications/unread': {
    get: op('Notifications', 'Непрочитанные уведомления'),
  },
  '/api/notifications/read-all': {
    put: op('Notifications', 'Отметить все прочитанными'),
  },
  '/api/notifications/{id}/read': {
    put: op('Notifications', 'Отметить прочитанным', { parameters: [parameters.entityId] }),
  },
  '/api/notifications/{id}': {
    delete: op('Notifications', 'Удалить уведомление', { parameters: [parameters.entityId] }),
  },
};

export const configPaths = {
  '/api/config/tabs': {
    get: op('Config', 'Флаги вкладок бокового меню', {
      secured: false,
      responses: {
        '200': {
          description: 'documents, knowledge, chat, calendar — true/false',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/JsonObject' } } },
        },
      },
    }),
  },
};

export const pushPaths = {
  '/api/push/config': {
    get: op('Push', 'Статус push-уведомлений', {
      secured: false,
      responses: {
        '200': {
          description: 'enabled, androidEnabled, iosEnabled, fcmConfigured, apnsConfigured',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/JsonObject' } } },
        },
      },
    }),
  },
  '/api/push/devices': {
    get: op('Push', 'Активные push-устройства текущего пользователя'),
    post: op('Push', 'Зарегистрировать или обновить push-токен', {
      requestBody: jsonBody('#/components/schemas/PushRegisterDeviceRequest'),
      responses: {
        '201': { description: 'Токен зарегистрирован' },
        '200': { description: 'Токен обновлён' },
      },
    }),
    delete: op('Push', 'Отключить push-токен (logout)', {
      requestBody: jsonBodyObject('token'),
      responses: { '200': { description: 'Токен деактивирован' } },
    }),
  },
  '/api/push/test': {
    post: op('Push', 'Отправить тестовый push на свои устройства', {
      description:
        'Отправляет видимое уведомление на все активные устройства текущего пользователя. ' +
        'Перед вызовом зарегистрируйте token через POST /api/push/devices.',
      requestBody: jsonBody('#/components/schemas/PushTestRequest', false),
      responses: {
        '200': jsonResponse('#/components/schemas/PushTestResponse', 'Push доставлен хотя бы на одно устройство'),
        '404': jsonResponse('#/components/schemas/JsonObject', 'Нет устройств (code: NO_DEVICES)'),
        '502': jsonResponse('#/components/schemas/PushTestResponse', 'Устройства есть, доставка не удалась'),
        '503': jsonResponse('#/components/schemas/JsonObject', 'PUSH_ENABLED=false (code: PUSH_DISABLED)'),
      },
    }),
  },
};

export const chatPaths = {
  '/api/workspace-chats/workspace/{workspaceId}/channels': {
    get: op('Workspace Chats', 'Каналы чата пространства', { parameters: [parameters.workspaceId] }),
  },
  '/api/workspace-chats/channels/{channelId}/messages': {
    get: op('Workspace Chats', 'Сообщения канала', { parameters: [parameters.channelId] }),
    post: op('Workspace Chats', 'Отправить сообщение', {
      parameters: [parameters.channelId],
      requestBody: jsonBodyObject('text'),
    }),
  },
};

export const calendarPaths = {
  '/api/calendar-events/workspace/{workspaceId}': {
    get: op('Calendar', 'События календаря пространства', { parameters: [parameters.workspaceId] }),
  },
  '/api/calendar-events': {
    post: op('Calendar', 'Создать событие', { requestBody: jsonBodyObject() }),
  },
  '/api/calendar-events/{id}': {
    put: op('Calendar', 'Обновить событие', {
      parameters: [parameters.entityId],
      requestBody: jsonBodyObject(),
    }),
    delete: op('Calendar', 'Удалить событие', { parameters: [parameters.entityId] }),
  },
};

export const knowledgePaths = {
  '/api/knowledge/workspaces/{workspaceId}/knowledge-articles': {
    get: op('Knowledge', 'Статьи базы знаний', { parameters: [parameters.workspaceId] }),
    post: op('Knowledge', 'Создать статью', {
      parameters: [parameters.workspaceId],
      requestBody: jsonBodyObject(),
    }),
  },
  '/api/knowledge/knowledge-articles/{id}': {
    get: op('Knowledge', 'Получить статью', { parameters: [parameters.entityId] }),
    put: op('Knowledge', 'Обновить статью', {
      parameters: [parameters.entityId],
      requestBody: jsonBodyObject(),
    }),
    delete: op('Knowledge', 'Удалить статью', { parameters: [parameters.entityId] }),
  },
};

export const reportPaths = {
  '/api/reports/boards/{boardId}/dashboard': {
    get: op('Reports', 'Операционный дашборд и метрики процесса', {
      parameters: [parameters.boardId, parameters.agingDays, parameters.periodDays, parameters.assigneeId],
      responses: {
        '200': {
          description: 'Воронка, aging, согласования, lead/cycle time',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/JsonObject' } } },
        },
      },
    }),
  },
};

export const allPaths = {
  ...authPaths,
  ...lexAuthPaths,
  ...workspacePaths,
  ...boardPaths,
  ...taskPaths,
  ...userPaths,
  ...orgPaths,
  ...documentPaths,
  ...notificationPaths,
  ...configPaths,
  ...pushPaths,
  ...chatPaths,
  ...calendarPaths,
  ...knowledgePaths,
  ...reportPaths,
};
