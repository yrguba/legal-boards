import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { boardsApi, documentsApi, tasksApi, usersApi } from '../../services/api';
import type { Board, Document, User } from '../../types';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../components/ui/resizable';
import { PANEL_SIZES, IFRAME_SIDEBAR_ICON, TASK_SIDEBAR_STATIC_ENTRIES, TASK_PAGE_RESIZABLE_STORAGE_ID, TASK_RESIZABLE_PANEL_IDS } from './constants';
import { useTaskDerived } from './hooks/useTaskDerived';
import { boardTimeTrackingIsConfigured } from '../../utils/boardTimeTracking';
import { renderCustomFieldValue } from './utils/customFieldValue';
import { formatTaskDate, toDatetimeLocalValue } from './utils/format';
import { mergeChatMessage, isLawyerClientChannelMessage } from './utils/chatMessages';
import { encodeCommentMentionText, type CommentMentionInsert } from '../../utils/commentMentions';
import { setActiveTaskFocus } from '../../utils/activeTaskFocus';
import { useTaskFieldUpdate } from './hooks/useTaskFieldUpdate';
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
import { getBoardApprovalRules, mergeApprovalDecision, normalizeApprovalRow, type TaskColumnApprovalRow } from '../../utils/boardApprovals';
import { useColumnTransition } from '../../store/ColumnTransitionContext';
import {
  ForwardToBoardOfferDialog,
  prepareForwardToBoardOffer,
} from '../../components/ForwardToBoardOfferDialog';
import { TransferTaskModal } from '../../components/TransferTaskModal';
import type { TaskActivityItem } from '../../utils/activityLog';
import { useApp } from '../../store/AppContext';
import { useWorkspacePermissions } from '../../utils/workspacePermissions';
import { getWsUrl } from '../../utils/wsUrl';
import { taskPath } from '../../utils/taskUrls';
import { isExternalClientTask } from './utils/externalClientTask';
import { useFeatureTabsConfig } from '../../features/featureTabs/useFeatureTabsConfig';

export function TaskPage() {
  const { currentUser } = useApp();
  const { canManageWorkspace } = useWorkspacePermissions();
  const { documents: documentsTabEnabled } = useFeatureTabsConfig();
  const navigate = useNavigate();
  const { taskKey } = useParams();
  const activeTaskIdRef = useRef<string | undefined>(undefined);
  const [task, setTask] = useState<TaskRecord | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const [commentMentionInserts, setCommentMentionInserts] = useState<CommentMentionInsert[]>([]);
  const [commentComposeKey, setCommentComposeKey] = useState(0);
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

  const showClientPanel = isExternalClientTask(task);
  const showLexConclusionTab = showClientPanel;
  const [conclusionDraft, setConclusionDraft] = useState('');
  useEffect(() => {
    if (!task) {
      setConclusionDraft('');
      return;
    }
    const ct = task.conclusionText;
    setConclusionDraft(typeof ct === 'string' ? ct : '');
  }, [task?.id, task?.conclusionText]);

  useEffect(() => {
    if (!showClientPanel && clientSubPanel === 'conclusion') setClientSubPanel('chat');
  }, [showClientPanel, clientSubPanel]);

  useEffect(() => {
    if (!showClientPanel && activePanel === 'client') {
      setActivePanel('comments');
    }
  }, [showClientPanel, activePanel]);

  const [savingConclusion, setSavingConclusion] = useState(false);
  const [conclusionSaveError, setConclusionSaveError] = useState<string | null>(null);
  const [uploadingConclusionFile, setUploadingConclusionFile] = useState(false);
  const [conclusionUploadError, setConclusionUploadError] = useState<string | null>(null);
  const [approvingRuleId, setApprovingRuleId] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const { openColumnTransition } = useColumnTransition();
  const [transferOpen, setTransferOpen] = useState(false);
  const [forwardOffer, setForwardOffer] = useState<
    import('../../components/ForwardToBoardOfferDialog').ForwardToBoardOffer | null
  >(null);

  const canTransfer = canManageWorkspace;
  const [activityItems, setActivityItems] = useState<TaskActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

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
    conclusionAttachments,
  } = useTaskDerived(task, board, users);

  const boardIframeServices = useMemo(() => getBoardIframeServices(board), [board]);
  const approvalRules = useMemo(() => getBoardApprovalRules(board), [board]);
  const columnApprovals = useMemo(() => {
    const raw = Array.isArray(task?.columnApprovals) ? task!.columnApprovals! : [];
    return raw.map((row) => normalizeApprovalRow(row as TaskColumnApprovalRow));
  }, [task?.columnApprovals, task?.id]);

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
    const staticEntries = (showClientPanel
      ? TASK_SIDEBAR_STATIC_ENTRIES
      : TASK_SIDEBAR_STATIC_ENTRIES.filter((e) => e.id !== 'client')
    ).filter((e) => documentsTabEnabled || e.id !== 'documents');
    return [...staticEntries, ...iframeEntries];
  }, [boardIframeServices, showClientPanel, documentsTabEnabled]);

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

  const activeTaskId = task?.id ?? taskKey;

  useEffect(() => {
    if (!taskKey) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const loadedTask = (await tasksApi.getById(taskKey)) as TaskRecord;
        if (cancelled) return;
        setTask(loadedTask);
        const loadedBoard = await boardsApi.getById(loadedTask.boardId);
        if (cancelled) return;
        const workspaceUsers = loadedBoard.workspaceId
          ? await usersApi.getByWorkspace(loadedBoard.workspaceId)
          : await usersApi.getAll();
        if (cancelled) return;
        setBoard(loadedBoard);
        setUsers(workspaceUsers);
        if (loadedTask.key && loadedTask.key !== taskKey) {
          navigate(taskPath(loadedTask), { replace: true });
        }
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
  }, [taskKey, navigate]);

  useEffect(() => {
    activeTaskIdRef.current = task?.id ?? taskKey;
  }, [task?.id, taskKey]);

  useEffect(() => {
    setActiveTaskFocus(task?.id ?? null);
    return () => setActiveTaskFocus(null);
  }, [task?.id]);

  const loadActivity = useCallback(async () => {
    if (!activeTaskId) return;
    setActivityLoading(true);
    setActivityError(null);
    try {
      const res = await tasksApi.getActivity(activeTaskId);
      setActivityItems(res.items ?? []);
    } catch (e: unknown) {
      setActivityError(e instanceof Error ? e.message : 'Не удалось загрузить историю');
    } finally {
      setActivityLoading(false);
    }
  }, [activeTaskId]);

  const { savingField, fieldErrors, saveField, isFieldLocked } =
    useTaskFieldUpdate({
      task,
      board,
      taskFields,
      titleFieldId,
      descriptionFieldId,
      taskAttachments,
      conclusionDraft,
      approvalRules,
      columnApprovals,
      activeTaskId: task?.id ?? taskKey,
      setTask,
      openColumnTransition,
      loadActivity,
      onAfterColumnMove: (fromColumnId, toColumnId) => {
        if (!task?.id || !board) return;
        void prepareForwardToBoardOffer(board, task.id, fromColumnId, toColumnId).then((offer) => {
          if (offer) setForwardOffer(offer);
        });
      },
    });

  useEffect(() => {
    if (activePanel !== 'activity' || !activeTaskId) return;
    void loadActivity();
  }, [activePanel, activeTaskId, loadActivity]);

  /** Входящие сообщения клиента по каналу «чат с клиентом» приходят через WS; REST POST только подтверждает отправку. */
  useEffect(() => {
    if (!currentUser?.id || !activeTaskId) return;

    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const handlePayload = (raw: unknown) => {
      if (!raw || typeof raw !== 'object') return;
      const data = raw as Record<string, unknown>;
      const tid = typeof data.taskId === 'string' ? data.taskId : '';
      if (!tid || tid !== activeTaskIdRef.current) return;
      if (data.type !== 'chat_message') {
        if (data.type === 'task_approval_updated') {
          const approval = data.approval as TaskColumnApprovalRow | undefined;
          if (!approval || typeof approval.ruleId !== 'string') return;
          setTask((prev) => {
            if (!prev || prev.id !== tid) return prev;
            const list = Array.isArray(prev.columnApprovals) ? prev.columnApprovals : [];
            return { ...prev, columnApprovals: mergeApprovalDecision(list, approval) };
          });
        }
        return;
      }
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
  }, [currentUser?.id, activeTaskId]);

  useEffect(() => {
    if (documentsTabEnabled) return;
    if (activePanel === 'documents') setActivePanel('comments');
  }, [documentsTabEnabled, activePanel]);

  useEffect(() => {
    if (!board?.workspaceId || !documentsTabEnabled) return;
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
  }, [board?.workspaceId, documentsTabEnabled]);

  const postAssistantMessage = async () => {
    if (!activeTaskId) return;
    const text = assistantMessage.trim();
    if (!text) return;
    const optimisticId = `optimistic-${crypto.randomUUID()}`;
    setAssistantOptimistic({ id: optimisticId, content: text });
    setAssistantMessage('');
    setIsPostingAssistant(true);
    setAssistantChatError(null);
    try {
      const { userMessage, assistantMessage } = await tasksApi.postAssistantChat(activeTaskId, text);
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
        const fresh = (await tasksApi.getById(activeTaskId)) as TaskRecord;
        setTask(fresh);
      } catch {
        /* ignore reload errors */
      }
    } finally {
      setIsPostingAssistant(false);
    }
  };

  const postClientChat = async () => {
    if (!activeTaskId) return;
    const text = clientMessage.trim();
    if (!text) return;
    setIsPostingClientChat(true);
    setClientChatError(null);
    try {
      const created = await tasksApi.addChatMessage(activeTaskId, 'client', text, 'user');
      setTask((prev) => (prev ? mergeChatMessage(prev, created) : prev));
      setClientMessage('');
    } catch (e: any) {
      setClientChatError(e?.message || 'Не удалось отправить');
    } finally {
      setIsPostingClientChat(false);
    }
  };

  const submitClientInteraction = async (): Promise<boolean> => {
    if (!activeTaskId) return false;
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
      const created = await tasksApi.addClientInteraction(activeTaskId, {
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
    if (!activeTaskId) return;
    const content = encodeCommentMentionText(commentText.trim(), commentMentionInserts);
    if (!content) return;
    setIsPostingComment(true);
    try {
      const created = await tasksApi.addComment(activeTaskId, content);
      setTask((prev: any) => ({
        ...prev,
        comments: [created, ...(prev?.comments || [])],
      }));
      setCommentText('');
      setCommentMentionInserts([]);
      setCommentComposeKey((k) => k + 1);
      setActivePanel('comments');
    } finally {
      setIsPostingComment(false);
    }
  };

  const removeTaskAttachment = async (attachmentId: string) => {
    if (!activeTaskId) return;
    try {
      await tasksApi.deleteAttachment(activeTaskId, attachmentId);
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

  const saveConclusionTextHandler = async () => {
    if (!activeTaskId) return;
    setConclusionSaveError(null);
    setSavingConclusion(true);
    try {
      const trimmed = conclusionDraft.trim();
      const conclusionTextPayload = trimmed.length === 0 ? null : trimmed;
      const res = await tasksApi.patchTaskConclusion(activeTaskId, conclusionTextPayload);
      setTask((prev: TaskRecord | null) => (prev ? { ...prev, conclusionText: res.conclusionText } : prev));
    } catch (e: unknown) {
      setConclusionSaveError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSavingConclusion(false);
    }
  };

  const uploadConclusionFileHandler = async (file: File) => {
    if (!activeTaskId) return;
    setConclusionUploadError(null);
    setUploadingConclusionFile(true);
    try {
      const created = (await tasksApi.uploadAttachment(activeTaskId, file, {
        purpose: 'conclusion',
      })) as Record<string, unknown>;
      setTask((prev: any) => ({
        ...prev,
        taskAttachments: [created, ...(Array.isArray(prev?.taskAttachments) ? prev.taskAttachments : [])],
      }));
    } catch (e: unknown) {
      setConclusionUploadError(e instanceof Error ? e.message : 'Не удалось загрузить файл');
    } finally {
      setUploadingConclusionFile(false);
    }
  };

  const removeConclusionAttachment = async (attachmentId: string) => {
    if (!activeTaskId) return;
    try {
      await tasksApi.deleteAttachment(activeTaskId, attachmentId);
      setTask((prev: any) => ({
        ...prev,
        taskAttachments: (Array.isArray(prev?.taskAttachments) ? prev.taskAttachments : []).filter(
          (a: { id?: string }) => a.id !== attachmentId,
        ),
      }));
    } catch (e: unknown) {
      setConclusionUploadError(e instanceof Error ? e.message : 'Не удалось удалить файл');
    }
  };

  const handleUploadAttachment = async (file: File) => {
    if (!activeTaskId) return;
    setUploadingFile(true);
    setUploadError(null);
    try {
      const created = (await tasksApi.uploadAttachment(activeTaskId, file)) as Record<string, unknown>;
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

  const handleApproveRule = async (ruleId: string) => {
    if (!activeTaskId) return;
    setApprovalError(null);
    setApprovingRuleId(ruleId);
    try {
      const created = (await tasksApi.submitApproval(activeTaskId, ruleId, {
        action: 'approve',
      })) as TaskColumnApprovalRow;
      setTask((prev) => {
        if (!prev) return prev;
        const list = Array.isArray(prev.columnApprovals) ? prev.columnApprovals : [];
        return { ...prev, columnApprovals: mergeApprovalDecision(list, created) };
      });
      void loadActivity();
    } catch (e: unknown) {
      setApprovalError(e instanceof Error ? e.message : 'Не удалось согласовать');
      throw e;
    } finally {
      setApprovingRuleId(null);
    }
  };

  const handleRejectRule = async (ruleId: string, reason: string) => {
    if (!activeTaskId) return;
    setApprovalError(null);
    setApprovingRuleId(ruleId);
    try {
      const created = (await tasksApi.submitApproval(activeTaskId, ruleId, {
        action: 'reject',
        reason,
      })) as TaskColumnApprovalRow;
      setTask((prev) => {
        if (!prev) return prev;
        const list = Array.isArray(prev.columnApprovals) ? prev.columnApprovals : [];
        return { ...prev, columnApprovals: mergeApprovalDecision(list, created) };
      });
      void loadActivity();
    } catch (e: unknown) {
      setApprovalError(e instanceof Error ? e.message : 'Не удалось отклонить');
      throw e;
    } finally {
      setApprovingRuleId(null);
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
    savingField,
    fieldErrors,
    isFieldLocked,
    onSaveField: saveField,
    taskAttachments,
    apiBaseUrl,
    uploadingFile,
    uploadError,
    isDraggingFile,
    attachmentsEnabled: board.attachmentsEnabled !== false,
    boardTimeTrackingEnabled: boardTimeTrackingIsConfigured(board),
    approvalRules,
    columnApprovals,
    currentUserId: currentUser?.id,
    approvingRuleId,
    approvalError,
    onApproveRule: handleApproveRule,
    onRejectRule: handleRejectRule,
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
    onPlacementsChange: (placements) => {
      setTask((prev) => (prev ? { ...prev, boardPlacements: placements } : prev));
    },
  };

  return (
    <div className="h-full flex flex-col">
      <TaskPageHeader
        boardCodeOrId={((board as any).code || board.id) as string}
        title={task.title}
        savingField={savingField}
        fieldError={fieldErrors.title ?? null}
        titleLocked={isFieldLocked('title')}
        onSaveTitle={(v) => saveField('title', v)}
        canTransfer={canTransfer}
        onTransfer={() => setTransferOpen(true)}
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
                  showLexConclusionTab={showLexConclusionTab}
                  conclusionAttachments={conclusionAttachments}
                  conclusionDraft={conclusionDraft}
                  onConclusionDraft={setConclusionDraft}
                  savingConclusion={savingConclusion}
                  conclusionSaveError={conclusionSaveError}
                  onSaveConclusion={saveConclusionTextHandler}
                  uploadingConclusionFile={uploadingConclusionFile}
                  conclusionUploadError={conclusionUploadError}
                  onUploadConclusionFile={uploadConclusionFileHandler}
                  onRemoveConclusionAttachment={removeConclusionAttachment}
                  apiBaseUrl={apiBaseUrl}
                  onPreviewConclusionAttachment={(doc) => setPreviewDoc(doc)}
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
                  activityItems={activityItems}
                  activityLoading={activityLoading}
                  activityError={activityError}
                  onPreviewDoc={setPreviewDoc}
                  assistantPanelChat={assistantDisplayChat}
                  assistantChatError={assistantChatError}
                  commentText={commentText}
                  commentComposeKey={commentComposeKey}
                  assistantMessage={assistantMessage}
                  isPostingComment={isPostingComment}
                  isPostingAssistant={isPostingAssistant}
                  onCommentText={setCommentText}
                  onCommentMentionInsertsChange={setCommentMentionInserts}
                  onAssistantMessage={setAssistantMessage}
                  onPostComment={postComment}
                  onPostAssistant={postAssistantMessage}
                  users={users}
                  currentUserId={currentUser?.id}
                  commentMentionInserts={commentMentionInserts}
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

      <ForwardToBoardOfferDialog
        offer={forwardOffer}
        onClose={() => setForwardOffer(null)}
        onAdded={() => {
          if (!task?.id) return;
          void tasksApi.getById(task.id).then((fresh) => setTask(fresh as TaskRecord));
        }}
      />

      {board && task && canTransfer ? (
        <TransferTaskModal
          open={transferOpen}
          sourceBoard={board}
          taskIds={[task.id]}
          onClose={() => setTransferOpen(false)}
          onSuccess={(result) => {
            if (result.mode === 'mirror') {
              void tasksApi.getById(task.id).then((fresh) => setTask(fresh as TaskRecord));
              setTransferOpen(false);
              return;
            }
            const moved = result.moved[0];
            if (moved?.newKey && moved.newKey !== moved.oldKey) {
              navigate(taskPath({ key: moved.newKey, id: task.id }), { replace: true });
            } else if (result.skipped[0]) {
              setError(result.skipped[0].reason);
            }
            setTransferOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
