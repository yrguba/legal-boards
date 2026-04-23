import type { User, Workspace, Department, Group, Board, Task, Document, TaskType, BoardColumn, TaskField, Notification } from '../types';

export const currentUser: User = {
  id: 'user-1',
  email: 'admin@legalboards.com',
  name: 'Александр Иванов',
  role: 'admin',
  avatar: undefined,
};

export const workspaces: Workspace[] = [
  {
    id: 'ws-1',
    name: 'Юридическая фирма "Правовед"',
    description: 'Основное рабочее пространство',
    ownerId: 'user-1',
    isOwner: true,
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'ws-2',
    name: 'Корпоративное право',
    description: 'Совместное пространство',
    ownerId: 'user-2',
    isOwner: false,
    createdAt: '2026-02-10T14:30:00Z',
  },
];

export const departments: Department[] = [
  { id: 'dept-1', name: 'Гражданское право', workspaceId: 'ws-1' },
  { id: 'dept-2', name: 'Уголовное право', workspaceId: 'ws-1' },
  { id: 'dept-3', name: 'Корпоративное право', workspaceId: 'ws-1' },
];

export const groups: Group[] = [
  {
    id: 'group-1',
    name: 'Группа А',
    description: 'Старшие юристы',
    workspaceId: 'ws-1',
    memberIds: ['user-1', 'user-2'],
  },
  {
    id: 'group-2',
    name: 'Группа Б',
    description: 'Младшие юристы',
    workspaceId: 'ws-1',
    memberIds: ['user-3', 'user-4'],
  },
];

export const users: User[] = [
  currentUser,
  {
    id: 'user-2',
    email: 'maria@legalboards.com',
    name: 'Мария Петрова',
    role: 'manager',
    departmentId: 'dept-1',
    groupIds: ['group-1'],
  },
  {
    id: 'user-3',
    email: 'dmitry@legalboards.com',
    name: 'Дмитрий Сидоров',
    role: 'member',
    departmentId: 'dept-2',
    groupIds: ['group-2'],
  },
  {
    id: 'user-4',
    email: 'elena@legalboards.com',
    name: 'Елена Кузнецова',
    role: 'member',
    departmentId: 'dept-3',
    groupIds: ['group-2'],
  },
];

export const taskTypes: TaskType[] = [
  { id: 'type-1', name: 'Консультация', color: '#3b82f6' },
  { id: 'type-2', name: 'Документ', color: '#10b981' },
  { id: 'type-3', name: 'Судебное дело', color: '#ef4444' },
  { id: 'type-4', name: 'Исследование', color: '#f59e0b' },
];

export const defaultColumns: BoardColumn[] = [
  { id: 'col-1', name: 'К выполнению', description: 'Новые задачи', position: 0, visibility: {} },
  { id: 'col-2', name: 'В работе', description: 'Задачи в процессе', position: 1, visibility: {} },
  { id: 'col-3', name: 'На проверке', description: 'Ожидают проверки', position: 2, visibility: {} },
  { id: 'col-4', name: 'Завершено', description: 'Выполненные задачи', position: 3, visibility: {} },
];

export const defaultTaskFields: TaskField[] = [
  { id: 'field-1', name: 'Название', type: 'text', required: true, position: 0 },
  { id: 'field-2', name: 'Описание', type: 'textarea', required: false, position: 1 },
  { id: 'field-3', name: 'Приоритет', type: 'select', required: true, options: ['Низкий', 'Средний', 'Высокий', 'Критический'], position: 2 },
  { id: 'field-4', name: 'Срок', type: 'date', required: false, position: 3 },
  { id: 'field-5', name: 'Исполнитель', type: 'user', required: false, position: 4 },
  { id: 'field-6', name: 'Вложения', type: 'file', required: false, position: 5 },
];

export const boards: Board[] = [
  {
    id: 'board-1',
    name: 'Гражданские дела',
    description: 'Доска для отслеживания гражданских дел',
    workspaceId: 'ws-1',
    visibility: { departmentIds: ['dept-1'] },
    columns: defaultColumns,
    taskFields: defaultTaskFields,
    taskTypes,
    viewMode: 'kanban',
  },
  {
    id: 'board-2',
    name: 'Корпоративные вопросы',
    description: 'Управление корпоративными задачами',
    workspaceId: 'ws-1',
    visibility: { departmentIds: ['dept-3'] },
    columns: defaultColumns,
    taskFields: defaultTaskFields,
    taskTypes,
    viewMode: 'kanban',
  },
];

export const tasks: Task[] = [
  {
    id: 'task-1',
    boardId: 'board-1',
    columnId: 'col-1',
    title: 'Консультация по договору купли-продажи',
    description: 'Клиент запрашивает консультацию по условиям договора',
    typeId: 'type-1',
    assigneeId: 'user-2',
    createdBy: 'user-1',
    createdAt: '2026-04-20T09:00:00Z',
    updatedAt: '2026-04-20T09:00:00Z',
    customFields: { priority: 'Высокий', deadline: '2026-04-25' },
    attachments: [],
  },
  {
    id: 'task-2',
    boardId: 'board-1',
    columnId: 'col-2',
    title: 'Подготовка иска в суд',
    description: 'Составление искового заявления по делу №12345',
    typeId: 'type-3',
    assigneeId: 'user-2',
    createdBy: 'user-1',
    createdAt: '2026-04-18T10:30:00Z',
    updatedAt: '2026-04-22T14:20:00Z',
    customFields: { priority: 'Критический', deadline: '2026-04-24' },
    attachments: ['contract.pdf', 'evidence.docx'],
  },
  {
    id: 'task-3',
    boardId: 'board-1',
    columnId: 'col-2',
    title: 'Анализ судебной практики',
    description: 'Исследование похожих дел за последние 3 года',
    typeId: 'type-4',
    assigneeId: 'user-3',
    createdBy: 'user-2',
    createdAt: '2026-04-19T11:00:00Z',
    updatedAt: '2026-04-23T08:15:00Z',
    customFields: { priority: 'Средний', deadline: '2026-04-30' },
    attachments: [],
  },
  {
    id: 'task-4',
    boardId: 'board-1',
    columnId: 'col-3',
    title: 'Договор аренды помещения',
    description: 'Проверка и согласование договора аренды',
    typeId: 'type-2',
    assigneeId: 'user-2',
    createdBy: 'user-1',
    createdAt: '2026-04-17T15:00:00Z',
    updatedAt: '2026-04-23T09:00:00Z',
    customFields: { priority: 'Средний' },
    attachments: ['lease_agreement.pdf'],
  },
  {
    id: 'task-5',
    boardId: 'board-1',
    columnId: 'col-4',
    title: 'Консультация по трудовому спору',
    description: 'Завершена консультация клиента',
    typeId: 'type-1',
    assigneeId: 'user-3',
    createdBy: 'user-1',
    createdAt: '2026-04-15T09:30:00Z',
    updatedAt: '2026-04-22T16:45:00Z',
    customFields: { priority: 'Низкий' },
    attachments: [],
  },
];

export const documents: Document[] = [
  {
    id: 'doc-1',
    name: 'Шаблон договора.docx',
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 45600,
    uploadedBy: 'user-1',
    uploadedAt: '2026-04-10T10:00:00Z',
    workspaceId: 'ws-1',
    visibility: { type: 'workspace' },
  },
  {
    id: 'doc-2',
    name: 'Судебная практика 2025.pdf',
    type: 'application/pdf',
    size: 1240000,
    uploadedBy: 'user-2',
    uploadedAt: '2026-04-15T14:30:00Z',
    workspaceId: 'ws-1',
    visibility: { type: 'department', departmentIds: ['dept-1', 'dept-2'] },
  },
  {
    id: 'doc-3',
    name: 'Регламент работы.pdf',
    type: 'application/pdf',
    size: 89000,
    uploadedBy: 'user-1',
    uploadedAt: '2026-03-20T09:00:00Z',
    workspaceId: 'ws-1',
    visibility: { type: 'group', groupIds: ['group-1'] },
  },
];

export const notifications: Notification[] = [
  {
    id: 'notif-1',
    type: 'task_assigned',
    title: 'Новая задача',
    message: 'Вам назначена задача "Подготовка иска в суд"',
    userId: 'user-1',
    relatedId: 'task-2',
    isRead: false,
    createdAt: '2026-04-23T09:30:00Z',
  },
  {
    id: 'notif-2',
    type: 'comment',
    title: 'Новый комментарий',
    message: 'Мария Петрова оставила комментарий к задаче "Консультация по договору купли-продажи"',
    userId: 'user-1',
    relatedId: 'task-1',
    isRead: false,
    createdAt: '2026-04-23T08:15:00Z',
  },
  {
    id: 'notif-3',
    type: 'status_change',
    title: 'Изменение статуса',
    message: 'Задача "Анализ судебной практики" перемещена в статус "На проверке"',
    userId: 'user-1',
    relatedId: 'task-3',
    isRead: true,
    createdAt: '2026-04-22T16:45:00Z',
  },
  {
    id: 'notif-4',
    type: 'document',
    title: 'Новый документ',
    message: 'Загружен новый документ "Судебная практика 2025.pdf"',
    userId: 'user-1',
    relatedId: 'doc-2',
    isRead: true,
    createdAt: '2026-04-22T14:30:00Z',
  },
  {
    id: 'notif-5',
    type: 'mention',
    title: 'Упоминание',
    message: 'Вас упомянули в комментарии к задаче "Договор аренды помещения"',
    userId: 'user-1',
    relatedId: 'task-4',
    isRead: true,
    createdAt: '2026-04-21T11:20:00Z',
  },
];
