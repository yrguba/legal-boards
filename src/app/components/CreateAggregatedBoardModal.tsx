import { useEffect, useState } from 'react';
import { GripVertical, Layers, X } from 'lucide-react';
import type { Board } from '../types';
import { useApp } from '../store/AppContext';
import { useEmployees } from '../store/EmployeesContext';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    code: string;
    description?: string;
    visibility: Record<string, unknown>;
    sourceBoardIds: string[];
  }) => void | Promise<void>;
  availableBoards: Board[];
  initialData?: Board | null;
  submitLabel?: string;
};

function SortableBoardRow({
  board,
  onRemove,
}: {
  board: Board;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: board.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
    >
      <button
        type="button"
        className="cursor-grab text-slate-400 hover:text-slate-600"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900 truncate">{board.name}</div>
        <div className="text-xs text-slate-500">{board.code}</div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(board.id)}
        className="text-slate-400 hover:text-red-600"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function CreateAggregatedBoardModal({
  isOpen,
  onClose,
  onSubmit,
  availableBoards,
  initialData,
  submitLabel = 'Создать сводную доску',
}: Props) {
  const { currentWorkspace } = useApp();
  const { departments, groups } = useEmployees();
  const [boardName, setBoardName] = useState('');
  const [boardCode, setBoardCode] = useState('');
  const [boardDescription, setBoardDescription] = useState('');
  const [visibilityType, setVisibilityType] = useState<'workspace' | 'department' | 'group'>(
    'workspace',
  );
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const workspaceDepartments = departments.filter((d) => d.workspaceId === currentWorkspace?.id);
  const workspaceGroups = groups.filter((g) => g.workspaceId === currentWorkspace?.id);
  const selectableBoards = availableBoards.filter(
    (b) => b.kind !== 'aggregated' && b.id !== initialData?.id,
  );
  const selectedBoards = selectedBoardIds
    .map((id) => selectableBoards.find((b) => b.id === id))
    .filter((b): b is Board => !!b);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setBoardName(initialData.name);
      setBoardCode(initialData.code);
      setBoardDescription(initialData.description || '');
      const vis = initialData.visibility || {};
      if (vis.departmentIds?.length) {
        setVisibilityType('department');
        setSelectedDepartments(vis.departmentIds);
        setSelectedGroups([]);
      } else if (vis.groupIds?.length) {
        setVisibilityType('group');
        setSelectedGroups(vis.groupIds);
        setSelectedDepartments([]);
      } else {
        setVisibilityType('workspace');
        setSelectedDepartments([]);
        setSelectedGroups([]);
      }
      setSelectedBoardIds((initialData.sources || []).sort((a, b) => a.position - b.position).map((s) => s.id));
    } else {
      setBoardName('');
      setBoardCode('');
      setBoardDescription('');
      setVisibilityType('workspace');
      setSelectedDepartments([]);
      setSelectedGroups([]);
      setSelectedBoardIds([]);
    }
    setSubmitError(null);
  }, [isOpen, initialData]);

  const toggleBoard = (boardId: string) => {
    setSelectedBoardIds((prev) =>
      prev.includes(boardId) ? prev.filter((id) => id !== boardId) : [...prev, boardId],
    );
  };

  const handleDragEnd = (event: { active: { id: string | number }; over: { id: string | number } | null }) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSelectedBoardIds((prev) => {
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardName.trim() || !boardCode.trim()) {
      setSubmitError('Укажите название и код');
      return;
    }
    if (selectedBoardIds.length === 0) {
      setSubmitError('Выберите хотя бы одну доску');
      return;
    }

    const visibility: Record<string, unknown> = {};
    if (visibilityType === 'department') {
      if (selectedDepartments.length === 0) {
        setSubmitError('Выберите отделы для доступа');
        return;
      }
      visibility.departmentIds = selectedDepartments;
    } else if (visibilityType === 'group') {
      if (selectedGroups.length === 0) {
        setSubmitError('Выберите группы для доступа');
        return;
      }
      visibility.groupIds = selectedGroups;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({
        name: boardName.trim(),
        code: boardCode.trim().toUpperCase(),
        description: boardDescription.trim() || undefined,
        visibility,
        sourceBoardIds: selectedBoardIds,
      });
      onClose();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-brand" />
            <h2 className="text-xl font-semibold text-slate-900">
              {initialData ? 'Редактировать сводную доску' : 'Создать сводную доску'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="size-5 text-slate-600" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          {submitError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Название *</label>
              <input
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Код *</label>
              <input
                value={boardCode}
                onChange={(e) => setBoardCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Описание</label>
            <textarea
              value={boardDescription}
              onChange={(e) => setBoardDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Доступ к сводной</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={visibilityType === 'workspace'}
                  onChange={() => setVisibilityType('workspace')}
                />
                Все участники пространства
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={visibilityType === 'department'}
                  onChange={() => setVisibilityType('department')}
                />
                По отделам
              </label>
              {visibilityType === 'department' ? (
                <div className="ml-6 space-y-1 max-h-32 overflow-y-auto">
                  {workspaceDepartments.map((dept) => (
                    <label key={dept.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedDepartments.includes(dept.id)}
                        onChange={() =>
                          setSelectedDepartments((prev) =>
                            prev.includes(dept.id)
                              ? prev.filter((id) => id !== dept.id)
                              : [...prev, dept.id],
                          )
                        }
                      />
                      {dept.name}
                    </label>
                  ))}
                </div>
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={visibilityType === 'group'}
                  onChange={() => setVisibilityType('group')}
                />
                По группам
              </label>
              {visibilityType === 'group' ? (
                <div className="ml-6 space-y-1 max-h-32 overflow-y-auto">
                  {workspaceGroups.map((group) => (
                    <label key={group.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedGroups.includes(group.id)}
                        onChange={() =>
                          setSelectedGroups((prev) =>
                            prev.includes(group.id)
                              ? prev.filter((id) => id !== group.id)
                              : [...prev, group.id],
                          )
                        }
                      />
                      {group.name}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Доски в сводной *
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Порядок выбранных досок задаёт порядок колонок. Сводные доски недоступны для включения.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                {selectableBoards.length === 0 ? (
                  <p className="text-sm text-slate-500">Нет доступных досок</p>
                ) : (
                  selectableBoards.map((board) => (
                    <label key={board.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBoardIds.includes(board.id)}
                        onChange={() => toggleBoard(board.id)}
                      />
                      <span className="truncate">
                        {board.name} <span className="text-slate-400">({board.code})</span>
                      </span>
                    </label>
                  ))
                )}
              </div>
              <div>
                <div className="text-xs font-medium text-slate-600 mb-2">Порядок колонок</div>
                {selectedBoards.length === 0 ? (
                  <p className="text-sm text-slate-400">Выберите доски слева</p>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={selectedBoardIds} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {selectedBoards.map((board) => (
                          <SortableBoardRow
                            key={board.id}
                            board={board}
                            onRemove={(id) =>
                              setSelectedBoardIds((prev) => prev.filter((x) => x !== id))
                            }
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-brand text-white rounded hover:bg-brand-primary-hover disabled:opacity-50"
            >
              {submitting ? 'Сохранение…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
