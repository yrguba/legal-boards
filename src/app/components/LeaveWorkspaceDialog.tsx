import { useEffect, useMemo, useState } from 'react';
import { usersApi, workspacesApi } from '../services/api';
import { useApp } from '../store/AppContext';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { buttonVariants } from './ui/button';
import { cn } from './ui/utils';

type WorkspaceRef = {
  id: string;
  name: string;
  isOwner: boolean;
};

type Props = {
  open: boolean;
  workspace: WorkspaceRef;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void | Promise<void>;
};

export function LeaveWorkspaceDialog({ open, workspace, onOpenChange, onSuccess }: Props) {
  const { currentUser, refreshWorkspaces } = useApp();
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownershipTransferred, setOwnershipTransferred] = useState(false);

  const colleagues = useMemo(
    () => members.filter((m) => m.id !== currentUser?.id),
    [members, currentUser?.id],
  );
  const soleMember = colleagues.length === 0;

  useEffect(() => {
    if (!open) {
      setNewOwnerId('');
      setError(null);
      setOwnershipTransferred(false);
      return;
    }

    setLoadingMembers(true);
    void usersApi
      .getByWorkspace(workspace.id)
      .then((rows) => {
        setMembers(rows.map((r: { id: string; name: string }) => ({ id: r.id, name: r.name })));
      })
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  }, [open, workspace.id]);

  const finishLeave = async () => {
    setBusy(true);
    setError(null);
    try {
      await workspacesApi.leave(workspace.id);
      onOpenChange(false);
      await refreshWorkspaces();
      await onSuccess?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось покинуть пространство');
    } finally {
      setBusy(false);
    }
  };

  const handleTransferAndPrepareLeave = async () => {
    if (!newOwnerId) {
      setError('Выберите нового владельца');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await workspacesApi.transferOwnership(workspace.id, newOwnerId);
      setOwnershipTransferred(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось передать владение');
    } finally {
      setBusy(false);
    }
  };

  const title = workspace.isOwner
    ? soleMember
      ? 'Покинуть и удалить пространство?'
      : ownershipTransferred
        ? 'Покинуть пространство?'
        : 'Передать владение'
    : 'Покинуть пространство?';

  const description = workspace.isOwner
    ? soleMember
      ? `Вы единственный участник «${workspace.name}». Пространство и все его данные будут удалены.`
      : ownershipTransferred
        ? `Владение «${workspace.name}» передано. Подтвердите выход из пространства.`
        : `Выберите, кому передать владение «${workspace.name}», затем вы сможете покинуть его.`
    : `Вы перестанете быть участником «${workspace.name}».`;

  return (
    <AlertDialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {workspace.isOwner && !soleMember && !ownershipTransferred ? (
          <div className="space-y-2">
            {loadingMembers ? (
              <p className="text-sm text-slate-600">Загрузка участников…</p>
            ) : (
              <>
                <label className="block text-sm font-medium text-slate-700">Новый владелец</label>
                <select
                  value={newOwnerId}
                  onChange={(e) => setNewOwnerId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— выберите участника —</option>
                  {colleagues.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel>
          {workspace.isOwner && !soleMember && !ownershipTransferred ? (
            <button
              type="button"
              disabled={busy || !newOwnerId || loadingMembers}
              className={cn(buttonVariants(), 'bg-brand text-white hover:bg-brand-hover')}
              onClick={() => void handleTransferAndPrepareLeave()}
            >
              {busy ? 'Передача…' : 'Передать владение'}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              className={cn(
                buttonVariants(),
                soleMember && workspace.isOwner
                  ? 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600'
                  : 'bg-brand text-white hover:bg-brand-hover',
              )}
              onClick={() => void finishLeave()}
            >
              {busy ? 'Выход…' : soleMember && workspace.isOwner ? 'Покинуть и удалить' : 'Покинуть'}
            </button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
