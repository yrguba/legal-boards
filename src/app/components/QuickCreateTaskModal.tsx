import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { Board, User } from '../types';
import { useApp } from '../store/AppContext';
import { boardsApi, tasksApi, usersApi } from '../services/api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { richEditorDialogHandlers } from './markdown';
import { TaskCreateFormFields, useTaskCreateForm, uploadPendingTaskAttachments } from './TaskCreateFormFields';

const selectClassName =
  'w-full rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-inset';

function sortColumns(board: Board | null) {
  return [...(board?.columns || [])].sort((a, b) => a.position - b.position);
}

export type QuickCreateSuccess = {
  key?: string;
  title: string;
};

interface QuickCreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (task: QuickCreateSuccess) => void;
}

export function QuickCreateTaskModal({ open, onOpenChange, onSuccess }: QuickCreateTaskModalProps) {
  const { currentUser, currentWorkspace, workspaces } = useApp();
  const [workspaceId, setWorkspaceId] = useState('');
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardId, setBoardId] = useState('');
  const [columnId, setColumnId] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdTask, setCreatedTask] = useState<QuickCreateSuccess | null>(null);

  const selectedBoard = useMemo(
    () => boards.find((b) => b.id === boardId) ?? null,
    [boards, boardId],
  );
  const sortedColumns = useMemo(() => sortColumns(selectedBoard), [selectedBoard]);
  const form = useTaskCreateForm(selectedBoard);

  const creatableBoards = useMemo(
    () => boards.filter((b) => b.kind !== 'aggregated'),
    [boards],
  );

  const resetFormState = () => {
    setBoardId('');
    setColumnId('');
    setBoards([]);
    setUsers([]);
    setLoadError(null);
    setError(null);
    setCreatedTask(null);
  };

  const handleClose = () => {
    resetFormState();
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) return;
    setWorkspaceId(currentWorkspace?.id || workspaces[0]?.id || '');
    resetFormState();
  }, [open, currentWorkspace?.id, workspaces]);

  useEffect(() => {
    if (!open || !workspaceId) return;

    let cancelled = false;
    setLoadingBoards(true);
    setLoadingUsers(true);
    setLoadError(null);
    setBoardId('');
    setColumnId('');
    setBoards([]);
    setUsers([]);

    Promise.all([boardsApi.getByWorkspace(workspaceId), usersApi.getByWorkspace(workspaceId)])
      .then(([boardList, userList]) => {
        if (cancelled) return;
        const list = (Array.isArray(boardList) ? boardList : []) as Board[];
        const standardBoards = list.filter((b) => b.kind !== 'aggregated');
        setBoards(list);
        setUsers(Array.isArray(userList) ? userList : []);

        if (standardBoards.length === 1) {
          const only = standardBoards[0];
          setBoardId(only.id);
          const cols = sortColumns(only);
          setColumnId(cols[0]?.id || '');
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить данные пространства');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingBoards(false);
          setLoadingUsers(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, workspaceId]);

  useEffect(() => {
    if (!boardId) {
      setColumnId('');
      return;
    }
    const board = boards.find((b) => b.id === boardId);
    const cols = sortColumns(board ?? null);
    setColumnId((prev) => (prev && cols.some((c) => c.id === prev) ? prev : cols[0]?.id || ''));
  }, [boardId, boards]);

  const boardReady = Boolean(
    selectedBoard &&
      (selectedBoard.taskTypes?.length ?? 0) > 0 &&
      sortedColumns.length > 0 &&
      columnId,
  );

  const submit = async () => {
    if (!selectedBoard || !columnId) return;

    setError(null);
    const validationError = form.validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = form.buildPayload();
      const created = await tasksApi.create({
        boardId: selectedBoard.id,
        columnId,
        ...payload,
      });

      if (form.pendingFiles.length > 0 && created?.id) {
        await uploadPendingTaskAttachments(String(created.id), form.pendingFiles);
      }

      const success: QuickCreateSuccess = {
        key: typeof created?.key === 'string' ? created.key : undefined,
        title: payload.title,
      };

      setCreatedTask(success);
      onSuccess?.(success);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось создать задачу');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent
        className="flex max-h-[min(90vh,calc(100dvh-2rem))] flex-col gap-4 overflow-hidden sm:max-w-2xl"
        {...richEditorDialogHandlers}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>Быстрое создание задачи</DialogTitle>
        </DialogHeader>

        {createdTask ? (
          <div className="space-y-4 px-2 py-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Задача «{createdTask.title}» создана
              {createdTask.key ? ` (${createdTask.key})` : ''}.
            </div>
            <div className="flex flex-wrap gap-2">
              {createdTask.key ? (
                <Link
                  to={`/task/${createdTask.key}`}
                  onClick={handleClose}
                  className="rounded bg-brand px-4 py-2 text-sm text-white hover:bg-brand-hover"
                >
                  Открыть задачу
                </Link>
              ) : null}
              <button
                type="button"
                onClick={handleClose}
                className="rounded px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Закрыть
              </button>
            </div>
          </div>
        ) : (
          <>
            {(error || loadError) && (
              <div className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error || loadError}
              </div>
            )}

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto overscroll-contain px-2 py-2 pb-4 [-webkit-overflow-scrolling:touch]">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Пространство *</label>
                <select
                  value={workspaceId}
                  onChange={(e) => setWorkspaceId(e.target.value)}
                  className={selectClassName}
                  disabled={loadingBoards}
                >
                  <option value="" disabled>
                    Выберите пространство
                  </option>
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Доска *</label>
                <select
                  value={boardId}
                  onChange={(e) => setBoardId(e.target.value)}
                  className={selectClassName}
                  disabled={loadingBoards || !workspaceId || creatableBoards.length === 0}
                >
                  <option value="" disabled>
                    {loadingBoards
                      ? 'Загрузка…'
                      : creatableBoards.length === 0
                        ? 'Нет доступных досок'
                        : 'Выберите доску'}
                  </option>
                  {creatableBoards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {!loadingBoards && workspaceId && creatableBoards.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">
                    В этом пространстве нет досок для создания задач.
                  </p>
                ) : null}
              </div>

              {selectedBoard ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Колонка *</label>
                  <select
                    value={columnId}
                    onChange={(e) => setColumnId(e.target.value)}
                    className={selectClassName}
                    disabled={sortedColumns.length === 0}
                  >
                    <option value="" disabled>
                      {sortedColumns.length === 0 ? 'Нет колонок' : 'Выберите колонку'}
                    </option>
                    {sortedColumns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {selectedBoard && (selectedBoard.taskTypes?.length ?? 0) === 0 ? (
                <p className="text-sm text-amber-700">
                  На доске нет типов задач — создание недоступно.
                </p>
              ) : null}

              {boardReady ? (
                <TaskCreateFormFields
                  form={form}
                  users={users}
                  authorName={currentUser?.name}
                  board={selectedBoard}
                  key={`${selectedBoard!.id}-${columnId}`}
                />
              ) : null}
            </div>

            <DialogFooter className="shrink-0 gap-2 border-t border-slate-100 pt-4 sm:gap-0">
              <button
                type="button"
                onClick={handleClose}
                className="rounded px-4 py-2 text-slate-700 transition-colors hover:bg-slate-100"
                disabled={isSubmitting}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                className="rounded bg-brand px-4 py-2 text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting || !boardReady || !form.canSubmit || loadingUsers}
              >
                {isSubmitting ? 'Создание…' : 'Создать'}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
