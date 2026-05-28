/** Shared OpenAPI components (schemas, parameters, security). */

export const securitySchemes = {
  bearerAuth: {
    type: 'http' as const,
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'JWT из POST /api/auth/login или POST /api/lex/auth/login',
  },
};

export const schemas = {
  Error: {
    type: 'object',
    properties: {
      error: { type: 'string' },
    },
    required: ['error'],
  },
  LoginRequest: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', format: 'password' },
    },
    required: ['email', 'password'],
  },
  RegisterRequest: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', format: 'password' },
      name: { type: 'string' },
      role: { type: 'string', enum: ['admin', 'manager', 'member'] },
    },
    required: ['email', 'password', 'name'],
  },
  AuthTokenResponse: {
    type: 'object',
    properties: {
      token: { type: 'string' },
      user: { type: 'object', additionalProperties: true },
    },
  },
  JsonObject: {
    type: 'object',
    additionalProperties: true,
  },
};

export const parameters = {
  workspaceId: {
    name: 'workspaceId',
    in: 'path' as const,
    required: true,
    schema: { type: 'string' },
  },
  boardId: {
    name: 'boardId',
    in: 'path' as const,
    required: true,
    schema: { type: 'string' },
    description: 'ID или code доски',
  },
  taskId: {
    name: 'id',
    in: 'path' as const,
    required: true,
    schema: { type: 'string' },
  },
  entityId: {
    name: 'id',
    in: 'path' as const,
    required: true,
    schema: { type: 'string' },
  },
  columnId: {
    name: 'columnId',
    in: 'path' as const,
    required: true,
    schema: { type: 'string' },
  },
  typeId: {
    name: 'typeId',
    in: 'path' as const,
    required: true,
    schema: { type: 'string' },
  },
  attachmentId: {
    name: 'attachmentId',
    in: 'path' as const,
    required: true,
    schema: { type: 'string' },
  },
  channelId: {
    name: 'channelId',
    in: 'path' as const,
    required: true,
    schema: { type: 'string' },
  },
  agingDays: {
    name: 'agingDays',
    in: 'query' as const,
    schema: { type: 'integer', default: 7, minimum: 1, maximum: 90 },
  },
  periodDays: {
    name: 'periodDays',
    in: 'query' as const,
    schema: { type: 'integer', default: 30, minimum: 1, maximum: 365 },
  },
  assigneeId: {
    name: 'assigneeId',
    in: 'query' as const,
    schema: { type: 'string' },
  },
};

export const stdErrorResponses = {
  '401': { description: 'Не авторизован', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  '403': { description: 'Недостаточно прав', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  '404': { description: 'Не найдено', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  '500': { description: 'Ошибка сервера', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
};
