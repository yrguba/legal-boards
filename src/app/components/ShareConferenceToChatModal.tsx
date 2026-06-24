import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { conferencesApi, workspaceChatsApi, ApiError } from '../services/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

type Channel = {
  id: string;
  scope: string;
  title: string;
  peerUser?: { id: string; name: string } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  conferenceId: string;
  workspaceId: string;
  onShared?: (message: string) => void;
};

function scopeLabel(scope: string) {
  if (scope === 'direct') return 'Личный';
  if (scope === 'workspace') return 'Пространство';
  if (scope === 'department') return 'Отдел';
  if (scope === 'group') return 'Группа';
  return scope;
}

export function ShareConferenceToChatModal({
  open,
  onClose,
  conferenceId,
  workspaceId,
  onShared,
}: Props) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setError(null);
    setLoading(true);

    workspaceChatsApi
      .listChannels(workspaceId)
      .then((list) => {
        setChannels(list);
        if (list.length === 1) setSelectedId(list[0].id);
      })
      .catch((e: unknown) => {
        setError(e instanceof ApiError ? e.message : 'Не удалось загрузить чаты');
        setChannels([]);
      })
      .finally(() => setLoading(false));
  }, [open, workspaceId]);

  const handleShare = async () => {
    if (!selectedId) {
      setError('Выберите чат');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await conferencesApi.shareToChat(conferenceId, selectedId);
      onShared?.(result.message);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось отправить ссылку');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Поделиться в чат</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-slate-600 mb-3">
          Выберите чат, в который отправить ссылку на конференцию.
        </p>

        {loading ? (
          <p className="text-sm text-slate-500 py-4">Загрузка чатов…</p>
        ) : channels.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">Нет доступных чатов в этом пространстве.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
            {channels.map((channel) => {
              const label =
                channel.scope === 'direct' && channel.peerUser?.name
                  ? channel.peerUser.name
                  : channel.title;
              const active = selectedId === channel.id;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setSelectedId(channel.id)}
                  className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors ${
                    active ? 'bg-brand/10' : 'hover:bg-slate-50'
                  }`}
                >
                  <MessageCircle
                    className={`mt-0.5 size-4 shrink-0 ${active ? 'text-brand' : 'text-slate-400'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900 truncate">{label}</span>
                    <span className="block text-xs text-slate-500">{scopeLabel(channel.scope)}</span>
                  </span>
                  <span
                    className={`mt-1 size-4 shrink-0 rounded-full border ${
                      active ? 'border-brand bg-brand' : 'border-slate-300'
                    }`}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        )}

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={submitting || loading || channels.length === 0 || !selectedId}
            onClick={() => void handleShare()}
            className="rounded-lg bg-brand px-4 py-2 text-sm text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {submitting ? 'Отправка…' : 'Отправить'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
