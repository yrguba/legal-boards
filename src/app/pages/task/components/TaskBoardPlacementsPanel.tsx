import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { boardsApi, tasksApi } from '../../../services/api';
import type { Board, TaskBoardPlacement } from '../../../types';
import { ApiError } from '../../../services/api';
import { ConfirmAddToBoardDialog } from '../../../components/ConfirmAddToBoardDialog';

type Props = {
  taskId: string;
  workspaceId: string;
  placements: TaskBoardPlacement[];
  onPlacementsChange: (placements: TaskBoardPlacement[]) => void;
};

export function TaskBoardPlacementsPanel({
  taskId,
  workspaceId,
  placements,
  onPlacementsChange,
}: Props) {
  const [items, setItems] = useState<TaskBoardPlacement[]>(placements);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setItems(placements);
  }, [placements]);

  useEffect(() => {
    let cancelled = false;
    void boardsApi.getByWorkspace(workspaceId).then((rows) => {
      if (!cancelled) setBoards(rows as Board[]);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const addableBoards = useMemo(
    () =>
      boards.filter(
        (b) => b.kind !== 'aggregated' && !items.some((p) => p.boardId === b.id),
      ),
    [boards, items],
  );

  useEffect(() => {
    if (!selectedBoardId && addableBoards[0]) {
      setSelectedBoardId(addableBoards[0].id);
    }
  }, [addableBoards, selectedBoardId]);

  const refresh = async () => {
    const res = await tasksApi.getPlacements(taskId);
    setItems(res.placements);
    onPlacementsChange(res.placements);
  };

  const selectedBoard = addableBoards.find((b) => b.id === selectedBoardId);

  const handleAdd = async () => {
    if (!selectedBoardId) return;
    setLoading(true);
    setError(null);
    try {
      await tasksApi.addPlacement(taskId, { boardId: selectedBoardId });
      await refresh();
      setSelectedBoardId('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось добавить на доску');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (boardId: string) => {
    setLoading(true);
    setError(null);
    try {
      await tasksApi.removePlacement(taskId, boardId);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось снять с доски');
    } finally {
      setLoading(false);
    }
  };

  if (items.length <= 1 && addableBoards.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-slate-200 pt-4 mt-4">
      <div className="mb-2 flex items-center gap-2">
        <LayoutGrid className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-medium text-slate-900">На досках</h3>
      </div>

      {error ? (
        <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      <ul className="space-y-2">
        {items.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <Link
                to={`/boards/${p.boardCode || p.boardId}`}
                className="font-medium text-brand hover:underline"
              >
                {p.boardName}
              </Link>
              <div className="text-xs text-slate-600">
                {p.columnName}
                {p.isPrimary ? (
                  <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
                    основная
                  </span>
                ) : null}
              </div>
            </div>
            {!p.isPrimary ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleRemove(p.boardId)}
                className="shrink-0 rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                title="Снять с доски"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {addableBoards.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={selectedBoardId}
            onChange={(e) => setSelectedBoardId(e.target.value)}
            disabled={loading}
            className="min-w-[180px] flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Выберите доску…</option>
            {addableBoards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={loading || !selectedBoardId}
            onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center gap-1 rounded bg-brand px-3 py-1.5 text-sm text-white hover:bg-brand-hover disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Добавить
          </button>
        </div>
      ) : null}

      <ConfirmAddToBoardDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        description={
          selectedBoard
            ? `Задача будет добавлена на доску «${selectedBoard.name}». На текущих досках она останется.`
            : 'Задача будет добавлена на выбранную доску.'
        }
        loading={loading}
        onConfirm={() => {
          void handleAdd().finally(() => setConfirmOpen(false));
        }}
      />
    </div>
  );
}
