import { AppWindow, Bot, FileText, MessageSquare, User } from 'lucide-react';
import type { TaskPanelType } from './types';
import type { LucideIcon } from 'lucide-react';

export const TASK_PAGE_RESIZABLE_STORAGE_ID = 'task-page-panels';

export const TASK_RESIZABLE_PANEL_IDS = {
  main: 'task-main',
  sidebar: 'task-sidebar',
} as const;

export const PANEL_SIZES = {
  main: { default: 68, min: 40 },
  sidebar: { default: 32, min: 24, max: 50 },
} as const;

export const CLIENT_INTERACTION_KINDS: { value: string; label: string }[] = [
  { value: 'call', label: 'Звонок' },
  { value: 'email', label: 'Письмо' },
  { value: 'meeting', label: 'Встреча' },
  { value: 'note', label: 'Заметка' },
  { value: 'other', label: 'Другое' },
];

export type TaskSidebarRailEntry = {
  id: TaskPanelType;
  icon: LucideIcon;
  label: string;
};

export const TASK_SIDEBAR_STATIC_ENTRIES: TaskSidebarRailEntry[] = [
  { id: 'client', icon: User, label: 'Клиент' },
  { id: 'assistant', icon: Bot, label: 'Ассистент' },
  { id: 'comments', icon: MessageSquare, label: 'Комментарии' },
  { id: 'documents', icon: FileText, label: 'Документы' },
];

/** Обратная совместимость */
export const SIDEBAR_PANEL_ICONS = TASK_SIDEBAR_STATIC_ENTRIES;

export const IFRAME_SIDEBAR_ICON = AppWindow;
