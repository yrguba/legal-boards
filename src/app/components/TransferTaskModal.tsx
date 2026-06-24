import { useEffect, useMemo, useState } from 'react';
import { X, ArrowRightLeft } from 'lucide-react';
import { boardsApi, ApiError } from '../services/api';
import type { Board, TaskType } from '../types';
import { useApp } from '../store/AppContext';
import { ConfirmAddToBoardDialog } from './ConfirmAddToBoardDialog';

type Props = {
  open: boolean;
  sourceBoard: Board;
  taskIds: string[];
  onClose: () => void;
  onSuccess: (result: {
    mode: 'move' | 'mirror';
    moved: { taskId: string; oldKey: string; newKey: string; assigneeCleared?: boolean }[];
    added: { taskId: string; key: string; created: boolean }[];
    skipped: { taskId: string; reason: string; code?: string }[];
    warnings: { taskId: string; code: string; message: string }[];
  }) => void;
  /** Предзаполнение цели (например, drop на колонку сводной доски) */
  presetTargetBoardId?: string;
  presetTargetColumnId?: string;
  /** Ограничить список целевых досок (id) */
  restrictTargetBoardIds?: string[];
};

type BoardOption = Board & { workspaceName: string };

type TransferMode = 'move' | 'mirror';

export function TransferTaskModal({
  open,
  sourceBoard,
  taskIds,
  onClose,
  onSuccess,
  presetTargetBoardId,
  presetTargetColumnId,
  restrictTargetBoardIds,
}: Props) {
  const { workspaces } = useApp();
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [targetBoardId, setTargetBoardId] = useState('');
  const [targetColumnId, setTargetColumnId] = useState('');
  const [defaultTargetTypeId, setDefaultTargetTypeId] = useState('');
  const [typeMapping, setTypeMapping] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<TransferMode>('move');
  const [force, setForce] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTargetBoardId(presetTargetBoardId ?? '');
    setTargetColumnId(presetTargetColumnId ?? '');
    setDefaultTargetTypeId('');
    setTypeMapping({});
    setMode('move');
    setForce(false);
    setError(null);

    let cancelled = false;
    const load = async () => {
      setLoadingBoards(true);
      try {
        const restrict = restrictTargetBoardIds ? new Set(restrictTargetBoardIds) : null;
        const lists = await Promise.all(
          workspaces.map(async (ws) => {
            const items = (await boardsApi.getByWorkspace(ws.id)) as Board[];
            return items
              .filter((b) => b.id !== sourceBoard.id)
              .filter((b) => b.kind !== 'aggregated')
              .filter((b) => !restrict || restrict.has(b.id))
              .map((b) => ({ ...b, workspaceName: ws.name }));
          }),
        );
        if (!cancelled) setBoards(lists.flat());
      } catch {
        if (!cancelled) setError('Не удалось загрузить список досок');
      } finally {
        if (!cancelled) setLoadingBoards(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, sourceBoard.id, workspaces, presetTargetBoardId, presetTargetColumnId, restrictTargetBoardIds]);

  const targetBoard = useMemo(
    () => boards.find((b) => b.id === targetBoardId) ?? null,
    [boards, targetBoardId],
  );

  useEffect(() => {
    if (!targetBoard) {
      setTargetColumnId('');
      setDefaultTargetTypeId('');
      setTypeMapping({});
      return;
    }
    const sortedColumns = [...targetBoard.columns].sort((a, b) => a.position - b.position);
    const presetCol =
      presetTargetColumnId && sortedColumns.some((c) => c.id === presetTargetColumnId)
        ? presetTargetColumnId
        : sortedColumns[0]?.id ?? '';
    setTargetColumnId(presetCol);
    const firstType = targetBoard.taskTypes[0];
    setDefaultTargetTypeId(firstType?.id ?? '');

    const mapping: Record<string, string> = {};
    for (const srcType of sourceBoard.taskTypes) {
      const byName = targetBoard.taskTypes.find(
        (t) => t.name.trim().toLowerCase() === srcType.name.trim().toLowerCase(),
      );
      mapping[srcType.id] = byName?.id ?? firstType?.id ?? '';
    }
    setTypeMapping(mapping);
  }, [targetBoard, sourceBoard.taskTypes, presetTargetColumnId]);

  const groupedBoards = useMemo(() => {
    const map = new Map<string, BoardOption[]>();
    for (const b of boards) {
      const list = map.get(b.workspaceName) ?? [];
      list.push(b);
      map.set(b.workspaceName, list);
    }
    return [...map.entries()];
  }, [boards]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!targetBoardId) {
      setError('Выберите целевую доску');
      return;
    }
    setConfirmOpen(true);
  };

  const executeTransfer = async () => {
    if (!targetBoardId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await boardsApi.transferTasks(sourceBoard.id, {
        targetBoardId,
        targetColumnId: targetColumnId || undefined,
        taskIds,
        typeMapping,
        defaultTargetTypeId: defaultTargetTypeId || undefined,
        force,
        mode,
      });
      onSuccess(result);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось выполнить операцию');
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const sortedTargetColumns = targetBoard
    ? [...targetBoard.columns].sort((a, b) => a.position - b.position)
    : [];
  const targetColumnName =
    sortedTargetColumns.find((c) => c.id === targetColumnId)?.name ?? 'первая колонка';

  const confirmDescription =
    mode === 'mirror'
      ? `${taskIds.length === 1 ? 'Задача' : `${taskIds.length} задач`} будет добавлена на доску «${targetBoard?.name ?? '—'}» (колонка «${targetColumnName}»). На доске «${sourceBoard.name}» ${taskIds.length === 1 ? 'она останется' : 'они останутся'}.`
      : `${taskIds.length === 1 ? 'Задача' : `${taskIds.length} задач`} будет снята с доски «${sourceBoard.name}» и перенесена на «${targetBoard?.name ?? '—'}» (колонка «${targetColumnName}»).${mode === 'move' ? ' Если это основная доска задачи, ключ изменится.' : ''}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="size-5 text-brand" />
              {mode === 'mirror' ? 'Добавить на доску' : 'Перенос задач'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {taskIds.length === 1
                ? '1 задача'
                : `${taskIds.length} задач`}{' '}
              с доски «{sourceBoard.name}»
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Режим</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label
                className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                  mode === 'move'
                    ? 'border-brand bg-brand-light text-brand'
                    : 'border-slate-200 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="transfer-mode"
                  value="move"
                  checked={mode === 'move'}
                  onChange={() => setMode('move')}
                  className="sr-only"
                />
                <span className="font-medium">Перенести</span>
                <p className="mt-0.5 text-xs opacity-80">
                  Снять с текущей доски. У основной задачи — новый ключ.
                </p>
              </label>
              <label
                className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                  mode === 'mirror'
                    ? 'border-brand bg-brand-light text-brand'
                    : 'border-slate-200 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="transfer-mode"
                  value="mirror"
                  checked={mode === 'mirror'}
                  onChange={() => setMode('mirror')}
                  className="sr-only"
                />
                <span className="font-medium">Добавить копию</span>
                <p className="mt-0.5 text-xs opacity-80">
                  Оставить на текущей доске и появиться на целевой.
                </p>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Целевая доска
            </label>
            {loadingBoards ? (
              <p className="text-sm text-slate-500">Загрузка досок…</p>
            ) : boards.length === 0 ? (
              <p className="text-sm text-slate-500">Нет других досок для переноса</p>
            ) : (
              <select
                value={targetBoardId}
                onChange={(e) => setTargetBoardId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">— выберите доску —</option>
                {groupedBoards.map(([wsName, items]) => (
                  <optgroup key={wsName} label={wsName}>
                    {items.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </div>

          {targetBoard ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Колонка на целевой доске
                </label>
                <select
                  value={targetColumnId}
                  onChange={(e) => setTargetColumnId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {sortedTargetColumns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {sourceBoard.taskTypes.length > 0 ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Соответствие типов
                  </label>
                  <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                    {sourceBoard.taskTypes.map((src) => (
                      <TypeMappingRow
                        key={src.id}
                        sourceType={src}
                        targetTypes={targetBoard.taskTypes}
                        value={typeMapping[src.id] ?? ''}
                        onChange={(v) =>
                          setTypeMapping((prev) => ({ ...prev, [src.id]: v }))
                        }
                      />
                    ))}
                  </div>
                  <div className="mt-2">
                    <label className="block text-xs text-slate-500 mb-1">
                      Тип по умолчанию (если нет соответствия)
                    </label>
                    <select
                      value={defaultTargetTypeId}
                      onChange={(e) => setDefaultTargetTypeId(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      {targetBoard.taskTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">
                  Принудительный перенос при незавершённых согласованиях
                </span>
              </label>
            </>
          ) : null}
        </div>

        {error ? <p className="text-sm text-red-600 mt-4">{error}</p> : null}

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !targetBoardId || loadingBoards}
            className="px-4 py-2 text-sm rounded-lg bg-brand text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {submitting
              ? mode === 'mirror'
                ? 'Добавление…'
                : 'Перенос…'
              : mode === 'mirror'
                ? 'Добавить на доску'
                : 'Перенести'}
          </button>
        </div>
      </div>

      <ConfirmAddToBoardDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={mode === 'mirror' ? 'Добавить на другую доску?' : 'Перенести на другую доску?'}
        description={confirmDescription}
        confirmLabel={mode === 'mirror' ? 'Добавить' : 'Перенести'}
        loading={submitting}
        onConfirm={() => void executeTransfer()}
      />
    </div>
  );
}

function TypeMappingRow({
  sourceType,
  targetTypes,
  value,
  onChange,
}: {
  sourceType: TaskType;
  targetTypes: TaskType[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className="inline-flex shrink-0 items-center px-2 py-0.5 rounded text-xs font-medium text-white min-w-[4rem] justify-center"
        style={{ backgroundColor: sourceType.color }}
      >
        {sourceType.name}
      </span>
      <span className="text-slate-400">→</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm"
      >
        {targetTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
