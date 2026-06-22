import type { Board, Document, TaskField, User } from '../../types';

export type TaskPanelType =
  | 'client'
  | 'assistant'
  | 'comments'
  | 'documents'
  | 'activity'
  | `iframe:${string}`;

export type ClientSubPanel = 'chat' | 'history' | 'conclusion';

/** Задача с вложениями и связями с API (расширенный ответ getById) */
export type TaskRecord = Record<string, any> & {
  id: string;
  title: string;
  boardId: string;
  columnId: string;
  typeId: string;
  conclusionText?: string | null;
  priority?: string;
  customFields?: Record<string, unknown>;
  taskAttachments?: unknown[];
  comments?: unknown[];
  chatMessages?: unknown[];
  clientInteractions?: unknown[];
  columnApprovals?: import('../../utils/boardApprovals').TaskColumnApprovalRow[];
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
  savingField: import('./utils/validateField').InlineFieldKey | null;
  fieldErrors: Partial<Record<import('./utils/validateField').InlineFieldKey, string>>;
  isFieldLocked: (key: import('./utils/validateField').InlineFieldKey) => boolean;
  onSaveField: (key: import('./utils/validateField').InlineFieldKey, value: unknown) => Promise<void>;
  taskAttachments: Record<string, unknown>[];
  apiBaseUrl: string;
  uploadingFile: boolean;
  uploadError: string | null;
  isDraggingFile: boolean;
  attachmentsEnabled: boolean;
  /** Контроль времени доски включён (старт и финиш заданы) */
  boardTimeTrackingEnabled: boolean;
  approvalRules: import('../../features/board-settings/boardAdvancedSettings.types').BoardApprovalRule[];
  columnApprovals: import('../../utils/boardApprovals').TaskColumnApprovalRow[];
  currentUserId: string | undefined;
  approvingRuleId: string | null;
  approvalError: string | null;
  onApproveRule: (ruleId: string) => void;
  onRejectRule: (ruleId: string, reason: string) => void;
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
  /** Вкладка «Заключение» только для задач LEXPRO-клиента */
  showLexConclusionTab?: boolean;
  conclusionAttachments?: Record<string, unknown>[];
  conclusionDraft: string;
  onConclusionDraft: (value: string) => void;
  savingConclusion: boolean;
  conclusionSaveError: string | null;
  onSaveConclusion: () => void;
  uploadingConclusionFile: boolean;
  conclusionUploadError: string | null;
  onUploadConclusionFile: (file: File) => void;
  onRemoveConclusionAttachment: (id: string) => void;
  apiBaseUrl: string;
  onPreviewConclusionAttachment: (doc: DocumentPreviewState) => void;
};

export type TaskSidePanelsProps = {
  activePanel: TaskPanelType;
  board: Board;
  task: TaskRecord;
  apiBaseUrl: string;
  workspaceDocuments: Document[];
  documentsLoading: boolean;
  documentsError: string | null;
  activityItems: import('../../utils/activityLog').TaskActivityItem[];
  activityLoading: boolean;
  activityError: string | null;
  onPreviewDoc: (doc: DocumentPreviewState) => void;
  assistantPanelChat: any[];
  assistantChatError: string | null;
  commentText: string;
  assistantMessage: string;
  isPostingComment: boolean;
  isPostingAssistant: boolean;
  attachmentsEnabled: boolean;
  pendingCommentFiles: File[];
  onCommentText: (v: string) => void;
  onAssistantMessage: (v: string) => void;
  onAddCommentFiles: (files: FileList | File[]) => void;
  onRemoveCommentFile: (index: number) => void;
  onPostComment: () => void;
  onPostAssistant: () => void;
};
