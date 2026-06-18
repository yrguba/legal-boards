import { useCallback, useEffect, useState } from 'react';
import { Clock, X } from 'lucide-react';
import { workspacesApi } from '../services/api';

type PendingInvite = {
  id: string;
  user: { name: string; email: string };
  role: string;
  expiresAt: string;
  invitedBy?: { name: string };
};

interface PendingWorkspaceInvitesProps {
  workspaceId: string;
  reloadToken?: number;
}

export function PendingWorkspaceInvites({ workspaceId, reloadToken = 0 }: PendingWorkspaceInvitesProps) {
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await workspacesApi.listInvites(workspaceId, 'pending');
      setInvites(rows);
    } catch {
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  const handleCancel = async (inviteId: string) => {
    if (!window.confirm('Отменить приглашение?')) return;
    setCancellingId(inviteId);
    try {
      await workspacesApi.cancelInvite(workspaceId, inviteId);
      await load();
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : 'Не удалось отменить');
    } finally {
      setCancellingId(null);
    }
  };

  if (loading || invites.length === 0) return null;

  return (
    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-amber-700" />
        <h3 className="text-sm font-medium text-amber-900">
          Ожидают принятия ({invites.length})
        </h3>
      </div>
      <div className="space-y-2">
        {invites.map((inv) => (
          <div
            key={inv.id}
            className="flex items-center justify-between gap-3 bg-white rounded border border-amber-100 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="text-sm text-slate-900 truncate">
                {inv.user.name}{' '}
                <span className="text-slate-500">({inv.user.email})</span>
              </div>
              <div className="text-xs text-slate-500">
                Роль: {inv.role}
                {inv.invitedBy?.name ? ` · пригласил ${inv.invitedBy.name}` : ''}
              </div>
            </div>
            <button
              type="button"
              disabled={cancellingId === inv.id}
              onClick={() => void handleCancel(inv.id)}
              className="flex-shrink-0 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
              title="Отменить приглашение"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
