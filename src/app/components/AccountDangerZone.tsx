import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { LogOut, UserX } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { usersApi } from '../services/api';
import type { AccountDeletionPrecheck } from '../types';
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
import { PasswordInput } from './PasswordInput';
import { LeaveWorkspaceDialog } from './LeaveWorkspaceDialog';

export function AccountDangerZone() {
  const { currentUser, currentWorkspace, logout, refreshWorkspaces } = useApp();
  const [precheck, setPrecheck] = useState<AccountDeletionPrecheck | null>(null);
  const [loadingPrecheck, setLoadingPrecheck] = useState(true);
  const [precheckError, setPrecheckError] = useState<string | null>(null);

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadPrecheck = useCallback(async () => {
    setLoadingPrecheck(true);
    setPrecheckError(null);
    try {
      const data = await usersApi.getDeleteAccountPrecheck();
      setPrecheck(data);
    } catch (e: unknown) {
      setPrecheckError(e instanceof Error ? e.message : 'Не удалось проверить возможность удаления');
    } finally {
      setLoadingPrecheck(false);
    }
  }, []);

  useEffect(() => {
    void loadPrecheck();
  }, [loadPrecheck]);

  const confirmDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await usersApi.deleteAccount(deletePassword);
      setDeleteOpen(false);
      logout();
      window.location.href = '/login';
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Не удалось удалить аккаунт');
    } finally {
      setDeleting(false);
    }
  };

  const currentOwned = precheck?.ownedWorkspaces.find((w) => w.id === currentWorkspace?.id);

  return (
    <section className="border-t border-slate-200 pt-6 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Пространства и аккаунт</h3>
        <p className="text-sm text-slate-600">
          Выход из пространства или полное удаление учётной записи из Legal Boards.
        </p>
      </div>

      {currentWorkspace ? (
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-900">{currentWorkspace.name}</p>
          <p className="text-xs text-slate-500 mt-1">
            {currentWorkspace.isOwner
              ? currentOwned?.soleMember
                ? 'Вы единственный участник — при выходе пространство будет удалено'
                : currentOwned?.needsTransfer
                  ? 'Перед выходом передайте владение другому участнику'
                  : 'Владелец пространства'
              : 'Участник пространства'}
          </p>
          <button
            type="button"
            onClick={() => setLeaveOpen(true)}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50"
          >
            <LogOut className="size-4" />
            Покинуть пространство
          </button>
          {currentWorkspace.isOwner && currentOwned?.needsTransfer ? (
            <p className="text-xs text-amber-700 mt-2">
              Сначала передайте владение другому участнику в диалоге или на{' '}
              <Link to="/workspaces" className="underline hover:text-amber-900">
                странице «Пространства»
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
        <p className="text-sm font-medium text-red-900 flex items-center gap-2">
          <UserX className="size-4" />
          Удалить аккаунт
        </p>
        <p className="text-xs text-red-800/90 mt-1">
          Аккаунт будет удалён безвозвратно. Email{' '}
          <span className="font-medium">{precheck?.email ?? currentUser?.email}</span> можно будет
          использовать для новой регистрации.
        </p>

        {loadingPrecheck ? (
          <p className="text-xs text-slate-600 mt-3">Проверка…</p>
        ) : precheckError ? (
          <p className="text-xs text-red-700 mt-3">{precheckError}</p>
        ) : precheck && !precheck.canDelete ? (
          <ul className="text-xs text-red-800 mt-3 space-y-1 list-disc ml-4">
            {precheck.blockers.map((b) => (
              <li key={b.code}>{b.message}</li>
            ))}
          </ul>
        ) : null}

        {precheck?.canDelete ? (
          <button
            type="button"
            onClick={() => {
              setDeletePassword('');
              setDeleteError(null);
              setDeleteOpen(true);
            }}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-700 border border-red-300 rounded hover:bg-red-100/80"
          >
            Удалить аккаунт…
          </button>
        ) : (
          <Link
            to="/workspaces"
            className="mt-3 inline-block text-xs text-brand hover:underline"
          >
            Управление пространствами →
          </Link>
        )}
      </div>

      {currentWorkspace ? (
        <LeaveWorkspaceDialog
          open={leaveOpen}
          workspace={{ id: currentWorkspace.id, name: currentWorkspace.name, isOwner: !!currentWorkspace.isOwner }}
          onOpenChange={setLeaveOpen}
          onSuccess={async () => {
            await refreshWorkspaces();
            await loadPrecheck();
          }}
        />
      ) : null}

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteOpen(false);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить аккаунт навсегда?</AlertDialogTitle>
            <AlertDialogDescription>
              Все ваши персональные данные будут удалены. Задачи и комментарии могут остаться в
              пространствах без привязки к вашему профилю. Email будет освобождён для повторной
              регистрации.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Пароль</label>
            <PasswordInput
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Введите текущий пароль"
            />
          </div>
          {deleteError ? (
            <p className="text-sm text-red-600" role="alert">
              {deleteError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <button
              type="button"
              disabled={deleting || !deletePassword}
              className={cn(
                buttonVariants(),
                'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600',
              )}
              onClick={() => void confirmDeleteAccount()}
            >
              {deleting ? 'Удаление…' : 'Удалить аккаунт'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
