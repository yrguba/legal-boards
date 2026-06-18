import type { BoardAdvancedSettings } from './features/board-settings/boardAdvancedSettings.types';

export type UserRole = 'admin' | 'manager' | 'member' | 'guest';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  departmentId?: string;
  groupIds?: string[];
  profileFields?: Record<string, string | null | undefined>;
  mustChangePassword?: boolean;
}

export type ProfileFieldMask = 'passport' | 'departmentCode' | 'snils' | 'phone' | 'digits';

export interface EmployeeProfileField {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  type: 'text' | 'textarea' | 'select' | 'date' | 'money';
  required: boolean;
  filterable: boolean;
  confidential?: boolean;
  mask?: ProfileFieldMask | null;
  options?: string[];
  position: number;
  section?: string | null;
}

export interface GroupLeader {
  id: string;
  name: string;
  email?: string;
  avatar?: string | null;
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
  departmentId: string;
  memberIds: string[];
  leaderId?: string | null;
  leader?: GroupLeader | null;
  department?: { id: string; name: string };
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

export interface AggregatedBoardSource {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  position: number;
  columns: { id: string; name: string; position: number }[];
}

export interface Board {
  id: string;
  code: string;
  name: string;
  description?: string;
  workspaceId: string;
  kind?: 'standard' | 'aggregated';
  attachmentsEnabled?: boolean;
  visibility: {
    departmentIds?: string[];
    groupIds?: string[];
  };
  columns: BoardColumn[];
  taskFields: TaskField[];
  taskTypes: TaskType[];
  viewMode: 'kanban' | 'list';
  advancedSettings?: BoardAdvancedSettings;
  /** Только для kind=aggregated */
  sources?: AggregatedBoardSource[];
  _count?: { tasks?: number; aggregatedSources?: number };
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  name: string;
  type: string;
  size: number;
  path: string;
  uploadedBy: string;
  createdAt: string;
}

export interface Task {
  id: string;
  /** Сквозной номер на доске */
  number?: number;
  /** Публичный ключ IT-19 */
  key?: string;
  boardCode?: string;
  boardId: string;
  columnId: string;
  /** Порядок внутри колонки (0 — сверху) */
  position?: number;
  title: string;
  description?: string;
  typeId: string;
  assigneeId?: string;
  priority?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  customFields: Record<string, any>;
  /** Секунды, накопленные правилами контроля времени доски */
  trackedTimeSeconds?: number;
  /** ISO: начало текущего отрезка учёта (таймер на карточке идёт) */
  timeTrackingActiveSince?: string | null;
  creator?: { id: string; name: string; email?: string };
  assignee?: { id: string; name: string; email?: string; avatar?: string | null };
  /** Вложения только этой задачи (не глобальные Document) */
  taskAttachments?: TaskAttachment[];
  /** Поля сводной доски */
  sourceBoardId?: string;
  sourceBoardCode?: string;
  sourceBoardName?: string;
  sourceColumnId?: string;
  sourceColumnName?: string;
  type?: TaskType;
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
  type: 'client' | 'assistant' | string;
  content: string;
  sender: string;
  userId?: string;
  createdAt: string;
  user?: { id: string; name: string; avatar?: string | null };
}

export interface TaskClientInteraction {
  id: string;
  taskId: string;
  userId: string;
  kind: string;
  title: string;
  details?: string | null;
  occurredAt: string;
  createdAt: string;
  user?: { id: string; name: string; avatar?: string | null };
}

export interface Conference {
  id: string;
  workspaceId: string;
  title: string;
  roomName: string;
  shareToken: string;
  mode: string;
  status: string;
  startAt: string;
  endAt: string | null;
  createdById: string;
  allowGuests: boolean;
  joinUrl: string;
  jitsiDomain: string;
  description?: string | null;
  attendeeIds?: string[];
  attendeeCount?: number;
  createdBy?: { id: string; name: string; email?: string; avatar?: string | null };
  canJoin?: boolean;
}

export interface ConferencePublicInfo {
  title: string;
  roomName: string;
  jitsiDomain: string;
  status: string;
}

export interface Notification {
  id: string;
  type:
    | 'task_assigned'
    | 'comment'
    | 'status_change'
    | 'document'
    | 'mention'
    | 'user_added'
    | 'workspace_invite'
    | 'workspace_invite_accepted'
    | 'workspace_invite_declined'
    | 'workspace_member_removed'
    | 'conference_invite'
    | 'conference_updated'
    | 'conference_cancelled';
  title: string;
  message: string;
  userId: string;
  relatedId?: string;
  isRead: boolean;
  createdAt: string;
}
