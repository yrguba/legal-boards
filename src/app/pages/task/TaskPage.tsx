import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { boardsApi, documentsApi, tasksApi, usersApi } from '../../services/api';
import type { Board, Document, User } from '../../types';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../components/ui/resizable';
import { PANEL_SIZES, TASK_PAGE_RESIZABLE_STORAGE_ID, TASK_RESIZABLE_PANEL_IDS } from './constants';
import { useTaskDerived } from './hooks/useTaskDerived';
import { renderCustomFieldValue } from './utils/customFieldValue';
import { formatTaskDate, toDatetimeLocalValue } from './utils/format';
import { mergeChatMessage } from './utils/chatMessages';
import { validateTaskEdits } from './utils/validateTaskEdits';
import type { TaskPanelType, TaskRecord, DocumentPreviewState, ClientSubPanel } from './types';
import { TaskPageHeader } from './components/TaskPageHeader';
import { TaskDetailsCard } from './components/TaskDetailsCard';
import { TaskMetaFooter } from './components/TaskMetaFooter';
import { TaskClientPanel } from './components/TaskClientPanel';
import { TaskSidePanels } from './components/TaskSidePanels';
import { TaskIconRail } from './components/TaskIconRail';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';

export function TaskPage() {
  const { taskId } = useParams();
  const [task, setTask] = useState<TaskRecord | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColumnId, setEditColumnId] = useState('');
  const [editTypeId, setEditTypeId] = useState('');
  const [editAssigneeId, setEditAssigneeId] = useState('');
  const [editCustomFields, setEditCustomFields] = useState<Record<string, unknown>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activePanel, setActivePanel] = useState<TaskPanelType>('comments');
  const [clientSubPanel, setClientSubPanel] = useState<ClientSubPanel>('chat');
  const [assistantMessage, setAssistantMessage] = useState('');
  const [clientMessage, setClientMessage] = useState('');
  const [isPostingClientChat, setIsPostingClientChat] = useState(false);
  const [clientChatError, setClientChatError] = useState<string | null>(null);
  const [isPostingAssistant, setIsPostingAssistant] = useState(false);
  const [assistantChatError, setAssistantChatError] = useState<string | null>(null);
  const [interactionKind, setInteractionKind] = useState('note');
  const [interactionTitle, setInteractionTitle] = useState('');
  const [interactionDetails, setInteractionDetails] = useState('');
  const [interactionOccurredAt, setInteractionOccurredAt] = useState(() =>
    toDatetimeLocalValue(new Date()),
  );
  const [isPostingInteraction, setIsPostingInteraction] = useState(false);
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [workspaceDocuments, setWorkspaceDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentPreviewState | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const {
    apiBaseUrl,
    taskFields,
    titleFieldId,
    descriptionFieldId,
    taskType,
    assignee,
    creator,
    column,
    clientInfo,
    clientPanelChat,
    assistantPanelChat,
    clientInteractionList,
    taskAttachments,
  } = useTaskDerived(task, board, users);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const loadedTask = (await tasksApi.getById(taskId)) as TaskRecord;
        if (cancelled) return;
        setTask(loadedTask);
        const [loadedBoard, allUsers] = await Promise.all([
          boardsApi.getById(loadedTask.boardId),
          usersApi.getAll(),
        ]);
        if (cancelled) return;
        setBoard(loadedBoard);
        setUsers(allUsers);
        setIsEditing(false);
        setEditTitle(loadedTask.title || '');
        setEditDescription(loadedTask.description || '');
        setEditColumnId(loadedTask.columnId);
        setEditTypeId(loadedTask.typeId);
        setEditAssigneeId(loadedTask.assigneeId || '');
        setEditCustomFields(loadedTask.customFields || {});
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Не удалось загрузить задачу');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    if (!board?.workspaceId) return;
    let cancelled = false;
    (async () => {
      setDocumentsLoading(true);
      setDocumentsError(null);
      try {
        const list = await documentsApi.getByWorkspace(board.workspaceId);
        if (!cancelled) setWorkspaceDocuments(list as Document[]);
      } catch (e: unknown) {
        if (!cancelled) {
          setDocumentsError(e instanceof Error ? e.message : 'Не удалось загрузить документы');
        }
      } finally {
        if (!cancelled) setDocumentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [board?.workspaceId]);

  const postAssistantMessage = async () => {
    if (!taskId) return;
    const text = assistantMessage.trim();
    if (!text) return;
    setIsPostingAssistant(true);
    setAssistantChatError(null);
    try {
      const created = await tasksApi.addChatMessage(taskId, 'assistant', text, 'user');
      setTask((prev) => (prev ? mergeChatMessage(prev, created) : prev));
      setAssistantMessage('');
    } catch (e: any) {
      setAssistantChatError(e?.message || 'Не удалось отправить');
    } finally {
      setIsPostingAssistant(false);
    }
  };

  const postClientChat = async () => {
    if (!taskId) return;
    const text = clientMessage.trim();
    if (!text) return;
    setIsPostingClientChat(true);
    setClientChatError(null);
    try {
      const created = await tasksApi.addChatMessage(taskId, 'client', text, 'user');
      setTask((prev) => (prev ? mergeChatMessage(prev, created) : prev));
      setClientMessage('');
    } catch (e: any) {
      setClientChatError(e?.message || 'Не удалось отправить');
    } finally {
      setIsPostingClientChat(false);
    }
  };

  const submitClientInteraction = async () => {
    if (!taskId) return;
    const title = interactionTitle.trim();
    if (!title) {
      setInteractionError('Введите заголовок');
      return;
    }
    setIsPostingInteraction(true);
    setInteractionError(null);
    try {
      const at = interactionOccurredAt
        ? new Date(interactionOccurredAt).toISOString()
        : new Date().toISOString();
      const created = await tasksApi.addClientInteraction(taskId, {
        kind: interactionKind,
        title,
        details: interactionDetails.trim() || undefined,
        occurredAt: at,
      });
      setTask((prev: any) => ({
        ...prev,
        clientInteractions: [created, ...(Array.isArray(prev?.clientInteractions) ? prev.clientInteractions : [])],
      }));
      setInteractionTitle('');
      setInteractionDetails('');
      setInteractionKind('note');
      setInteractionOccurredAt(toDatetimeLocalValue(new Date()));
    } catch (e: any) {
      setInteractionError(e?.message || 'Не удалось сохранить');
    } finally {
      setIsPostingInteraction(false);
    }
  };

  const postComment = async () => {
    if (!taskId) return;
    const content = commentText.trim();
    if (!content) return;
    setIsPostingComment(true);
    try {
      const created = await tasksApi.addComment(taskId, content);
      setTask((prev: any) => ({
        ...prev,
        comments: [created, ...(prev?.comments || [])],
      }));
      setCommentText('');
      setActivePanel('comments');
    } finally {
      setIsPostingComment(false);
    }
  };

  const removeTaskAttachment = async (attachmentId: string) => {
    if (!taskId) return;
    try {
      await tasksApi.deleteAttachment(taskId, attachmentId);
      setTask((prev: any) => ({
        ...prev,
        taskAttachments: (Array.isArray(prev?.taskAttachments) ? prev.taskAttachments : []).filter(
          (a: { id?: string }) => a.id !== attachmentId,
        ),
      }));
    } catch (e: any) {
      setUploadError(e?.message || 'Не удалось удалить вложение');
    }
  };

  const handleUploadAttachment = async (file: File) => {
    if (!taskId) return;
    setUploadingFile(true);
    setUploadError(null);
    try {
      const created = (await tasksApi.uploadAttachment(taskId, file)) as Record<string, unknown>;
      setTask((prev: any) => ({
        ...prev,
        taskAttachments: [created, ...(Array.isArray(prev?.taskAttachments) ? prev.taskAttachments : [])],
      }));
    } catch (e: any) {
      setUploadError(e?.message || 'Не удалось загрузить файл');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDropFiles = async (files: FileList | File[]) => {
    const file = Array.isArray(files) ? files[0] : files.item(0);
    if (!file) return;
    await handleUploadAttachment(file);
  };

  const cancelEditing = () => {
    if (!task) return;
    setSaveError(null);
    setIsEditing(false);
    setEditTitle(task.title || '');
    setEditDescription(task.description || '');
    setEditColumnId(task.columnId);
    setEditTypeId(task.typeId);
    setEditAssigneeId(task.assigneeId || '');
    setEditCustomFields(task.customFields || {});
  };

  const saveEdits = async () => {
    if (!taskId) return;
    setSaveError(null);
    const validationError = validateTaskEdits(
      editTitle,
      editColumnId,
      editTypeId,
      editCustomFields,
      taskFields,
    );
    if (validationError) {
      setSaveError(validationError);
      return;
    }
    setIsSaving(true);
    try {
      const updated = await tasksApi.update(taskId, {
        columnId: editColumnId,
        typeId: editTypeId,
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        assigneeId: editAssigneeId || null,
        customFields: editCustomFields,
      });
      setTask((prev: any) => ({ ...prev, ...updated }));
      setIsEditing(false);
    } catch (e: any) {
      setSaveError(e?.message || 'Не удалось сохранить изменения');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <div className="text-sm text-slate-600">Загрузка задачи…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900">Задача не найдена</h2>
        </div>
      </div>
    );
  }

  if (!task || !board) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900">Задача не найдена</h2>
        </div>
      </div>
    );
  }

  const mainColumnProps = {
    task,
    board,
    users,
    taskFields,
    titleFieldId,
    descriptionFieldId,
    taskType,
    assignee,
    creator,
    column,
    isEditing,
    editDescription,
    editColumnId,
    editTypeId,
    editAssigneeId,
    editCustomFields,
    saveError,
    taskAttachments,
    apiBaseUrl,
    uploadingFile,
    uploadError,
    isDraggingFile,
    attachmentsEnabled: board.attachmentsEnabled !== false,
    onEditDescription: setEditDescription,
    onEditColumnId: setEditColumnId,
    onEditTypeId: setEditTypeId,
    onEditAssigneeId: setEditAssigneeId,
    onEditCustomField: (fieldId: string, value: unknown) =>
      setEditCustomFields((p) => ({ ...p, [fieldId]: value })),
    onDropFiles: handleDropFiles,
    onUploadInputChange: async (files: FileList | null) => {
      const file = files?.[0];
      if (file) await handleDropFiles(files);
    },
    onDragState: setIsDraggingFile,
    onRemoveAttachment: removeTaskAttachment,
    onPreviewDoc: setPreviewDoc,
    renderFieldValue: renderCustomFieldValue,
    formatDate: formatTaskDate,
  };

  return (
    <div className="h-full flex flex-col">
      <TaskPageHeader
        boardCodeOrId={((board as any).code || board.id) as string}
        title={isEditing ? editTitle : task.title}
        isEditing={isEditing}
        isSaving={isSaving}
        onEditTitle={setEditTitle}
        onStartEdit={() => {
          setSaveError(null);
          setIsEditing(true);
        }}
        onCancelEdit={cancelEditing}
        onSave={saveEdits}
      />

      <ResizablePanelGroup
        direction="horizontal"
        autoSaveId={TASK_PAGE_RESIZABLE_STORAGE_ID}
        className="flex min-h-0 flex-1"
      >
        <ResizablePanel
          defaultSize={PANEL_SIZES.main.default}
          minSize={PANEL_SIZES.main.min}
          className="min-w-0"
          id={TASK_RESIZABLE_PANEL_IDS.main}
        >
          <div className="h-full overflow-y-auto p-6">
            <div className="max-w-3xl">
              <TaskDetailsCard {...mainColumnProps} />
              <TaskMetaFooter
                creatorName={creator?.name}
                createdAt={task.createdAt}
                updatedAt={task.updatedAt}
              />
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle className="w-1.5 shrink-0 bg-slate-200" />
        <ResizablePanel
          defaultSize={PANEL_SIZES.sidebar.default}
          minSize={PANEL_SIZES.sidebar.min}
          maxSize={PANEL_SIZES.sidebar.max}
          className="min-w-0 !flex h-full min-h-0"
          id={TASK_RESIZABLE_PANEL_IDS.sidebar}
        >
          <div className="flex h-full w-full min-w-0 flex-row bg-white">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {activePanel === 'client' ? (
                <TaskClientPanel
                  clientInfo={clientInfo}
                  clientSubPanel={clientSubPanel}
                  onClientSubPanel={setClientSubPanel}
                  clientPanelChat={clientPanelChat}
                  clientChatError={clientChatError}
                  clientMessage={clientMessage}
                  onClientMessage={setClientMessage}
                  isPostingClientChat={isPostingClientChat}
                  onPostClientChat={postClientChat}
                  clientInteractionList={clientInteractionList}
                  interactionKind={interactionKind}
                  interactionTitle={interactionTitle}
                  interactionDetails={interactionDetails}
                  interactionOccurredAt={interactionOccurredAt}
                  interactionError={interactionError}
                  isPostingInteraction={isPostingInteraction}
                  onInteractionKind={setInteractionKind}
                  onInteractionTitle={setInteractionTitle}
                  onInteractionDetails={setInteractionDetails}
                  onInteractionOccurredAt={setInteractionOccurredAt}
                  onSubmitInteraction={submitClientInteraction}
                />
              ) : (
                <TaskSidePanels
                  activePanel={activePanel}
                  board={board}
                  task={task}
                  apiBaseUrl={apiBaseUrl}
                  workspaceDocuments={workspaceDocuments}
                  documentsLoading={documentsLoading}
                  documentsError={documentsError}
                  onPreviewDoc={setPreviewDoc}
                  assistantPanelChat={assistantPanelChat}
                  assistantChatError={assistantChatError}
                  commentText={commentText}
                  assistantMessage={assistantMessage}
                  isPostingComment={isPostingComment}
                  isPostingAssistant={isPostingAssistant}
                  onCommentText={setCommentText}
                  onAssistantMessage={setAssistantMessage}
                  onPostComment={postComment}
                  onPostAssistant={postAssistantMessage}
                />
              )}
            </div>
            <TaskIconRail
              activePanel={activePanel}
              onSelect={(id) => {
                setActivePanel(id);
                if (id === 'client') setClientSubPanel('chat');
              }}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <DocumentPreviewModal preview={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
}
