export type UserRole = 'admin' | 'manager' | 'member' | 'guest';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  departmentId?: string;
  groupIds?: string[];
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  workspaceId: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  workspaceId: string;
  memberIds: string[];
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  isOwner: boolean;
  createdAt: string;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  workspaceId: string;
  visibility: {
    type: 'workspace' | 'department' | 'group' | 'custom';
    departmentIds?: string[];
    groupIds?: string[];
    userIds?: string[];
  };
}

export interface BoardColumn {
  id: string;
  name: string;
  description?: string;
  position: number;
  autoAssign?: {
    type: 'user' | 'department' | 'group';
    id: string;
  };
  visibility: {
    departmentIds?: string[];
    groupIds?: string[];
  };
}

export interface TaskField {
  id: string;
  name: string;
  type: 'text' | 'textarea' | 'select' | 'date';
  required: boolean;
  options?: string[];
  position: number;
}

export interface TaskType {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export interface Board {
  id: string;
  code: string;
  name: string;
  description?: string;
  workspaceId: string;
  attachmentsEnabled?: boolean;
  visibility: {
    departmentIds?: string[];
    groupIds?: string[];
  };
  columns: BoardColumn[];
  taskFields: TaskField[];
  taskTypes: TaskType[];
  viewMode: 'kanban' | 'list';
}

export interface Task {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description?: string;
  typeId: string;
  assigneeId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  customFields: Record<string, any>;
  attachments: string[];
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  taskId: string;
  type: 'client' | 'assistant';
  content: string;
  sender: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: 'task_assigned' | 'comment' | 'status_change' | 'document' | 'mention' | 'user_added';
  title: string;
  message: string;
  userId: string;
  relatedId?: string;
  isRead: boolean;
  createdAt: string;
}
