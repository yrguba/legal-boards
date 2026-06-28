import { useEffect, useMemo, useState } from 'react';
import { Check, MessageCircle, Search } from 'lucide-react';
import {
  conferencesApi,
  usersApi,
  workspaceChatsApi,
  ApiError,
} from '../services/api';
import { useApp } from '../store/AppContext';
import { UserAvatar } from './UserAvatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { cn } from './ui/utils';

type Member = {
  id: string;
  name: string;
  email?: string;
  avatar?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  conferenceId: string;
  workspaceId: string;
  onShared?: (message: string) => void;
};

export function ShareConferenceToChatModal({
  open,
  onClose,
  conferenceId,
  workspaceId,
  onShared,
}: Props) {
  const { currentUser } = useApp();
  const [members, setMembers] = useState<Member[]>([]);
  const [existingChatPeerIds, setExistingChatPeerIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setError(null);
    setSelectedIds(new Set());
    setLoading(true);

    Promise.all([
      usersApi.getByWorkspace(workspaceId),
      workspaceChatsApi.listChannels(workspaceId),
    ])
      .then(([userList, channels]) => {
        const peers = new Set<string>();
        for (const channel of channels) {
          if (channel.scope !== 'direct') continue;
          if (channel.peerUser?.id) peers.add(channel.peerUser.id);
          for (const id of channel.directUserIds ?? []) {
            if (id !== currentUser?.id) peers.add(id);
          }
        }
        setExistingChatPeerIds(peers);
        setMembers(
          (Array.isArray(userList) ? userList : [])
            .filter((u: Member) => u.id !== currentUser?.id)
            .map((u: Member) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              avatar: u.avatar,
            })),
        );
      })
      .catch((e: unknown) => {
        setError(e instanceof ApiError ? e.message : 'Не удалось загрузить сотрудников');
        setMembers([]);
        setExistingChatPeerIds(new Set());
      })
      .finally(() => setLoading(false));
  }, [open, workspaceId, currentUser?.id]);

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.email && m.email.toLowerCase().includes(q)),
    );
  }, [members, query]);

  const filteredIds = useMemo(() => filteredMembers.map((m) => m.id), [filteredMembers]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));

  const toggleMember = (memberId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
  };

  const handleShare = async () => {
    if (selectedIds.size === 0) {
      setError('Выберите хотя бы одного сотрудника');
      return;
    }

    setSubmitting(true);
    setError(null);

    const selected = members.filter((m) => selectedIds.has(m.id));
    let sent = 0;
    const failures: string[] = [];

    for (const member of selected) {
      try {
        const channel = await workspaceChatsApi.openDirectChat(workspaceId, member.id);
        await conferencesApi.shareToChat(conferenceId, channel.id);
        sent += 1;
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : 'Ошибка отправки';
        failures.push(`${member.name}: ${msg}`);
      }
    }

    setSubmitting(false);

    if (sent === 0) {
      setError(failures[0] ?? 'Не удалось отправить ссылку');
      return;
    }

    const summary =
      failures.length === 0
        ? sent === 1
          ? `Ссылка отправлена ${selected[0].name}`
          : `Ссылка отправлена ${sent} сотрудникам`
        : `Отправлено: ${sent}. Не удалось: ${failures.length}`;

    onShared?.(summary);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !submitting && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Поделиться в чат</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-slate-600 mb-3">
          Выберите одного или нескольких сотрудников — ссылка будет отправлена в личные чаты.
        </p>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени или email…"
            disabled={loading || submitting}
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50"
          />
        </div>

        {!loading && filteredMembers.length > 0 ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500">
              {selectedIds.size > 0 ? `Выбрано: ${selectedIds.size}` : 'Никого не выбрано'}
            </span>
            <button
              type="button"
              disabled={submitting}
              onClick={toggleAllFiltered}
              className="text-xs text-brand hover:underline disabled:opacity-50"
            >
              {allFilteredSelected ? 'Снять выбор' : 'Выбрать всех в списке'}
            </button>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-500 py-4">Загрузка сотрудников…</p>
        ) : filteredMembers.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">
            {members.length === 0 ? 'Нет других участников в пространстве.' : 'Сотрудники не найдены.'}
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto mt-2 rounded-lg border border-slate-200 divide-y divide-slate-100">
            {filteredMembers.map((member) => {
              const hasChat = existingChatPeerIds.has(member.id);
              const selected = selectedIds.has(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  disabled={submitting}
                  onClick={() => toggleMember(member.id)}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors disabled:opacity-50',
                    selected ? 'bg-brand/10' : 'hover:bg-slate-50',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded border',
                      selected
                        ? 'border-brand bg-brand text-white'
                        : 'border-slate-300 bg-white',
                    )}
                    aria-hidden
                  >
                    {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
                  </span>
                  <UserAvatar name={member.name} avatar={member.avatar} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900 truncate">
                      {member.name}
                    </span>
                    {member.email ? (
                      <span className="block text-xs text-slate-500 truncate">{member.email}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {hasChat ? (
                      <span className="inline-flex items-center gap-1 text-brand">
                        <MessageCircle className="size-3.5" />
                        Чат
                      </span>
                    ) : (
                      'Новый чат'
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={submitting || loading || selectedIds.size === 0}
            onClick={() => void handleShare()}
            className="rounded-lg bg-brand px-4 py-2 text-sm text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {submitting
              ? 'Отправка…'
              : selectedIds.size > 0
                ? `Отправить (${selectedIds.size})`
                : 'Отправить'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
