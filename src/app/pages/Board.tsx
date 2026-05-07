import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { boardsApi, tasksApi, usersApi } from '../services/api';
import type { Board as BoardType, Task as TaskType, User as UserType } from '../types';
import {
  Plus,
  LayoutGrid,
  List,
  Filter,
  Settings,
  MoreHorizontal,
  GripVertical,
  Trash2,
} from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CreateTaskModal } from '../components/CreateTaskModal';
import { BoardSettingsModal } from '../features/board-settings/BoardSettingsModal';
import { TaskElapsedTimeDisplay } from '../components/TaskElapsedTimeDisplay';
import { boardTimeTrackingIsConfigured } from '../utils/boardTimeTracking';
import { useApp } from '../store/AppContext';
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

interface DroppableColumnProps {
  column: any;
  columnTasks: any[];
  getTaskTypeName: (typeId: string) => string;
  getTaskTypeColor: (typeId: string) => string;
  getAssigneeName: (userId?: string) => string;
  onCreateTask: (columnId: string) => void;
  boardTracksTime: boolean;
}

function DroppableColumn({
  column,
  columnTasks,
  getTaskTypeName,
  getTaskTypeColor,
  getAssigneeName,
  onCreateTask,
  boardTracksTime,
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <SortableContext
      items={columnTasks.map((t) => t.id)}
      strategy={verticalListSortingStrategy}
    >
      <div
        ref={setNodeRef}
        className={`flex-shrink-0 w-80 rounded-lg p-4 flex flex-col transition-colors ${
          isOver ? 'bg-brand-light ring-2 ring-brand' : 'bg-slate-50'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-medium text-slate-900">{column.name}</h3>
            {column.description && (
              <p className="text-xs text-slate-500 mt-0.5">{column.description}</p>
            )}
          </div>
          <span className="text-sm text-slate-500">{columnTasks.length}</span>
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto min-h-[200px]">
          {columnTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              getTaskTypeName={getTaskTypeName}
              getTaskTypeColor={getTaskTypeColor}
              getAssigneeName={getAssigneeName}
              boardTracksTime={boardTracksTime}
            />
          ))}
          {columnTasks.length === 0 && (
            <div className="flex items-center justify-center h-32 text-sm text-slate-400 border-2 border-dashed border-slate-300 rounded-lg">
              Перетащите задачу сюда
            </div>
          )}
        </div>

        <button
          onClick={() => onCreateTask(column.id)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
        >
          <Plus className="w-4 h-4" />
          Добавить задачу
        </button>
      </div>
    </SortableContext>
  );
}

interface TaskCardProps {
  task: any;
  getTaskTypeName: (typeId: string) => string;
  getTaskTypeColor: (typeId: string) => string;
  getAssigneeName: (userId?: string) => string;
  boardTracksTime: boolean;
}

function TaskCard({
  task,
  getTaskTypeName,
  getTaskTypeColor,
  getAssigneeName,
  boardTracksTime,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-lg p-4 border border-slate-200 hover:border-brand hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-1">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <Link
            to={`/task/${task.id}`}
            className="text-sm font-medium text-slate-900 group-hover:text-brand transition-colors flex-1"
          >
            {task.title}
          </Link>
        </div>
        <button className="text-slate-400 hover:text-slate-600 ml-2">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {task.description && (
        <p className="text-xs text-slate-600 mb-3 line-clamp-2 ml-6">
          {task.description}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 ml-6">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
          style={{ backgroundColor: getTaskTypeColor(task.typeId) }}
        >
          {getTaskTypeName(task.typeId)}
        </span>

        <div className="flex items-center gap-2">
          {boardTracksTime &&
          ((task.trackedTimeSeconds ?? 0) > 0 || task.timeTrackingActiveSince) ? (
            <TaskElapsedTimeDisplay
              compact
              trackedSeconds={task.trackedTimeSeconds ?? 0}
              activeSinceIso={task.timeTrackingActiveSince}
            />
          ) : null}

          {task.assigneeId ? (
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                <span className="text-xs font-medium text-slate-600">
                  {getAssigneeName(task.assigneeId).charAt(0)}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {task.customFields?.priority && (
        <div className="mt-2 text-xs text-slate-600 ml-6">
          Приоритет: {task.customFields.priority}
        </div>
      )}
    </div>
  );
}

export function Board() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [board, setBoard] = useState<BoardType | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [activeTask, setActiveTask] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [createTaskColumnId, setCreateTaskColumnId] = useState<string>('');
  const [assigneeFilterIds, setAssigneeFilterIds] = useState<string[]>([]);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const [boardSettingsOpen, setBoardSettingsOpen] = useState(false);
  const [deleteBoardDialogOpen, setDeleteBoardDialogOpen] = useState(false);
  const [isDeletingBoard, setIsDeletingBoard] = useState(false);
  const [deleteBoardError, setDeleteBoardError] = useState<string | null>(null);

  const canManageBoardSettings =
    currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const UNASSIGNED_FILTER = '__unassigned__';

  useEffect(() => {
    if (!filterPanelOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setFilterPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [filterPanelOpen]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    const idOrCode = boardId;
    if (!idOrCode) return;

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [b, allUsers] = await Promise.all([boardsApi.getById(idOrCode), usersApi.getAll()]);
        if (cancelled) return;
        setBoard(b);
        setViewMode((b.viewMode as 'kanban' | 'list') || 'kanban');
        setUsers(allUsers);

        const boardTasks = await tasksApi.getByBoard(b.id);
        if (!cancelled) setTasks(boardTasks);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Не удалось загрузить доску');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  const boardTasks = tasks;

  const filteredTasks = useMemo(() => {
    if (assigneeFilterIds.length === 0) return boardTasks;
    return boardTasks.filter((t) => {
      if (assigneeFilterIds.includes(UNASSIGNED_FILTER) && !t.assigneeId) return true;
      if (t.assigneeId && assigneeFilterIds.includes(t.assigneeId)) return true;
      return false;
    });
  }, [boardTasks, assigneeFilterIds]);

  const taskTypes = useMemo(() => board?.taskTypes || [], [board?.taskTypes]);
  const columns = useMemo(() => board?.columns || [], [board?.columns]);
  const boardTracksTime = useMemo(() => boardTimeTrackingIsConfigured(board), [board]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <div className="text-sm text-slate-600">Загрузка доски…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900">Доска не найдена</h2>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900">Доска не найдена</h2>
        </div>
      </div>
    );
  }

  const getTasksByColumn = (columnId: string) => {
    return filteredTasks.filter((t) => t.columnId === columnId);
  };

  const getCreatorName = (task: TaskType) => {
    if (task.creator?.name) return task.creator.name;
    return users.find((u) => u.id === task.createdBy)?.name ?? '—';
  };

  const toggleAssigneeFilter = (id: string) => {
    setAssigneeFilterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const getTaskTypeName = (typeId: string) => {
    return taskTypes.find((t) => t.id === typeId)?.name || 'Неизвестно';
  };

  const getTaskTypeColor = (typeId: string) => {
    return taskTypes.find((t) => t.id === typeId)?.color || '#6b7280';
  };

  const getAssigneeName = (userId?: string) => {
    if (!userId) return 'Не назначено';
    return users.find((u) => u.id === userId)?.name || 'Неизвестно';
  };

  const openCreateTask = (columnId: string) => {
    setCreateTaskColumnId(columnId);
    setIsCreateTaskOpen(true);
  };

  const handleCreateTask = async (data: {
    title: string;
    description?: string;
    typeId: string;
    assigneeId?: string;
    customFields: Record<string, any>;
  }) => {
    if (!board) throw new Error('Доска не загружена');
    if (!createTaskColumnId) throw new Error('Не выбрана колонка');

    const created = await tasksApi.create({
      boardId: board.id,
      columnId: createTaskColumnId,
      typeId: data.typeId,
      title: data.title,
      description: data.description,
      assigneeId: data.assigneeId,
      customFields: data.customFields,
    });

    setTasks((prev) => [created, ...prev]);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    const activeTask = tasks.find((t) => t.id === activeTaskId);
    const overTask = tasks.find((t) => t.id === overId);

    if (!activeTask) return;

    const activeColumn = activeTask.columnId;
    const overColumn = overTask ? overTask.columnId : overId;

    if (activeColumn === overColumn) return;

    setTasks((prevTasks) => {
      return prevTasks.map((task) => {
        if (task.id === activeTaskId) {
          return { ...task, columnId: overColumn };
        }
        return task;
      });
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeTaskId = active.id as string;
    const activeTask = tasks.find((t) => t.id === activeTaskId);
    if (!activeTask) return;

    try {
      await tasksApi.update(activeTaskId, { columnId: activeTask.columnId });
    } catch (error) {
      console.error('Error updating task column:', error);
      const overId = over.id as string;
      const overTask = tasks.find((t) => t.id === overId);
      const previousColumn = overTask ? overTask.columnId : overId;

      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === activeTaskId ? { ...task, columnId: previousColumn } : task
        )
      );
    }
  };

  const confirmDeleteBoard = async () => {
    if (!board) return;
    setDeleteBoardError(null);
    setIsDeletingBoard(true);
    try {
      await boardsApi.delete(board.id);
      setDeleteBoardDialogOpen(false);
      setBoardSettingsOpen(false);
      navigate('/', { replace: true });
    } catch (e: unknown) {
      setDeleteBoardError(e instanceof Error ? e.message : 'Не удалось удалить доску');
    } finally {
      setIsDeletingBoard(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{board.name}</h1>
            <p className="text-sm text-slate-600 mt-0.5">{board.description}</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 rounded p-1">
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-white text-brand shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-brand shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <div className="relative" ref={filterPanelRef}>
              <button
                type="button"
                onClick={() => setFilterPanelOpen((o) => !o)}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded transition-colors ${
                  assigneeFilterIds.length > 0
                    ? 'bg-brand-light text-brand font-medium'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Filter className="w-4 h-4" />
                Фильтр
                {assigneeFilterIds.length > 0 ? (
                  <span className="text-xs opacity-80">({assigneeFilterIds.length})</span>
                ) : null}
              </button>
              {filterPanelOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-lg border border-slate-200 bg-white shadow-lg z-50 p-3 max-h-80 overflow-y-auto">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Исполнитель
                  </div>
                  <label className="flex items-center gap-2 py-1.5 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 rounded px-1">
                    <input
                      type="checkbox"
                      checked={assigneeFilterIds.includes(UNASSIGNED_FILTER)}
                      onChange={() => toggleAssigneeFilter(UNASSIGNED_FILTER)}
                      className="rounded border-slate-300"
                    />
                    Без исполнителя
                  </label>
                  <div className="border-t border-slate-100 my-2" />
                  {users.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-2 py-1.5 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 rounded px-1"
                    >
                      <input
                        type="checkbox"
                        checked={assigneeFilterIds.includes(u.id)}
                        onChange={() => toggleAssigneeFilter(u.id)}
                        className="rounded border-slate-300"
                      />
                      {u.name}
                    </label>
                  ))}
                  {assigneeFilterIds.length > 0 && (
                    <button
                      type="button"
                      className="mt-3 w-full text-xs text-slate-600 hover:text-slate-900 py-1.5 border border-slate-200 rounded"
                      onClick={() => setAssigneeFilterIds([])}
                    >
                      Сбросить фильтр
                    </button>
                  )}
                </div>
              )}
            </div>

            {canManageBoardSettings && board ? (
              <>
                <button
                  type="button"
                  onClick={() => setBoardSettingsOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Настройки
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteBoardError(null);
                    setDeleteBoardDialogOpen(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {viewMode === 'kanban' ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 h-full">
              {columns.map((column) => {
                const columnTasks = getTasksByColumn(column.id);
                return (
                  <DroppableColumn
                    key={column.id}
                    column={column}
                    columnTasks={columnTasks}
                    getTaskTypeName={getTaskTypeName}
                    getTaskTypeColor={getTaskTypeColor}
                    getAssigneeName={getAssigneeName}
                    onCreateTask={openCreateTask}
                    boardTracksTime={boardTracksTime}
                  />
                );
              })}
            </div>
            <DragOverlay>
              {activeTask ? (
                <div className="bg-white rounded-lg p-4 border-2 border-brand shadow-lg w-80 opacity-90">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1">
                      <GripVertical className="w-4 h-4 text-slate-400" />
                      <h4 className="text-sm font-medium text-slate-900">
                        {activeTask.title}
                      </h4>
                    </div>
                  </div>
                  {activeTask.description && (
                    <p className="text-xs text-slate-600 mb-3 line-clamp-2 ml-6">
                      {activeTask.description}
                    </p>
                  )}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200">
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-b border-slate-200">
              <button
                type="button"
                disabled={!columns[0]}
                onClick={() => columns[0] && openCreateTask(columns[0].id)}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-brand text-white rounded hover:bg-brand-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Создать задачу
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">
                    Задача
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">
                    Статус
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">
                    Время
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">
                    Тип
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">
                    Автор
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">
                    Исполнитель
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">
                    Приоритет
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => {
                  const column = columns.find((c) => c.id === task.columnId);
                  return (
                    <tr
                      key={task.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/task/${task.id}`}
                          className="text-sm font-medium text-slate-900 hover:text-brand"
                        >
                          {task.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">{column?.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        {boardTracksTime &&
                        ((task.trackedTimeSeconds ?? 0) > 0 || task.timeTrackingActiveSince) ? (
                          <TaskElapsedTimeDisplay
                            compact
                            trackedSeconds={task.trackedTimeSeconds ?? 0}
                            activeSinceIso={task.timeTrackingActiveSince}
                          />
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                          style={{ backgroundColor: getTaskTypeColor(task.typeId) }}
                        >
                          {getTaskTypeName(task.typeId)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">{getCreatorName(task)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">
                          {getAssigneeName(task.assigneeId)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">
                          {task.customFields?.priority || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {board && (
        <BoardSettingsModal
          open={boardSettingsOpen}
          onClose={() => setBoardSettingsOpen(false)}
          board={board}
          users={users}
          onSaved={(updated) => setBoard(updated)}
        />
      )}

      {board && (
        <CreateTaskModal
          isOpen={isCreateTaskOpen}
          onClose={() => setIsCreateTaskOpen(false)}
          board={board}
          columnId={createTaskColumnId}
          users={users}
          onSubmit={handleCreateTask}
        />
      )}

      <AlertDialog
        open={deleteBoardDialogOpen && !!board}
        onOpenChange={(open) => {
          if (!open && !isDeletingBoard) {
            setDeleteBoardDialogOpen(false);
            setDeleteBoardError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить доску?</AlertDialogTitle>
            <AlertDialogDescription>
              Доска «{board?.name}» и все связанные задачи будут удалены без возможности восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteBoardError ? (
            <p className="text-sm text-red-600" role="alert">
              {deleteBoardError}
            </p>
          ) : null}
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
