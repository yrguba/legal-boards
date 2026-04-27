import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
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

interface DroppableColumnProps {
  column: any;
  columnTasks: any[];
  getTaskTypeName: (typeId: string) => string;
  getTaskTypeColor: (typeId: string) => string;
  getAssigneeName: (userId?: string) => string;
  onCreateTask: (columnId: string) => void;
}

function DroppableColumn({
  column,
  columnTasks,
  getTaskTypeName,
  getTaskTypeColor,
  getAssigneeName,
  onCreateTask,
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
}

function TaskCard({ task, getTaskTypeName, getTaskTypeColor, getAssigneeName }: TaskCardProps) {
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

      <div className="flex items-center justify-between ml-6">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
          style={{ backgroundColor: getTaskTypeColor(task.typeId) }}
        >
          {getTaskTypeName(task.typeId)}
        </span>

        {task.assigneeId && (
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
              <span className="text-xs font-medium text-slate-600">
                {getAssigneeName(task.assigneeId).charAt(0)}
              </span>
            </div>
          </div>
        )}
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
  const [board, setBoard] = useState<BoardType | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [activeTask, setActiveTask] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [createTaskColumnId, setCreateTaskColumnId] = useState<string>('');

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

  const taskTypes = useMemo(() => board?.taskTypes || [], [board?.taskTypes]);
  const columns = useMemo(() => board?.columns || [], [board?.columns]);

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
    return boardTasks.filter((t) => t.columnId === columnId);
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

            <button className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded transition-colors">
              <Filter className="w-4 h-4" />
              Фильтр
            </button>

            <button className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded transition-colors">
              <Settings className="w-4 h-4" />
              Настройки
            </button>
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
                    Тип
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
                {boardTasks.map((task) => {
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
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                          style={{ backgroundColor: getTaskTypeColor(task.typeId) }}
                        >
                          {getTaskTypeName(task.typeId)}
                        </span>
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
        <CreateTaskModal
          isOpen={isCreateTaskOpen}
          onClose={() => setIsCreateTaskOpen(false)}
          board={board}
          columnId={createTaskColumnId}
          users={users}
          onSubmit={handleCreateTask}
        />
      )}
    </div>
  );
}
