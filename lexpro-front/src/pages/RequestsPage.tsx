import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  LogOut,
  MessagesSquare,
  Paperclip,
  Phone,
  Scale,
  ScrollText,
  LayoutList,
} from 'lucide-react';
import {
  boardsApi,
  getApiBaseUrl,
  tasksApi,
  workspacesApi,
  type BoardDetail,
  type TaskDetail,
  type TaskChatMessage,
  type TaskListItem,
} from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { filePublicUrl } from '@/utils/storageUrl';
import { getWsUrl } from '@/utils/wsUrl';

export type BoardWithWorkspace = {
  id: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
};

function formatRequestRef(task: TaskListItem): string {
  const d = new Date(task.createdAt);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const suf = task.id.replace(/-/g, '').slice(-6).toUpperCase();
  return `№ ${y}-${m}-${day}-${suf}`;
}

function formatRuDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function statusDotClass(columnName: string): string {
  const n = columnName.toLowerCase();
  if (n.includes('заверш') || n.includes('done') || n.includes('готов')) return 'bg-emerald-500';
  if (n.includes('рассмотр') || n.includes('ожид') || n.includes('нов')) return 'bg-amber-500';
  return 'bg-brand';
}

function fmtBytes(n?: number): string {
  if (n == null || Number.isNaN(n)) return '—';
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
}

function sortChatByCreatedAt(messages: TaskChatMessage[]): TaskChatMessage[] {
  return [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

/** Переписка юрист↔клиент в канале задачи (не Groq-ассистент). */
function isLawyerClientChannelMessage(m: unknown): boolean {
  if (!m || typeof m !== 'object') return false;
  const r = m as Record<string, unknown>;
  const t = String(r.type ?? '').trim().toLowerCase();
  if (t === 'assistant') return false;
  if (String(r.sender ?? '').trim().toLowerCase() === 'assistant') return false;
  if (t === 'client') return true;
  const fromLex = typeof r.lexClientUserId === 'string' && r.lexClientUserId.length > 0;
  const fromStaff = typeof r.userId === 'string' && r.userId.length > 0;
  return fromLex || fromStaff;
}

/** Не терять сообщения из WebSocket, если ответ GET был сформирован раньше нового сообщения. */
function mergeChatMessagesForLexTask(
  activeTaskId: string,
  fetched: TaskDetail,
  prev: TaskDetail | null,
  pendingRef: MutableRefObject<Map<string, TaskChatMessage[]>>,
): TaskDetail {
  if (fetched.id !== activeTaskId) {
    return prev ?? fetched;
  }
  const serverMsgs = [...(fetched.chatMessages ?? [])];
  const byId = new Map(serverMsgs.map((m) => [m.id, m]));

  if (prev?.id === activeTaskId && prev.chatMessages) {
    for (const m of prev.chatMessages) {
      if (isLawyerClientChannelMessage(m) && !byId.has(m.id)) {
        serverMsgs.push(m);
        byId.set(m.id, m);
      }
    }
  }

  const pending = pendingRef.current.get(activeTaskId) ?? [];
  pendingRef.current.delete(activeTaskId);
  for (const p of pending) {
    if (!byId.has(p.id)) {
      serverMsgs.push(p);
      byId.set(p.id, p);
    }
  }

  return { ...fetched, chatMessages: sortChatByCreatedAt(serverMsgs as TaskChatMessage[]) };
}

type TabKey = 'details' | 'contacts' | 'history' | 'chat';

export function RequestsPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { user, logout, ready: authReady } = useAuth();
  const listEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);

  /** Все доски по всем пространствам (для подписей и модалки создания) */
  const [allBoardOptions, setAllBoardOptions] = useState<BoardWithWorkspace[]>([]);
  /** columnId → имя колонки в рамках доски boardId */
  const [columnMaps, setColumnMaps] = useState<Record<string, Record<string, string>>>({});

  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [pageError, setPageError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);

  const [tab, setTab] = useState<TabKey>('details');
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);

  const [statusHistory, setStatusHistory] = useState<Array<{ message: string; createdAt: string }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [chatUnread, setChatUnread] = useState(false);
  const [historyUnread, setHistoryUnread] = useState(false);

  const taskIdRef = useRef<string | undefined>(undefined);
  const detailSeqRef = useRef(0);
  const tabRef = useRef<TabKey>('details');
  /** Сообщения WS до прихода карточки или параллельно со stale GET */
  const pendingWsChatRef = useRef<Map<string, TaskChatMessage[]>>(new Map());

  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const apiBase = useMemo(() => getApiBaseUrl(), []);

  useEffect(() => {
    taskIdRef.current = taskId;
  }, [taskId]);

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    if (!taskId) {
      pendingWsChatRef.current.clear();
      return;
    }
    for (const k of [...pendingWsChatRef.current.keys()]) {
      if (k !== taskId) pendingWsChatRef.current.delete(k);
    }
  }, [taskId]);

  useEffect(() => {
    setChatUnread(false);
    setHistoryUnread(false);
  }, [taskId]);

  useEffect(() => {
    if (tab === 'chat') setChatUnread(false);
  }, [tab]);

  useEffect(() => {
    if (tab === 'history') setHistoryUnread(false);
  }, [tab]);

  useEffect(() => {
    const lexUserId = user?.id;
    if (!lexUserId || !authReady) return;

    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const handlePayload = (raw: unknown) => {
      if (!raw || typeof raw !== 'object') return;
      const data = raw as Record<string, unknown>;
      const tid = typeof data.taskId === 'string' ? data.taskId : '';
      if (!tid || tid !== taskIdRef.current) return;

      if (data.type === 'chat_message') {
        if (String(data.lexCreatorId ?? '') !== String(lexUserId)) return;
        const msg = data.message as Record<string, unknown> | undefined;
        if (!msg || typeof msg.id !== 'string' || !isLawyerClientChannelMessage(msg)) return;

        const incoming = msg as unknown as TaskChatMessage;

        setTaskDetail((prev) => {
          if (!prev || prev.id !== tid) {
            if (taskIdRef.current === tid) {
              const map = pendingWsChatRef.current;
              const list = map.get(tid) ?? [];
              if (!list.some((x) => x.id === incoming.id)) {
                list.push(incoming);
                map.set(tid, list);
              }
            }
            return prev;
          }
          const msgs = prev.chatMessages ?? [];
          if (msgs.some((x) => x.id === incoming.id)) return prev;
          return {
            ...prev,
            chatMessages: sortChatByCreatedAt([...msgs, incoming]),
          };
        });

        const authorUserId = data.authorUserId;
        const fromStaff = typeof authorUserId === 'string' && authorUserId.length > 0;
        if (fromStaff && tabRef.current !== 'chat') {
          setChatUnread(true);
        }
        return;
      }

      if (data.type === 'task_status_history') {
        if (String(data.lexCreatorId ?? '') !== String(lexUserId)) return;
        const entry = data.entry as { message?: unknown; createdAt?: unknown } | undefined;
        const message =
          typeof entry?.message === 'string' ? entry.message : '';
        const createdAt =
          typeof entry?.createdAt === 'string' ? entry.createdAt : '';
        if (!message || !createdAt) return;

        setStatusHistory((prev) => {
          if (prev.some((h) => h.message === message)) return prev;
          const next = [...prev, { message, createdAt }];
          next.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
          return next;
        });

        if (tabRef.current !== 'history') {
          setHistoryUnread(true);
        }
      }
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
  }, [user?.id, authReady]);

  const boardMetaForDetail = useMemo(() => {
    if (!taskDetail) return null;
    return allBoardOptions.find((b) => b.id === taskDetail.boardId) ?? null;
  }, [taskDetail, allBoardOptions]);

  const getColumnName = useCallback(
    (boardId: string, columnId: string) => columnMaps[boardId]?.[columnId] ?? '—',
    [columnMaps],
  );

  const reloadTasks = useCallback(async () => {
    if (!allBoardOptions.length) {
      setTasks([]);
      return [];
    }
    const maps: Record<string, Record<string, string>> = {};
    const chunks = await Promise.all(
      allBoardOptions.map(async (meta) => {
        const [detail, list] = await Promise.all([
          boardsApi.getById(meta.id),
          tasksApi.getByBoard(meta.id),
        ]);
        const colRecord: Record<string, string> = {};
        detail.columns.forEach((c) => {
          colRecord[c.id] = c.name;
        });
        maps[meta.id] = colRecord;
        return list;
      }),
    );
    setColumnMaps(maps);
    const merged = chunks
      .flat()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setTasks(merged);
    return merged;
  }, [allBoardOptions]);

  /* Загрузка списков досок и задач по всем пространствам */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setListLoading(true);
      setPageError(null);
      try {
        const wsList = await workspacesApi.getAll();
        if (cancelled) return;

        const boardSummaries: BoardWithWorkspace[] = [];
        for (const ws of wsList) {
          const br = await boardsApi.getByWorkspace(ws.id);
          if (cancelled) return;
          for (const b of br) {
            boardSummaries.push({
              id: b.id,
              name: b.name,
              workspaceId: ws.id,
              workspaceName: ws.name,
            });
          }
        }
        setAllBoardOptions(boardSummaries);

        if (!boardSummaries.length) {
          setColumnMaps({});
          setTasks([]);
          return;
        }

        const maps: Record<string, Record<string, string>> = {};
        const taskChunks = await Promise.all(
          boardSummaries.map(async (meta) => {
            const [detail, list] = await Promise.all([
              boardsApi.getById(meta.id),
              tasksApi.getByBoard(meta.id),
            ]);
            if (cancelled) return [] as TaskListItem[];
            const colRecord: Record<string, string> = {};
            detail.columns.forEach((c) => {
              colRecord[c.id] = c.name;
            });
            maps[meta.id] = colRecord;
            return list;
          }),
        );
        if (cancelled) return;
        setColumnMaps(maps);
        const merged = taskChunks
          .flat()
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTasks(merged);
      } catch (e: unknown) {
        if (!cancelled)
          setPageError(e instanceof Error ? e.message : 'Не удалось загрузить данные');
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* выбор задачи в URL */
  useEffect(() => {
    if (!tasks.length) {
      if (taskId) navigate('/', { replace: true });
      return;
    }
    if (!taskId) {
      navigate(`/r/${tasks[0].id}`, { replace: true });
      return;
    }
    if (!tasks.some((t) => t.id === taskId)) {
      navigate(`/r/${tasks[0].id}`, { replace: true });
    }
  }, [tasks, taskId, navigate]);

  /* детали задачи */
  useEffect(() => {
    if (!taskId) {
      setTaskDetail(null);
      return;
    }
    const seq = ++detailSeqRef.current;
    let cancelled = false;
    setDetailLoading(true);
    tasksApi
      .getById(taskId)
      .then((t) => {
        if (cancelled || seq !== detailSeqRef.current || t.id !== taskId) return;
        setTaskDetail((prev) => mergeChatMessagesForLexTask(taskId, t, prev, pendingWsChatRef));
      })
      .catch(() => {
        if (!cancelled && seq === detailSeqRef.current) setTaskDetail(null);
      })
      .finally(() => {
        if (!cancelled && seq === detailSeqRef.current) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    setUploadError(null);
  }, [taskId]);

  useEffect(() => {
    if (!taskId) {
      setStatusHistory([]);
      setHistoryError(null);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    tasksApi
      .getStatusHistory(taskId)
      .then((rows) => {
        if (!cancelled) setStatusHistory(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setHistoryError(e instanceof Error ? e.message : 'Не удалось загрузить историю');
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const refreshDetail = useCallback(async () => {
    if (!taskId) return;
    const seq = detailSeqRef.current;
    try {
      const t = await tasksApi.getById(taskId);
      if (seq !== detailSeqRef.current || t.id !== taskId) return;
      setTaskDetail((prev) => mergeChatMessagesForLexTask(taskId, t, prev, pendingWsChatRef));
    } catch {
      /* интервал опроса не должен ломать UI */
    }
  }, [taskId]);

  const handlePostClientChat = async (e: FormEvent) => {
    e.preventDefault();
    if (!taskId || !chatDraft.trim()) return;
    setChatSending(true);
    try {
      await tasksApi.addChatMessage(taskId, 'client', chatDraft.trim(), 'user');
      setChatDraft('');
      await refreshDetail();
      await reloadTasks();
    } finally {
      setChatSending(false);
    }
  };

  const scrollListToEnd = () => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollChatToEnd = useCallback(() => {
    const el = chatMessagesContainerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  const handleAttachmentFiles = async (files: FileList | null) => {
    const file = files?.item(0);
    if (!file || !taskId) return;
    setUploadingAttachment(true);
    setUploadError(null);
    try {
      await tasksApi.uploadAttachment(taskId, file);
      await refreshDetail();
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Не удалось загрузить файл');
    } finally {
      setUploadingAttachment(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    }
  };

  const clientChatMessages = useMemo(() => {
    const raw = taskDetail?.chatMessages;
    if (!Array.isArray(raw)) return [];
    return [...raw]
      .filter((m) => isLawyerClientChannelMessage(m))
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  }, [taskDetail?.chatMessages]);

  useEffect(() => {
    if (tab !== 'chat' || !taskId) return;
    void refreshDetail();
  }, [tab, taskId, refreshDetail]);

  useEffect(() => {
    if (tab !== 'chat' || !taskId) return;
    const intervalId = window.setInterval(() => {
      void refreshDetail();
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [tab, taskId, refreshDetail]);

  useEffect(() => {
    if (tab !== 'chat') return;
    scrollChatToEnd();
  }, [tab, clientChatMessages, scrollChatToEnd]);

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white">
            <Scale className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-slate-900">LEXPRO</div>
            <div className="text-xs text-slate-500">Правовые запросы</div>
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-800 hover:bg-slate-100"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-light text-xs font-medium text-brand">
              {(user?.name || '?').charAt(0)}
            </span>
            <span className="max-w-[160px] truncate">{user?.name || 'Пользователь'}</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
          {menuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Закрыть меню"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                    navigate('/login', { replace: true });
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4" />
                  Выйти
                </button>
              </div>
            </>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[340px] shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Мои запросы</h2>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                disabled={!allBoardOptions.length}
                className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                + Создать запрос
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {pageError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {pageError}
              </div>
            ) : null}

            {listLoading ? (
              <div className="py-8 text-center text-sm text-slate-500">Загрузка списка…</div>
            ) : !allBoardOptions.length ? (
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-3 text-left text-xs text-amber-950">
                <p className="font-medium text-amber-900">Нельзя создать запрос</p>
                <p className="mt-2 text-amber-900/90">
                  Для новых клиентов LEXPRO нужно хотя бы одно рабочее пространство, открытое для приёма
                  запросов. Попросите администратора Legal Boards указать его ID в переменной окружения API{' '}
                  <code className="rounded bg-white/80 px-1 py-0.5 font-mono text-[11px]">
                    LEXPRO_INTAKE_WORKSPACE_IDS
                  </code>{' '}
                  (несколько через запятую), затем перезапустить сервер.
                </p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">Запросов пока нет</div>
            ) : (
              <ul className="space-y-2">
                {tasks.map((t) => {
                  const col = getColumnName(t.boardId, t.columnId);
                  const meta = allBoardOptions.find((b) => b.id === t.boardId);
                  const active = t.id === taskId;
                  return (
                    <li key={t.id}>
                      <Link
                        to={`/r/${t.id}`}
                        className={`flex items-start gap-2 rounded-lg border p-3 transition-colors ${
                          active
                            ? 'border-brand bg-brand-light shadow-sm'
                            : 'border-slate-100 bg-white hover:border-slate-200'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium leading-snug text-slate-900">
                            {t.title}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{formatRequestRef(t)}</div>
                          {meta ? (
                            <div className="mt-0.5 text-[11px] text-slate-400">
                              {meta.workspaceName} · {meta.name}
                            </div>
                          ) : null}
                          <div className="mt-1 text-xs text-slate-400">{formatRuDate(t.createdAt).split(',')[0]}</div>
                          <div className="mt-2 flex items-center gap-1.5">
                            <span className={`inline-block h-2 w-2 rounded-full ${statusDotClass(col)}`} />
                            <span className="text-xs text-slate-600">{col}</span>
                          </div>
                        </div>
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                      </Link>
                    </li>
                  );
                })}
                <div ref={listEndRef} />
              </ul>
            )}
          </div>

          <div className="border-t border-slate-100 p-3">
            <button
              type="button"
              onClick={scrollListToEnd}
              className="w-full text-center text-xs text-brand hover:underline"
            >
              Показать все запросы
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto bg-slate-50 p-6">
          {!taskId || detailLoading ? (
            <div className="flex h-full min-h-[240px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
              {detailLoading ? 'Загрузка запроса…' : 'Выберите запрос слева'}
            </div>
          ) : !taskDetail ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
              Не удалось загрузить запрос
            </div>
          ) : (
            <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 pt-4">
                <div className="flex gap-6">
                  {(
                    [
                      ['details', 'Детали запроса', LayoutList],
                      ['contacts', 'Контакты', Phone],
                      ['history', 'История изменений', ScrollText],
                      ['chat', 'Чат', MessagesSquare],
                    ] as const
                  ).map(([key, label, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      className={`flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors ${
                        tab === key
                          ? 'border-brand text-brand'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span>{label}</span>
                      {key === 'chat' && chatUnread ? (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                          aria-label="Новые сообщения от юриста"
                          title="Новые сообщения"
                        />
                      ) : null}
                      {key === 'history' && historyUnread ? (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                          aria-label="Новые записи в истории статуса"
                          title="Новые изменения статуса"
                        />
                      ) : null}
                      {key === 'contacts' &&
                      !(user?.phone?.trim() || user?.contactNotes?.trim()) ? (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
                          aria-label="Контакты для юристов не заполнены"
                          title="Укажите контакты"
                        />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6">
                {tab === 'details' && (
                  <div className="space-y-6">
                    <section>
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                        <FileText className="h-4 w-4 text-brand" />
                        Тип услуги
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-800">
                        <div className="font-medium">{boardMetaForDetail?.name ?? '—'}</div>
                        {boardMetaForDetail ? (
                          <div className="mt-1 text-slate-600">{boardMetaForDetail.workspaceName}</div>
                        ) : null}
                      </div>
                    </section>

                    <section>
                      <div className="mb-2 text-sm font-medium text-slate-700">Текст обращения</div>
                      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                        {taskDetail.description?.trim() ? taskDetail.description : '—'}
                      </div>
                    </section>

                    <section>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium text-slate-700">Документы по обращению</div>
                        <div className="flex items-center gap-2">
                          <input
                            ref={attachmentInputRef}
                            type="file"
                            className="sr-only"
                            onChange={(e) => void handleAttachmentFiles(e.target.files)}
                            disabled={uploadingAttachment}
                          />
                          <button
                            type="button"
                            disabled={uploadingAttachment}
                            onClick={() => attachmentInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <Paperclip className="h-3.5 w-3.5 text-brand" />
                            {uploadingAttachment ? 'Загрузка…' : 'Прикрепить файл'}
                          </button>
                        </div>
                      </div>
                      {uploadError ? (
                        <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                          {uploadError}
                        </div>
                      ) : null}
                      {taskDetail.taskAttachments && taskDetail.taskAttachments.length > 0 ? (
                        <ul className="space-y-2">
                          {taskDetail.taskAttachments.map((att) => {
                            const href = filePublicUrl(apiBase, att.path);
                            return (
                              <li
                                key={att.id}
                                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <FileText className="h-8 w-8 shrink-0 text-brand" />
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-slate-900">{att.name}</div>
                                    <div className="text-xs text-slate-500">{fmtBytes(att.size)}</div>
                                  </div>
                                </div>
                                {href ? (
                                  <a
                                    href={href}
                                    download={att.name}
                                    className="rounded-md p-2 text-brand hover:bg-brand-light"
                                  >
                                    <Download className="h-4 w-4" />
                                  </a>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-500">Вложений пока нет — добавьте файл кнопкой выше.</p>
                      )}
                    </section>
                  </div>
                )}

                {tab === 'contacts' && (
                  <RequestContactsPanel onSaved={refreshDetail} />
                )}

                {tab === 'history' && (
                  <div className="text-sm">
                    {historyLoading ? (
                      <p className="text-slate-500">Загрузка истории…</p>
                    ) : historyError ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{historyError}</div>
                    ) : statusHistory.length === 0 ? (
                      <p className="text-slate-500">Изменений статуса (перемещений по колонкам) пока не было.</p>
                    ) : (
                      <ul className="space-y-3">
                        {statusHistory.map((h, i) => (
                          <li key={`${h.createdAt}-${i}`} className="border-l-2 border-brand-light pl-4">
                            <div className="text-slate-800">{h.message}</div>
                            <div className="mt-1 text-xs text-slate-500">{formatRuDate(h.createdAt)}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {tab === 'chat' && (
                  <div className="flex flex-col gap-4">
                    <p className="text-xs text-slate-500">
                      Тот же канал «Чат с клиентом», что и в карточке задачи Legal Boards (сообщения с типом «клиент»).
                    </p>
                    <div
                      ref={chatMessagesContainerRef}
                      className="max-h-[360px] flex flex-col gap-2 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-3"
                    >
                      {clientChatMessages.length === 0 ? (
                        <p className="py-4 text-center text-sm text-slate-500">Сообщений в чате с клиентом пока нет</p>
                      ) : (
                        clientChatMessages.map((m, idx) => {
                          const isOwn = Boolean(user?.id && m.user?.id === user.id);
                          return (
                            <div
                              key={m.id || `chat-${idx}-${m.createdAt}`}
                              className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                                  isOwn
                                    ? 'bg-brand text-white shadow-sm'
                                    : 'border border-slate-200 bg-white text-slate-800'
                                }`}
                              >
                                {!isOwn && m.user?.name ? (
                                  <div className="mb-1 text-[10px] text-slate-500">{m.user.name}</div>
                                ) : null}
                                {isOwn ? (
                                  <div className="mb-1 text-[10px] text-white/80">Вы</div>
                                ) : null}
                                <div className="whitespace-pre-wrap">{m.content}</div>
                                <div
                                  className={`mt-1 text-[10px] ${isOwn ? 'text-white/75' : 'text-slate-400'}`}
                                >
                                  {formatRuDate(m.createdAt)}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <form onSubmit={handlePostClientChat} className="flex gap-2">
                      <input
                        value={chatDraft}
                        onChange={(e) => setChatDraft(e.target.value)}
                        placeholder="Сообщение юристу…"
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                      />
                      <button
                        type="submit"
                        disabled={chatSending || !chatDraft.trim()}
                        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-40"
                      >
                        Отправить
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {createOpen && allBoardOptions.length > 0 ? (
        <CreateRequestModal
          boardOptions={allBoardOptions}
          open={createOpen}
          clientName={user?.name?.trim() || 'Клиент'}
          onClose={() => setCreateOpen(false)}
          onCreated={async (created) => {
            setCreateOpen(false);
            await reloadTasks();
            navigate(`/r/${created.id}`, { replace: true });
            const hasContacts = Boolean(user?.phone?.trim() || user?.contactNotes?.trim());
            if (!hasContacts) setTab('contacts');
          }}
        />
      ) : null}
    </div>
  );
}

function RequestContactsPanel({
  onSaved,
}: {
  onSaved: () => void | Promise<void>;
}) {
  const { user, updateProfile } = useAuth();
  const [phone, setPhone] = useState('');
  const [contactNotes, setContactNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    setPhone((user?.phone ?? '').trim());
    setContactNotes((user?.contactNotes ?? '').trim());
    setErr(null);
    setSavedOk(false);
  }, [user?.phone, user?.contactNotes]);

  useEffect(() => {
    if (!savedOk) return;
    const t = window.setTimeout(() => setSavedOk(false), 4000);
    return () => window.clearTimeout(t);
  }, [savedOk]);

  const hasSaved = Boolean(user?.phone?.trim() || user?.contactNotes?.trim());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = phone.trim();
    const n = contactNotes.trim();
    if (!p && !n) {
      setErr('Укажите телефон или комментарий для связи с юристом');
      return;
    }
    setErr(null);
    setLoading(true);
    setSavedOk(false);
    try {
      await updateProfile({
        phone: p,
        contactNotes: n,
      });
      await onSaved();
      setSavedOk(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Контакты для юристов</h3>
        <p className="mt-1 text-sm text-slate-600">
          Телефон и комментарий хранятся в вашем профиле LEXPRO и отображаются во всех ваших запросах в карточке
          задачи в Legal Boards — их можно изменить в любой момент.
        </p>
      </div>

      {!hasSaved ? (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Контакты пока не указаны — юрист не увидит способ с вами связаться, пока вы не сохраните хотя бы один из
          пунктов ниже.
        </div>
      ) : null}

      {hasSaved ? (
        <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-800">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Сохранённые данные</div>
          {user?.phone?.trim() ? (
            <div className="mb-2">
              <span className="text-xs text-slate-500">Телефон</span>
              <div className="font-medium">{user.phone.trim()}</div>
            </div>
          ) : (
            <div className="mb-2 text-slate-500">Телефон не указан</div>
          )}
          {user?.contactNotes?.trim() ? (
            <div>
              <span className="text-xs text-slate-500">Комментарий</span>
              <div className="mt-0.5 whitespace-pre-wrap">{user.contactNotes.trim()}</div>
            </div>
          ) : (
            <div className="text-slate-500">Комментарий не указан</div>
          )}
        </div>
      ) : null}

      {savedOk ? (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Контакты сохранены.
        </div>
      ) : null}

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
      ) : null}

      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        <div>
          <label htmlFor="lex-contact-phone-tab" className="mb-1 block text-sm font-medium text-slate-700">
            Телефон
          </label>
          <input
            id="lex-contact-phone-tab"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 …"
            className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </div>
        <div>
          <label htmlFor="lex-contact-notes-tab" className="mb-1 block text-sm font-medium text-slate-700">
            Комментарий (необязательно)
          </label>
          <textarea
            id="lex-contact-notes-tab"
            rows={4}
            value={contactNotes}
            onChange={(e) => setContactNotes(e.target.value)}
            placeholder="Удобное время звонка, мессенджер и т.п."
            className="w-full max-w-lg rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </div>
        <div className="pt-1">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-40"
          >
            {loading ? 'Сохранение…' : 'Сохранить контакты'}
          </button>
        </div>
      </form>
    </div>
  );
}

function defaultRequestTitle(clientName: string) {
  const name = clientName.trim() || 'Клиент';
  return `Новый запрос от ${name}`;
}

function CreateRequestModal({
  boardOptions,
  open,
  clientName,
  onClose,
  onCreated,
}: {
  boardOptions: BoardWithWorkspace[];
  open: boolean;
  clientName: string;
  onClose: () => void;
  onCreated: (task: TaskDetail) => void | Promise<void>;
}) {
  const [selectedBoardId, setSelectedBoardId] = useState(boardOptions[0]?.id ?? '');
  const [boardDetail, setBoardDetail] = useState<BoardDetail | null>(null);
  const [description, setDescription] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDescription('');
    setErr(null);
    setSelectedBoardId(boardOptions[0]?.id ?? '');
  }, [open, boardOptions]);

  useEffect(() => {
    if (!selectedBoardId) {
      setBoardDetail(null);
      return;
    }
    let cancelled = false;
    boardsApi
      .getById(selectedBoardId)
      .then((d) => {
        if (!cancelled) setBoardDetail(d);
      })
      .catch(() => {
        if (!cancelled) setBoardDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedBoardId]);

  const groupedByWorkspace = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, BoardWithWorkspace[]>();
    for (const b of boardOptions) {
      if (!map.has(b.workspaceId)) {
        map.set(b.workspaceId, []);
        order.push(b.workspaceId);
      }
      map.get(b.workspaceId)!.push(b);
    }
    return order.map((wid) => ({
      workspaceId: wid,
      workspaceName: map.get(wid)![0]?.workspaceName ?? wid,
      boards: map.get(wid)!,
    }));
  }, [boardOptions]);

  const colId = boardDetail?.columns[0]?.id;
  const typeId = boardDetail?.taskTypes[0]?.id;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!boardDetail || !selectedBoardId) {
      setErr('Выберите услугу');
      return;
    }
    if (!colId || !typeId) {
      setErr('На выбранной доске нет колонок или типов задач');
      return;
    }
    const resolvedTitle = defaultRequestTitle(clientName);
    setErr(null);
    setLoading(true);
    try {
      const created = await tasksApi.create({
        boardId: boardDetail.id,
        columnId: colId,
        typeId,
        title: resolvedTitle,
        description: description.trim() || undefined,
        customFields: {},
      });
      await onCreated(created);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Не удалось создать запрос');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/30"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Новый запрос</h3>
        <p className="mt-1 text-sm text-slate-500">
          Запрос будет создан как задача на выбранной доске (услуге). Название задачи формируется
          автоматически: «{defaultRequestTitle(clientName)}».
        </p>

        {err ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
        ) : null}

        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Выберите услугу *</label>
            <select
              value={selectedBoardId}
              onChange={(e) => setSelectedBoardId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
              required
            >
              {groupedByWorkspace.map((g) => (
                <optgroup key={g.workspaceId} label={g.workspaceName}>
                  {g.boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Текст обращения</label>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || !boardDetail}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-40"
            >
              {loading ? 'Создание…' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
