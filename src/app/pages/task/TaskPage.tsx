import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { boardsApi, documentsApi, tasksApi, usersApi } from '../../services/api';
import type { Board, Document, User } from '../../types';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../components/ui/resizable';
import { PANEL_SIZES, IFRAME_SIDEBAR_ICON, TASK_SIDEBAR_STATIC_ENTRIES, TASK_PAGE_RESIZABLE_STORAGE_ID, TASK_RESIZABLE_PANEL_IDS } from './constants';
import { useTaskDerived } from './hooks/useTaskDerived';
import { boardTimeTrackingIsConfigured } from '../../utils/boardTimeTracking';
import { renderCustomFieldValue } from './utils/customFieldValue';
import { formatTaskDate, toDatetimeLocalValue } from './utils/format';
import { mergeChatMessage, isLawyerClientChannelMessage } from './utils/chatMessages';
import { validateTaskEdits } from './utils/validateTaskEdits';
import type { TaskPanelType, TaskRecord, DocumentPreviewState, ClientSubPanel } from './types';
import { TaskPageHeader } from './components/TaskPageHeader';
import { TaskDetailsCard } from './components/TaskDetailsCard';
import { TaskMetaFooter } from './components/TaskMetaFooter';
import { TaskClientPanel } from './components/TaskClientPanel';
import { TaskSidePanels } from './components/TaskSidePanels';
import { TaskIframeServicePanel } from './components/TaskIframeServicePanel';
import { TaskIconRail } from './components/TaskIconRail';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';
import { getBoardIframeServices, parseIframePanelId, taskIframePanelId } from './utils/boardIframeServices';
import { useApp } from '../../store/AppContext';
import { getWsUrl } from '../../utils/wsUrl';

export function TaskPage() {
  const { currentUser } = useApp();
  const { taskId } = useParams();
  const taskIdRef = useRef<string | undefined>(taskId);
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
  const [assistantOptimistic, setAssistantOptimistic] = useState<{ id: string; content: string } | null>(
    null,
  );

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

  const boardIframeServices = useMemo(() => getBoardIframeServices(board), [board]);

  const sidebarRailEntries = useMemo(() => {
    const iframeEntries = boardIframeServices.map((s) => ({
      id: taskIframePanelId(s.id),
      icon: IFRAME_SIDEBAR_ICON,
      label:
        s.name.trim() ||
        (() => {
          try {
            return new URL(s.url.trim()).hostname;
          } catch {
            return 'Сервис';
          }
        })(),
    }));
    return [...TASK_SIDEBAR_STATIC_ENTRIES, ...iframeEntries];
  }, [boardIframeServices]);

  const iframeServiceForPanel = useMemo(() => {
    const sid = parseIframePanelId(activePanel);
    if (!sid) return undefined;
    return boardIframeServices.find((s) => s.id === sid);
  }, [activePanel, boardIframeServices]);

  useEffect(() => {
    const sid = parseIframePanelId(activePanel);
    if (!sid) return;
    if (!boardIframeServices.some((s) => s.id === sid)) {
      setActivePanel('comments');
    }
  }, [activePanel, boardIframeServices]);

  const assistantDisplayChat = useMemo(() => {
    const list = [...assistantPanelChat];
    if (assistantOptimistic) {
      list.push({
        id: assistantOptimistic.id,
        type: 'assistant',
        sender: 'user',
        content: assistantOptimistic.content,
        createdAt: new Date().toISOString(),
        user: currentUser
          ? { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar ?? null }
          : { id: 'local', name: 'Вы', avatar: null },
        _optimistic: true,
      });
    }
    if (isPostingAssistant && assistantOptimistic) {
      list.push({
        id: '__assistant_pending__',
        type: 'assistant',
        sender: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        _pendingLoader: true,
      });
    }
    return list;
  }, [assistantPanelChat, assistantOptimistic, isPostingAssistant, currentUser]);

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
    taskIdRef.current = taskId;
  }, [taskId]);

  /** Входящие сообщения клиента по каналу «чат с клиентом» приходят через WS; REST POST только подтверждает отправку. */
  useEffect(() => {
    if (!currentUser?.id || !taskId) return;

    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const handlePayload = (raw: unknown) => {
      if (!raw || typeof raw !== 'object') return;
      const data = raw as Record<string, unknown>;
      const tid = typeof data.taskId === 'string' ? data.taskId : '';
      if (!tid || tid !== taskIdRef.current) return;
      if (data.type !== 'chat_message') return;
      const msg = data.message as Record<string, unknown> | undefined;
      if (!msg || typeof msg.id !== 'string') return;
      if (!isLawyerClientChannelMessage(msg)) return;

      setTask((prev) => {
        if (!prev || prev.id !== tid) return prev;
        const list = Array.isArray(prev.chatMessages) ? prev.chatMessages : [];
        if (list.some((x: { id?: string }) => x.id === msg.id)) return prev;
        return mergeChatMessage(prev, msg);
      });
    };

    const connect = () => {
      if (cancelled) return;
      try {
        ws = new WebSocket(getWsUrl());
      } catch {
        reconnectTimer = window.setTimeout(connect, 4000);
        return;
      }

      ws.onmessage = (ev) => {
        try {
          handlePayload(JSON.parse(ev.data as string));
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        ws = null;
        reconnectTimer = window.setTimeout(connect, 4000);
      };

      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          /* ignore */
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      window.clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }, [currentUser?.id, taskId]);

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
    const optimisticId = `optimistic-${crypto.randomUUID()}`;
    setAssistantOptimistic({ id: optimisticId, content: text });
    setAssistantMessage('');
    setIsPostingAssistant(true);
    setAssistantChatError(null);
    try {
      const { userMessage, assistantMessage } = await tasksApi.postAssistantChat(taskId, text);
      setTask((prev) => {
        if (!prev) return prev;
        const withUser = mergeChatMessage(prev, userMessage as Record<string, unknown>);
        return mergeChatMessage(withUser, assistantMessage as Record<string, unknown>);
      });
      setAssistantOptimistic(null);
    } catch (e: any) {
      setAssistantChatError(e?.message || 'Не удалось отправить');
      setAssistantOptimistic(null);
      try {
        const fresh = (await tasksApi.getById(taskId)) as TaskRecord;
        setTask(fresh);
      } catch {
        /* ignore reload errors */
      }
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

  const submitClientInteraction = async (): Promise<boolean> => {
    if (!taskId) return false;
    const title = interactionTitle.trim();
    if (!title) {
      setInteractionError('Введите заголовок');
      return false;
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
      return true;
    } catch (e: any) {
      setInteractionError(e?.message || 'Не удалось сохранить');
      return false;
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
      editDescription,
      editColumnId,
      editTypeId,
      editCustomFields,
      taskFields,
      titleFieldId,
      descriptionFieldId,
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
    boardTimeTrackingEnabled: boardTimeTrackingIsConfigured(board),
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
                  onClearInteractionError={() => setInteractionError(null)}
                />
              ) : iframeServiceForPanel ? (
                <TaskIframeServicePanel service={iframeServiceForPanel} />
              ) : parseIframePanelId(activePanel) ? (
                <div className="flex h-full min-h-0 items-center justify-center p-4 text-center text-sm text-slate-500">
                  Сервис удалён из настроек доски или недоступен.
                </div>
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
                  assistantPanelChat={assistantDisplayChat}
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
              entries={sidebarRailEntries}
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
