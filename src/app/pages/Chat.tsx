import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { MessageCircle, Paperclip, Plus, Send, ChevronUp, User } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { usersApi, workspaceChatsApi } from '../services/api';
import { getWsUrl } from '../utils/wsUrl';
import { getApiBaseUrl } from './task/utils/apiBaseUrl';
import { filePublicUrl } from './task/utils/documentPaths';
import {
  ChatAttachmentLightbox,
  MessageAttachmentItem,
  PendingAttachmentPreview,
  usePendingAttachmentPreviews,
} from '../components/ChatAttachments';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

type Channel = {
  id: string;
  channelKey: string;
  scope: string;
  title: string;
  departmentId: string | null;
  groupId: string | null;
  directUserIds?: string[];
  peerUser?: { id: string; name: string; avatar: string | null; email: string } | null;
  createdAt: string;
};

type ChatMessage = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; avatar: string | null; email: string };
  attachments?: {
    id: string;
    name: string;
    type: string;
    size: number;
    path: string;
    createdAt: string;
  }[];
};

type WorkspaceMember = {
  id: string;
  name: string;
  email?: string;
  avatar?: string | null;
};

function mergeChatMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const item of incoming) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }
    byId.set(item.id, {
      ...existing,
      ...item,
      user: item.user ?? existing.user,
      attachments:
        item.attachments && item.attachments.length > 0
          ? item.attachments
          : existing.attachments,
    });
  }
  return [...byId.values()].sort(
    (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
  );
}

function scopeLabel(scope: string) {
  if (scope === 'direct') return 'Личный';
  if (scope === 'workspace') return 'Пространство';
  if (scope === 'department') return 'Отдел';
  if (scope === 'group') return 'Группа';
  return scope;
}

function ChannelButton({
  channel,
  active,
  onSelect,
}: {
  channel: Channel;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-lg px-3 py-2 mb-1 transition-colors ${
        active ? 'bg-brand-light text-brand' : 'text-slate-800 hover:bg-slate-100'
      }`}
    >
      <div className="text-xs text-slate-500 uppercase tracking-wide">
        {scopeLabel(channel.scope)}
      </div>
      <div className="text-sm font-medium truncate">{channel.title}</div>
    </button>
  );
}

export function Chat() {
  const { currentWorkspace, currentUser } = useApp();
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [openingDirect, setOpeningDirect] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<{
    href: string;
    name: string;
    type: string;
  } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingAttachmentPreviews = usePendingAttachmentPreviews(pendingFiles);

  const directChannels = useMemo(
    () => channels.filter((c) => c.scope === 'direct'),
    [channels],
  );
  const groupChannels = useMemo(
    () => channels.filter((c) => c.scope !== 'direct'),
    [channels],
  );
  const activeChannel = channels.find((c) => c.id === activeId) ?? null;

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

  useEffect(() => {
    if (!newChatOpen || !currentWorkspace) return;
    let cancelled = false;
    setLoadingMembers(true);
    usersApi
      .getByWorkspace(currentWorkspace.id)
      .then((list) => {
        if (cancelled) return;
        setMembers(
          (Array.isArray(list) ? list : []).filter((u: WorkspaceMember) => u.id !== currentUser?.id),
        );
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMembers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [newChatOpen, currentWorkspace, currentUser?.id]);

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.email && m.email.toLowerCase().includes(q)),
    );
  }, [members, memberQuery]);

  const openDirectChat = async (participantUserId: string) => {
    if (!currentWorkspace || openingDirect) return;
    setOpeningDirect(true);
    try {
      const channel = await workspaceChatsApi.openDirectChat(
        currentWorkspace.id,
        participantUserId,
      );
      setChannels((prev) => {
        const existing = prev.find((c) => c.id === channel.id);
        if (existing) {
          return prev.map((c) => (c.id === channel.id ? channel : c));
        }
        return [channel, ...prev];
      });
      setActiveId(channel.id);
      setNewChatOpen(false);
      setMemberQuery('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось открыть чат');
    } finally {
      setOpeningDirect(false);
    }
  };

  useEffect(() => {
    setPendingFiles([]);
    setSendError(null);
  }, [activeId]);

  const addPendingFiles = (fileList: FileList | File[] | null | undefined) => {
    if (!fileList?.length) return;
    setSendError(null);
    setPendingFiles((prev) => [...prev, ...Array.from(fileList)]);
  };

  const handleAttachmentInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const picked = input.files ? Array.from(input.files) : [];
    if (picked.length > 0) {
      addPendingFiles(picked);
    }
    window.setTimeout(() => {
      input.value = '';
    }, 0);
  };

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
          setMessages(
            batch.map((m) => ({
              ...m,
              attachments: Array.isArray(m.attachments) ? m.attachments : [],
            })),
          );
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
      setMessages((m) => mergeChatMessages(m, batch));
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
        setMessages((prev) => mergeChatMessages(prev, latest));
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

  useEffect(() => {
    if (!currentUser?.id) return;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(getWsUrl());
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as {
            type?: string;
            channelId?: string;
            directUserIds?: string[];
            message?: ChatMessage;
          };
          if (data.type !== 'workspace_chat_message' || !data.channelId || !data.message) return;
          if (data.channelId !== activeId) return;
          if (
            Array.isArray(data.directUserIds) &&
            data.directUserIds.length > 0 &&
            !data.directUserIds.includes(currentUser.id)
          ) {
            return;
          }
          setMessages((prev) => mergeChatMessages(prev, [data.message!]));
          requestAnimationFrame(() => {
            const el = listRef.current;
            if (el) el.scrollTop = el.scrollHeight;
          });
        } catch {
          /* ignore */
        }
      };
    } catch {
      /* ignore */
    }
    return () => {
      ws?.close();
    };
  }, [activeId, currentUser?.id]);

  const send = async () => {
    if (!activeId || sending) return;
    const content = draft.trim();
    if (!content && pendingFiles.length === 0) return;
    const filesToSend = [...pendingFiles];
    setSending(true);
    setSendError(null);
    try {
      const msg = await workspaceChatsApi.postMessage(activeId, content, filesToSend);
      if (filesToSend.length > 0 && msg.attachments.length === 0) {
        throw new Error(
          'Файлы не сохранились на сервере. Выполните на backend: npx prisma migrate deploy && npx prisma generate',
        );
      }
      setDraft('');
      setPendingFiles([]);
      setMessages((m) => mergeChatMessages(m, [msg]));
      requestAnimationFrame(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось отправить';
      setSendError(message);
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
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <MessageCircle className="size-5 text-brand" />
                Чаты
              </h1>
              <p className="text-xs text-slate-500 mt-1">Личные и каналы пространства</p>
            </div>
            <button
              type="button"
              onClick={() => setNewChatOpen(true)}
              className="inline-flex items-center justify-center size-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-brand"
              title="Новый личный чат"
              aria-label="Новый личный чат"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loadingChannels && (
            <div className="text-sm text-slate-500 px-2 py-1">Загрузка…</div>
          )}
          {channelsError && (
            <div className="text-sm text-red-600 px-2 py-1">{channelsError}</div>
          )}

          {directChannels.length > 0 ? (
            <div className="mb-3">
              <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Личные
              </div>
              {directChannels.map((c) => (
                <ChannelButton
                  key={c.id}
                  channel={c}
                  active={c.id === activeId}
                  onSelect={() => setActiveId(c.id)}
                />
              ))}
            </div>
          ) : null}

          {groupChannels.length > 0 ? (
            <div>
              <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Каналы
              </div>
              {groupChannels.map((c) => (
                <ChannelButton
                  key={c.id}
                  channel={c}
                  active={c.id === activeId}
                  onSelect={() => setActiveId(c.id)}
                />
              ))}
            </div>
          ) : null}

          {!loadingChannels && channels.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">
              Нет чатов. Нажмите «+», чтобы начать личную переписку.
            </div>
          ) : null}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {activeId ? (
          <>
            <div className="border-b border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-medium text-slate-900">
                {activeChannel?.title ?? 'Чат'}
              </div>
              {activeChannel?.scope === 'direct' && activeChannel.peerUser?.email ? (
                <div className="text-xs text-slate-500">{activeChannel.peerUser.email}</div>
              ) : activeChannel ? (
                <div className="text-xs text-slate-500">{scopeLabel(activeChannel.scope)}</div>
              ) : null}
            </div>
            <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
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
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[min(100%,32rem)] rounded-2xl px-3 py-2 shadow-sm ${
                        mine
                          ? 'bg-brand text-white rounded-br-md'
                          : 'bg-white border border-slate-200 text-slate-900 rounded-bl-md'
                      }`}
                    >
                      {!mine && activeChannel?.scope !== 'direct' && (
                        <div className="text-xs font-medium text-slate-600 mb-0.5">
                          {m.user.name}
                        </div>
                      )}
                      {m.content ? (
                        <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                      ) : null}
                      {Array.isArray(m.attachments) && m.attachments.length > 0 ? (
                        <div className={`space-y-2 ${m.content ? 'mt-2' : ''}`}>
                          {m.attachments.map((att) => (
                            <MessageAttachmentItem
                              key={att.id}
                              name={att.name}
                              type={att.type}
                              href={filePublicUrl(apiBaseUrl, att.path)}
                              mine={mine}
                              onOpenPreview={setAttachmentPreview}
                            />
                          ))}
                        </div>
                      ) : null}
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
              {sendError ? (
                <div className="mb-2 max-w-4xl mx-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {sendError}
                </div>
              ) : null}
              {pendingAttachmentPreviews.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-2 max-w-4xl mx-auto">
                  {pendingAttachmentPreviews.map((item, index) => (
                    <PendingAttachmentPreview
                      key={item.key}
                      name={item.file.name}
                      type={item.file.type}
                      previewUrl={item.previewUrl}
                      onRemove={() =>
                        setPendingFiles((prev) => prev.filter((_, i) => i !== index))
                      }
                    />
                  ))}
                </div>
              ) : null}
              <div className="flex gap-2 max-w-4xl mx-auto">
                <label
                  className={`relative self-end flex-shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer ${
                    sending ? 'pointer-events-none opacity-50' : ''
                  }`}
                  title="Прикрепить файлы"
                >
                  <input
                    type="file"
                    multiple
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                    onChange={handleAttachmentInputChange}
                    disabled={sending}
                  />
                  <Paperclip className="size-5 pointer-events-none" aria-hidden />
                </label>
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
                  disabled={(!draft.trim() && pendingFiles.length === 0) || sending}
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
              ? 'Нажмите «+» справа от заголовка «Чаты», чтобы начать личный чат.'
              : 'Выберите чат слева'}
          </div>
        )}
      </div>

      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Новый личный чат</DialogTitle>
          </DialogHeader>
          <input
            type="text"
            value={memberQuery}
            onChange={(e) => setMemberQuery(e.target.value)}
            placeholder="Поиск по имени или email…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <div className="max-h-72 overflow-y-auto mt-3 space-y-1">
            {loadingMembers ? (
              <div className="text-sm text-slate-500 py-2">Загрузка участников…</div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-sm text-slate-500 py-2">Участники не найдены</div>
            ) : (
              filteredMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  disabled={openingDirect}
                  onClick={() => void openDirectChat(member.id)}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-100 disabled:opacity-50"
                >
                  <div className="flex size-8 items-center justify-center rounded-full bg-brand-light text-brand">
                    {member.avatar ? (
                      <img src={member.avatar} alt="" className="size-8 rounded-full object-cover" />
                    ) : (
                      <User className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{member.name}</div>
                    {member.email ? (
                      <div className="text-xs text-slate-500 truncate">{member.email}</div>
                    ) : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ChatAttachmentLightbox
        attachment={attachmentPreview}
        onClose={() => setAttachmentPreview(null)}
      />
    </div>
  );
}
