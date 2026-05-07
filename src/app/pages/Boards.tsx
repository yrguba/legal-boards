import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Plus, LayoutGrid, List, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { CreateBoardModal } from '../components/CreateBoardModal';
import { boardsApi, tasksApi } from '../services/api';
import type { Board } from '../types';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { buttonVariants } from '../components/ui/button';
import { cn } from '../components/ui/utils';

export function Boards() {
  const { currentWorkspace, currentUser } = useApp();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [editingBoardColumnTaskCounts, setEditingBoardColumnTaskCounts] = useState<
    Record<string, number>
  >({});
  const [editingBoardTypeTaskCounts, setEditingBoardTypeTaskCounts] = useState<Record<string, number>>(
    {}
  );
  const [workspaceBoards, setWorkspaceBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boardPendingDelete, setBoardPendingDelete] = useState<Board | null>(null);
  const [isDeletingBoard, setIsDeletingBoard] = useState(false);
  const canCreateBoards = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  useEffect(() => {
    const workspaceId = currentWorkspace?.id;
    if (!workspaceId) {
      setWorkspaceBoards([]);
      return;
    }

    let isCancelled = false;

    const loadBoards = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const boards = await boardsApi.getByWorkspace(workspaceId);
        if (!isCancelled) setWorkspaceBoards(boards);
      } catch (e: any) {
        if (!isCancelled) setError(e?.message || 'Не удалось загрузить доски');
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    loadBoards();

    return () => {
      isCancelled = true;
    };
  }, [currentWorkspace?.id]);

  useEffect(() => {
    const board = editingBoard;
    if (!board || !isEditModalOpen) return;

    let cancelled = false;
    const loadCounts = async () => {
      try {
        const tasks = await tasksApi.getByBoard(board.id);
        if (cancelled) return;
        const counts: Record<string, number> = {};
        const typeCounts: Record<string, number> = {};
        for (const t of tasks) {
          counts[t.columnId] = (counts[t.columnId] || 0) + 1;
          typeCounts[t.typeId] = (typeCounts[t.typeId] || 0) + 1;
        }
        setEditingBoardColumnTaskCounts(counts);
        setEditingBoardTypeTaskCounts(typeCounts);
      } catch {
        // ignore; deletion will be handled server-side anyway
      }
    };

    loadCounts();
    return () => {
      cancelled = true;
    };
  }, [editingBoard?.id, isEditModalOpen]);

  const handleCreateBoard = async (boardData: any) => {
    const workspaceId = currentWorkspace?.id;
    if (!workspaceId) {
      const err = new Error('Не выбрано рабочее пространство');
      setError(err.message);
      throw err;
    }

    setError(null);
    try {
      const created = await boardsApi.create({ ...boardData, workspaceId });
      // Works with both API variants: append and normalize missing fields.
      setWorkspaceBoards((prev) => [
        {
          ...created,
          viewMode: created?.viewMode || 'kanban',
          columns: created?.columns || [],
          taskFields: created?.taskFields || [],
          taskTypes: created?.taskTypes || [],
          visibility: created?.visibility || {},
        },
        ...prev,
      ]);
    } catch (e: any) {
      setError(e?.message || 'Не удалось создать доску');
      throw e;
    }
  };

  const handleEditBoard = async (boardData: any) => {
    if (!editingBoard) {
      const err = new Error('Не выбрана доска для редактирования');
      setError(err.message);
      throw err;
    }

    setError(null);
    try {
      const updated = await boardsApi.update(editingBoard.id, boardData);
      setWorkspaceBoards((prev) =>
        prev.map((b) =>
          b.id === editingBoard.id
            ? {
                ...updated,
                viewMode: updated?.viewMode || 'kanban',
                columns: updated?.columns || [],
                taskFields: updated?.taskFields || [],
                taskTypes: updated?.taskTypes || [],
                visibility: updated?.visibility || {},
              }
            : b
        )
      );
    } catch (e: any) {
      setError(e?.message || 'Не удалось обновить доску');
      throw e;
    }
  };

  const confirmDeleteBoard = async () => {
    if (!boardPendingDelete) return;
    setError(null);
    setIsDeletingBoard(true);
    try {
      await boardsApi.delete(boardPendingDelete.id);
      const removedId = boardPendingDelete.id;
      setBoardPendingDelete(null);
      setWorkspaceBoards((prev) => prev.filter((b) => b.id !== removedId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить доску');
    } finally {
      setIsDeletingBoard(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Рабочие доски</h1>
          <p className="text-sm text-slate-600 mt-1">
            Управление задачами и проектами
          </p>
        </div>
        {canCreateBoards && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Создать доску
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <div className="text-sm text-slate-600">Загрузка досок…</div>
        </div>
      ) : (
        workspaceBoards.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <LayoutGrid className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">Нет досок</h3>
            <p className="text-sm text-slate-600 mb-4">
              Создайте первую рабочую доску для начала работы
            </p>
            {canCreateBoards && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-colors"
              >
                Создать доску
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaceBoards.map((board) => (
              <div
                key={board.id}
                className="bg-white rounded-lg border border-slate-200 p-5 hover:border-brand hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/board/${board.code || board.id}`}
                      className="block font-medium text-slate-900 mb-1 group-hover:text-brand transition-colors"
                    >
                      {board.name}
                    </Link>
                    <p className="text-sm text-slate-600 line-clamp-2">{board.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(board.viewMode || 'kanban') === 'kanban' ? (
                      <LayoutGrid className="w-5 h-5 text-slate-400" />
                    ) : (
                      <List className="w-5 h-5 text-slate-400" />
                    )}
                    {canCreateBoards && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingBoardColumnTaskCounts({});
                            setEditingBoardTypeTaskCounts({});
                            setEditingBoard(board);
                            setIsEditModalOpen(true);
                          }}
                          className="p-2 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                          aria-label="Редактировать доску"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setBoardPendingDelete(board);
                          }}
                          className="p-2 rounded hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"
                          aria-label="Удалить доску"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{board.columns?.length || 0} колонок</span>
                  <span>{board.taskTypes?.length || 0} типов задач</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <CreateBoardModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateBoard}
      />

      <CreateBoardModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingBoard(null);
          setEditingBoardColumnTaskCounts({});
          setEditingBoardTypeTaskCounts({});
        }}
        onSubmit={handleEditBoard}
        initialData={editingBoard}
        submitLabel="Сохранить изменения"
        columnTaskCounts={editingBoardColumnTaskCounts}
        typeTaskCounts={editingBoardTypeTaskCounts}
      />

      <AlertDialog
        open={boardPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeletingBoard) setBoardPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить доску?</AlertDialogTitle>
            <AlertDialogDescription>
              Доска «{boardPendingDelete?.name}» и все связанные задачи будут удалены без возможности восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingBoard}>Отмена</AlertDialogCancel>
            <button
              type="button"
              disabled={isDeletingBoard}
              className={cn(
                buttonVariants(),
                'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600',
              )}
              onClick={() => void confirmDeleteBoard()}
            >
              {isDeletingBoard ? 'Удаление…' : 'Удалить'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
