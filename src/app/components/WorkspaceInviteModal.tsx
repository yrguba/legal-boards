import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ApiError, invitesApi } from '../services/api';
import { useApp } from '../store/AppContext';

interface WorkspaceInviteModalProps {
  inviteId: string;
  onClose: () => void;
  onDone: () => void;
}

export function WorkspaceInviteModal({ inviteId, onClose, onDone }: WorkspaceInviteModalProps) {
  const { refreshWorkspaces, switchWorkspace } = useApp();
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<{
    id: string;
    workspace?: { name: string };
    invitedBy?: { name: string };
    role: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const pending = await invitesApi.getMine('pending');
        if (cancelled) return;
        const found = pending.find((i) => i.id === inviteId) ?? pending[0];
        if (!found) {
          setError('Приглашение не найдено или истекло');
        } else {
          setInvite(found);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'Не удалось загрузить приглашение');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [inviteId]);

  const handleAccept = async () => {
    if (!invite) return;
    setActing(true);
    setError(null);
    try {
      const result = await invitesApi.accept(invite.id);
      await refreshWorkspaces();
      switchWorkspace(result.workspaceId);
      onDone();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось принять приглашение');
    } finally {
      setActing(false);
    }
  };

  const handleDecline = async () => {
    if (!invite) return;
    setActing(true);
    setError(null);
    try {
      await invitesApi.decline(invite.id);
      onDone();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось отклонить приглашение');
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Приглашение в пространство</h2>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {loading && <p className="text-sm text-slate-500">Загрузка…</p>}

        {!loading && invite && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              {invite.invitedBy?.name ?? 'Администратор'} приглашает вас в{' '}
              <strong>{invite.workspace?.name ?? 'пространство'}</strong>
            </p>
            <p className="text-xs text-slate-500">Роль: {invite.role}</p>
            {error && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={acting}
                onClick={() => void handleDecline()}
                className="flex-1 px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Отклонить
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={() => void handleAccept()}
                className="flex-1 px-4 py-2 bg-brand text-white rounded hover:bg-brand-primary-hover disabled:opacity-50"
              >
                {acting ? '…' : 'Принять'}
              </button>
            </div>
          </div>
        )}

        {!loading && !invite && error && (
          <p className="text-sm text-red-700">{error}</p>
        )}
      </div>
    </div>
  );
}
