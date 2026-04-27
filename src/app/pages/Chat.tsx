import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, ChevronUp } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { workspaceChatsApi } from '../services/api';

type Channel = {
  id: string;
  channelKey: string;
  scope: string;
  title: string;
  departmentId: string | null;
  groupId: string | null;
  createdAt: string;
};

type ChatMessage = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; avatar: string | null; email: string };
};

function scopeLabel(scope: string) {
  if (scope === 'workspace') return 'Пространство';
  if (scope === 'department') return 'Отдел';
  if (scope === 'group') return 'Группа';
  return scope;
}

export function Chat() {
  const { currentWorkspace, currentUser } = useApp();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadChannels = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoadingChannels(true);
    setChannelsError(null);
    try {
      const list = await workspaceChatsApi.listChannels(currentWorkspace.id);
      setChannels(list);
      setActiveId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (e) {
      setChannelsError(e instanceof Error ? e.message : 'Не удалось загрузить чаты');
    } finally {
      setLoadingChannels(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  // История при смене канала
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setHasMore(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingMessages(true);
      try {
        const { messages: batch, hasMore: more } = await workspaceChatsApi.getMessages(activeId);
        if (!cancelled) {
          setMessages(batch);
          setHasMore(more);
          requestAnimationFrame(() => {
            const el = listRef.current;
            if (el) el.scrollTop = el.scrollHeight;
          });
        }
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const loadOlder = async () => {
    if (!activeId || !hasMore || messages.length === 0 || loadingOlder) return;
    const oldest = messages[0];
    setLoadingOlder(true);
    const prevHeight = listRef.current?.scrollHeight ?? 0;
    const prevTop = listRef.current?.scrollTop ?? 0;
    try {
      const before = new Date(oldest.createdAt).toISOString();
      const { messages: batch, hasMore: more } = await workspaceChatsApi.getMessages(activeId, before);
      setMessages((m) => [...batch, ...m]);
      setHasMore(more);
      requestAnimationFrame(() => {
        const el = listRef.current;
        if (el) {
          const nextHeight = el.scrollHeight;
          el.scrollTop = nextHeight - prevHeight + prevTop;
        }
      });
    } catch {
      /* ignore */
    } finally {
      setLoadingOlder(false);
    }
  };

  // Polling новых сообщений
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (!activeId) return;
    pollRef.current = setInterval(async () => {
      try {
        const el = listRef.current;
        const atBottom = el
          ? el.scrollHeight - el.scrollTop - el.clientHeight < 80
          : true;
        const { messages: latest } = await workspaceChatsApi.getMessages(activeId);
        setMessages((prev) => {
          if (prev.length === 0) return latest;
          const existing = new Set(prev.map((m) => m.id));
          const merged = [...prev];
          for (const m of latest) {
            if (!existing.has(m.id)) merged.push(m);
          }
          merged.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
          return merged;
        });
        if (atBottom) {
          requestAnimationFrame(() => {
            const list = listRef.current;
            if (list) list.scrollTop = list.scrollHeight;
          });
        }
      } catch {
        /* ignore */
      }
    }, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeId]);

  const send = async () => {
    if (!activeId || !draft.trim() || sending) return;
    setSending(true);
    try {
      const msg = await workspaceChatsApi.postMessage(activeId, draft.trim());
      setDraft('');
      setMessages((m) => [...m, msg]);
      requestAnimationFrame(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось отправить');
    } finally {
      setSending(false);
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-4 py-3 text-sm">
          Выберите рабочее пространство в шапке, чтобы открыть чаты.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-72 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h1 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <MessageCircle className="size-5 text-brand" />
            Чаты
          </h1>
          <p className="text-xs text-slate-500 mt-1">Каналы пространства, отделов и групп</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loadingChannels && (
            <div className="text-sm text-slate-500 px-2 py-1">Загрузка…</div>
          )}
          {channelsError && (
            <div className="text-sm text-red-600 px-2 py-1">{channelsError}</div>
          )}
          {channels.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(c.id)}
              className={`w-full text-left rounded-lg px-3 py-2 mb-1 transition-colors ${
                c.id === activeId ? 'bg-brand-light text-brand' : 'text-slate-800 hover:bg-slate-100'
              }`}
            >
              <div className="text-xs text-slate-500 uppercase tracking-wide">
                {scopeLabel(c.scope)}
              </div>
              <div className="text-sm font-medium truncate">{c.title}</div>
            </button>
          ))}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {activeId ? (
          <>
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto p-4 space-y-3"
            >
              {hasMore && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={loadOlder}
                    className="inline-flex items-center gap-1 text-sm text-brand hover:underline disabled:opacity-50"
                    disabled={loadingOlder}
                  >
                    <ChevronUp className="size-4" />
                    {loadingOlder ? 'Загрузка…' : 'Ранние сообщения'}
                  </button>
                </div>
              )}
              {loadingMessages && messages.length === 0 && (
                <div className="text-sm text-slate-500">Загрузка сообщений…</div>
              )}
              {messages.map((m) => {
                const mine = m.user.id === currentUser?.id;
                return (
                  <div
                    key={m.id}
                    className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[min(100%,32rem)] rounded-2xl px-3 py-2 shadow-sm ${
                        mine
                          ? 'bg-brand text-white rounded-br-md'
                          : 'bg-white border border-slate-200 text-slate-900 rounded-bl-md'
                      }`}
                    >
                      {!mine && (
                        <div className="text-xs font-medium text-slate-600 mb-0.5">
                          {m.user.name}
                        </div>
                      )}
                      <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                      <div
                        className={`text-[10px] mt-1 ${
                          mine ? 'text-white/80' : 'text-slate-400'
                        }`}
                      >
                        {new Date(m.createdAt).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-slate-200 bg-white p-3">
              <div className="flex gap-2 max-w-4xl mx-auto">
                <textarea
                  className="flex-1 min-h-[44px] max-h-32 rounded-lg border border-slate-200 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder="Сообщение…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={2}
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={!draft.trim() || sending}
                  className="self-end flex-shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg bg-brand text-white disabled:opacity-50"
                  aria-label="Отправить"
                >
                  <Send className="size-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm p-6">
            {channels.length === 0
              ? 'Нет доступных каналов. Создайте отделы и группы в настройках пространства.'
              : 'Выберите канал слева'}
          </div>
        )}
      </div>
    </div>
  );
}
