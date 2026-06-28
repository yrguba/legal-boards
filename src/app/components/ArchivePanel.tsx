import { useCallback, useEffect, useState } from 'react';
import { Archive, LayoutGrid, ListTodo, RotateCcw, Trash2 } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { boardsApi, tasksApi, workspacesApi } from '../services/api';
import { useWorkspacePermissions } from '../utils/workspacePermissions';
import type { ArchivedBoard, ArchivedTask } from '../types';
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

type ArchiveTab = 'boards' | 'tasks';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function ArchivePanel() {
  const { currentWorkspace, currentUser } = useApp();
  const { canManageWorkspace } = useWorkspacePermissions();
  const workspaceId = currentWorkspace?.id;

  const [tab, setTab] = useState<ArchiveTab>('boards');
  const [boards, setBoards] = useState<ArchivedBoard[]>([]);
  const [tasks, setTasks] = useState<ArchivedTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [permanentTarget, setPermanentTarget] = useState<
    { kind: 'board'; item: ArchivedBoard } | { kind: 'task'; item: ArchivedTask } | null
  >(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const [b, t] = await Promise.all([
        workspacesApi.getArchivedBoards(workspaceId),
        workspacesApi.getArchivedTasks(workspaceId),
      ]);
      setBoards(b);
      setTasks(t);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить архив');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canManageTask = (task: ArchivedTask) =>
    canManageWorkspace || task.creator?.id === currentUser?.id;

  const restoreBoard = async (board: ArchivedBoard) => {
    setBusyId(board.id);
    setError(null);
    try {
      await boardsApi.restore(board.id);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось восстановить доску');
    } finally {
      setBusyId(null);
    }
  };

  const restoreTask = async (task: ArchivedTask) => {
    setBusyId(task.id);
    setError(null);
    try {
      await tasksApi.restore(task.id);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось восстановить задачу');
    } finally {
      setBusyId(null);
    }
  };

  const confirmPermanentDelete = async () => {
    if (!permanentTarget) return;
    const id = permanentTarget.item.id;
    setBusyId(id);
    setError(null);
    try {
      if (permanentTarget.kind === 'board') {
        await boardsApi.deletePermanent(id);
      } else {
        await tasksApi.deletePermanent(id);
      }
      setPermanentTarget(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить безвозвратно');
    } finally {
      setBusyId(null);
    }
  };

  if (!workspaceId) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6 text-sm text-slate-600">
        Выберите рабочее пространство.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Archive className="w-5 h-5" />
            Архив
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Архивные доски и задачи можно восстановить или удалить безвозвратно.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="text-sm text-brand hover:underline disabled:opacity-50"
        >
          Обновить
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTab('boards')}
          className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors',
            tab === 'boards' ? 'bg-brand-light text-brand' : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          <LayoutGrid className="w-4 h-4" />
          Доски ({boards.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('tasks')}
          className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors',
            tab === 'tasks' ? 'bg-brand-light text-brand' : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          <ListTodo className="w-4 h-4" />
          Задачи ({tasks.length})
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-600 py-8 text-center">Загрузка…</p>
      ) : tab === 'boards' ? (
        boards.length === 0 ? (
          <p className="text-sm text-slate-600 py-8 text-center">Архив досок пуст</p>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
            {boards.map((board) => (
              <div
                key={board.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 truncate">
                    {board.name}
                    {board.kind === 'aggregated' ? (
                      <span className="ml-2 text-xs font-normal text-slate-500">сводная</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {board.code} · {formatDate(board.archivedAt)}
                    {board.archivedBy?.name ? ` · ${board.archivedBy.name}` : ''}
                  </div>
                </div>
                {canManageWorkspace ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busyId === board.id}
                      onClick={() => void restoreBoard(board)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Восстановить
                    </button>
                    <button
                      type="button"
                      disabled={busyId === board.id}
                      onClick={() => setPermanentTarget({ kind: 'board', item: board })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Удалить
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )
      ) : tasks.length === 0 ? (
        <p className="text-sm text-slate-600 py-8 text-center">Архив задач пуст</p>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="font-medium text-slate-900 truncate">
                  {task.key ? `${task.key} · ` : ''}
                  {task.title}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {task.board.name} · {formatDate(task.archivedAt)}
                  {task.archivedWithBoardId ? ' · с доской' : ''}
                  {task.archivedBy?.name ? ` · ${task.archivedBy.name}` : ''}
                </div>
              </div>
              {canManageTask(task) ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busyId === task.id || !!task.archivedWithBoardId}
                    title={
                      task.archivedWithBoardId
                        ? 'Восстановите доску, чтобы вернуть эту задачу'
                        : undefined
                    }
                    onClick={() => void restoreTask(task)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Восстановить
                  </button>
                  <button
                    type="button"
                    disabled={busyId === task.id}
                    onClick={() => setPermanentTarget({ kind: 'task', item: task })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Удалить
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={permanentTarget !== null}
        onOpenChange={(open) => {
          if (!open && !busyId) setPermanentTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить безвозвратно?</AlertDialogTitle>
            <AlertDialogDescription>
              {permanentTarget?.kind === 'board'
                ? `Доска «${permanentTarget.item.name}» и все связанные данные будут удалены навсегда.`
                : `Задача «${permanentTarget?.item.title}» будет удалена навсегда.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busyId}>Отмена</AlertDialogCancel>
            <button
              type="button"
              disabled={!!busyId}
              className={cn(
                buttonVariants(),
                'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600',
              )}
              onClick={() => void confirmPermanentDelete()}
            >
              {busyId ? 'Удаление…' : 'Удалить навсегда'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
