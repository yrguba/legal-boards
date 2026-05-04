import type { Board, Document, TaskField, User } from '../../types';

export type TaskPanelType = 'client' | 'assistant' | 'comments' | 'documents';

export type ClientSubPanel = 'chat' | 'history';

/** Задача с вложениями и связями с API (расширенный ответ getById) */
export type TaskRecord = Record<string, any> & {
  id: string;
  title: string;
  boardId: string;
  columnId: string;
  typeId: string;
  customFields?: Record<string, unknown>;
  taskAttachments?: unknown[];
  comments?: unknown[];
  chatMessages?: unknown[];
  clientInteractions?: unknown[];
  lexClientProfile?: {
    id: string;
    name?: string;
    email?: string;
    clientKind?: string;
    companyName?: string;
    phone?: string;
    contactNotes?: string;
  } | null;
};

export type ClientInfo = {
  fullName: string | null;
  organization: string | null;
  email: string | null;
  phone: string | null;
  contactNotes: string | null;
};

export type DocumentPreviewState = {
  name: string;
  type?: string;
  href?: string;
} & Record<string, unknown>;

export type TaskMainColumnProps = {
  task: TaskRecord;
  board: Board;
  users: User[];
  taskFields: TaskField[];
  titleFieldId: string;
  descriptionFieldId: string;
  taskType: { name?: string; color?: string } | undefined;
  assignee: User | null | undefined;
  creator: User | null | undefined;
  column: { name?: string } | undefined;
  isEditing: boolean;
  editDescription: string;
  editColumnId: string;
  editTypeId: string;
  editAssigneeId: string;
  editCustomFields: Record<string, unknown>;
  saveError: string | null;
  taskAttachments: Record<string, unknown>[];
  apiBaseUrl: string;
  uploadingFile: boolean;
  uploadError: string | null;
  isDraggingFile: boolean;
  attachmentsEnabled: boolean;
  onEditDescription: (v: string) => void;
  onEditColumnId: (v: string) => void;
  onEditTypeId: (v: string) => void;
  onEditAssigneeId: (v: string) => void;
  onEditCustomField: (fieldId: string, value: unknown) => void;
  onDropFiles: (files: FileList | File[]) => Promise<void>;
  onUploadInputChange: (files: FileList | null) => Promise<void>;
  onDragState: (dragging: boolean) => void;
  onRemoveAttachment: (id: string) => Promise<void>;
  onPreviewDoc: (doc: DocumentPreviewState) => void;
  renderFieldValue: (value: unknown) => string;
  formatDate: (value: unknown) => string;
};

export type TaskClientPanelProps = {
  clientInfo: ClientInfo;
  clientSubPanel: ClientSubPanel;
  onClientSubPanel: (v: ClientSubPanel) => void;
  clientPanelChat: any[];
  clientChatError: string | null;
  clientMessage: string;
  onClientMessage: (v: string) => void;
  isPostingClientChat: boolean;
  onPostClientChat: () => void;
  clientInteractionList: any[];
  interactionKind: string;
  interactionTitle: string;
  interactionDetails: string;
  interactionOccurredAt: string;
  interactionError: string | null;
  isPostingInteraction: boolean;
  onInteractionKind: (v: string) => void;
  onInteractionTitle: (v: string) => void;
  onInteractionDetails: (v: string) => void;
  onInteractionOccurredAt: (v: string) => void;
  onSubmitInteraction: () => Promise<boolean>;
  onClearInteractionError: () => void;
};

export type TaskSidePanelsProps = {
  activePanel: TaskPanelType;
  board: Board;
  task: TaskRecord;
  apiBaseUrl: string;
  workspaceDocuments: Document[];
  documentsLoading: boolean;
  documentsError: string | null;
  onPreviewDoc: (doc: DocumentPreviewState) => void;
  assistantPanelChat: any[];
  assistantChatError: string | null;
  commentText: string;
  assistantMessage: string;
  isPostingComment: boolean;
  isPostingAssistant: boolean;
  onCommentText: (v: string) => void;
  onAssistantMessage: (v: string) => void;
  onPostComment: () => void;
  onPostAssistant: () => void;
};
