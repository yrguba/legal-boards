import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { boardsApi, tasksApi, usersApi, ApiError } from '../services/api';
import type { Board as BoardType, Task as TaskType, User as UserType } from '../types';
import {
  formatPendingApprovalsMessage,
  getBoardApprovalRules,
  type TaskColumnApprovalRow,
} from '../utils/boardApprovals';
import {
  Plus,
  LayoutGrid,
  List,
  Filter,
  Settings,
  MoreHorizontal,
  GripVertical,
  Trash2,
  ArrowRightLeft,
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
import { TaskMarkdownPreview } from '../components/markdown';
import { CreateTaskModal } from '../components/CreateTaskModal';
import { uploadPendingTaskAttachments } from '../components/TaskCreateFormFields';
import { AggregatedBoardView } from '../components/AggregatedBoardView';
import { TransferTaskModal } from '../components/TransferTaskModal';
import { TaskBoardCountBadge } from '../components/TaskBoardCountBadge';
import { useColumnTransition } from '../store/ColumnTransitionContext';
import {
  ForwardToBoardOfferDialog,
  prepareForwardToBoardOffer,
  type ForwardToBoardOffer,
} from '../components/ForwardToBoardOfferDialog';
import { BoardSettingsModal } from '../features/board-settings/BoardSettingsModal';
import {
  buildColumnTransitionPlan,
  formatColumnTransitionCheckErrors,
  mergeActionCompletion,
  type TaskColumnActionCompletionRow,
} from '../utils/boardColumnActions';
import { TaskElapsedTimeDisplay } from '../components/TaskElapsedTimeDisplay';
import { TaskPriorityBadge } from '../components/TaskPriorityBadge';
import { TASK_PRIORITY_KEYS, normalizeTaskPriority } from '../utils/taskPriority';
import { boardTimeTrackingIsConfigured } from '../utils/boardTimeTracking';
import { useApp } from '../store/AppContext';
import { useWorkspacePermissions } from '../utils/workspacePermissions';
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
import { ScrollArea, ScrollBar } from '../components/ui/scroll-area';
import { taskPath } from '../utils/taskUrls';
import {
  applyDragReorder,
  columnIdsEqual,
  getColumnTaskIds,
  sortTasksByPosition,
} from '../utils/kanbanTaskOrder';

/** После сохранения колонки API возвращает обновлённые поля учёта времени — подмешиваем в карточку без перезагрузки */
function mergeTaskFromUpdateResponse(prev: TaskType, api: Record<string, unknown>): TaskType {
  const merged = { ...prev };
  if (typeof api.columnId === 'string') merged.columnId = api.columnId;
  if (typeof api.trackedTimeSeconds === 'number') merged.trackedTimeSeconds = api.trackedTimeSeconds;
  if (Object.prototype.hasOwnProperty.call(api, 'timeTrackingActiveSince')) {
    const v = api.timeTrackingActiveSince;
    merged.timeTrackingActiveSince =
      v === null || v === undefined ? null : typeof v === 'string' ? v : String(v);
  }
  if (Object.prototype.hasOwnProperty.call(api, 'assigneeId')) {
    merged.assigneeId =
      api.assigneeId === null || api.assigneeId === undefined
        ? undefined
        : String(api.assigneeId);
  }
  if (api.assignee !== undefined) merged.assignee = api.assignee as TaskType['assignee'];
  if (typeof api.updatedAt === 'string') merged.updatedAt = api.updatedAt;
  if (typeof api.position === 'number') merged.position = api.position;
  if (Array.isArray(api.columnApprovals)) {
    (merged as TaskType & { columnApprovals?: unknown[] }).columnApprovals = api.columnApprovals;
  }
  if (Array.isArray(api.columnActionCompletions)) {
    (merged as TaskType & { columnActionCompletions?: unknown[] }).columnActionCompletions =
      api.columnActionCompletions;
  }
  return merged;
}

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
        className={`flex-shrink-0 w-80 rounded-lg p-4 flex flex-col min-h-0 max-h-[calc(100vh-12rem)] transition-colors border-2 ${
          isOver
            ? 'bg-brand-light border-dashed border-brand'
            : 'bg-slate-50 border-transparent'
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

        <ScrollArea type="always" className="min-h-[200px] flex-1">
          <div className="space-y-3 pr-1">
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
          <ScrollBar />
        </ScrollArea>

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
      {...attributes}
      {...listeners}
      className="bg-white rounded-lg p-4 border border-slate-200 hover:border-brand hover:shadow-md transition-all group cursor-grab active:cursor-grabbing touch-none min-w-0 max-w-full overflow-hidden"
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Link
            to={taskPath(task)}
            className="text-sm font-medium text-slate-900 group-hover:text-brand transition-colors flex-1 min-w-0 line-clamp-2"
            onClick={(e) => e.stopPropagation()}
          >
            {task.key ? (
              <span className="mr-1.5 font-mono text-xs font-normal text-slate-400">{task.key}</span>
            ) : null}
            {task.title}
          </Link>
        </div>
        <TaskBoardCountBadge count={task.boardPlacementsCount} compact />
        <button
          type="button"
          className="text-slate-400 hover:text-slate-600 ml-2 shrink-0"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {task.description && <TaskMarkdownPreview markdown={task.description} />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
            style={{ backgroundColor: getTaskTypeColor(task.typeId) }}
          >
            {getTaskTypeName(task.typeId)}
          </span>
          <TaskPriorityBadge priority={normalizeTaskPriority(task.priority)} compact />
        </div>

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

    </div>
  );
}

export function Board() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const { canManageWorkspace } = useWorkspacePermissions();
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
  const [typeFilterIds, setTypeFilterIds] = useState<string[]>([]);
  const [priorityFilterKeys, setPriorityFilterKeys] = useState<string[]>([]);
  const [columnFilterIds, setColumnFilterIds] = useState<string[]>([]);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const dragOriginColumnRef = useRef<string | null>(null);
  const dragOriginOrderRef = useRef<string[] | null>(null);
  const dragSnapshotRef = useRef<TaskType[] | null>(null);
  const [boardSettingsOpen, setBoardSettingsOpen] = useState(false);
  const [deleteBoardDialogOpen, setDeleteBoardDialogOpen] = useState(false);
  const [isDeletingBoard, setIsDeletingBoard] = useState(false);
  const [deleteBoardError, setDeleteBoardError] = useState<string | null>(null);
  const [dragMoveError, setDragMoveError] = useState<string | null>(null);
  const { openColumnTransition } = useColumnTransition();
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferNotice, setTransferNotice] = useState<string | null>(null);
  const [forwardOffer, setForwardOffer] = useState<ForwardToBoardOffer | null>(null);

  const canManageBoardSettings = canManageWorkspace;

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

  const activeFilterCount =
    assigneeFilterIds.length +
    typeFilterIds.length +
    priorityFilterKeys.length +
    columnFilterIds.length;

  const filteredTasks = useMemo(() => {
    return boardTasks
      .filter((t) => {
        if (columnFilterIds.length > 0 && !columnFilterIds.includes(t.columnId)) return false;
        if (typeFilterIds.length > 0 && !typeFilterIds.includes(t.typeId)) return false;

        if (priorityFilterKeys.length > 0) {
          const key = normalizeTaskPriority(t.priority);
          if (!priorityFilterKeys.includes(key)) return false;
        }

        if (assigneeFilterIds.length > 0) {
          if (assigneeFilterIds.includes(UNASSIGNED_FILTER) && !t.assigneeId) return true;
          if (t.assigneeId && assigneeFilterIds.includes(t.assigneeId)) return true;
          return false;
        }

        return true;
      })
      .sort(sortTasksByPosition);
  }, [boardTasks, assigneeFilterIds, typeFilterIds, priorityFilterKeys, columnFilterIds]);

  const filtersHideAllTasks =
    activeFilterCount > 0 && boardTasks.length > 0 && filteredTasks.length === 0;

  useEffect(() => {
    const visible = new Set(filteredTasks.map((t) => t.id));
    setSelectedTaskIds((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filteredTasks]);

  const taskTypes = useMemo(() => board?.taskTypes || [], [board?.taskTypes]);
  const columns = useMemo(() => board?.columns || [], [board?.columns]);
  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);
  const boardTracksTime = useMemo(() => boardTimeTrackingIsConfigured(board), [board]);
  const approvalRules = useMemo(() => getBoardApprovalRules(board), [board]);

  const resolveDropColumnId = (overId: string): string | null => {
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask) return overTask.columnId;
    if (columns.some((c) => c.id === overId)) return overId;
    return null;
  };

  const taskColumnApprovals = (task: TaskType): TaskColumnApprovalRow[] => {
    const raw = (task as TaskType & { columnApprovals?: TaskColumnApprovalRow[] }).columnApprovals;
    return Array.isArray(raw) ? raw : [];
  };

  const taskColumnActionCompletions = (task: TaskType): TaskColumnActionCompletionRow[] => {
    const raw = (task as TaskType & { columnActionCompletions?: TaskColumnActionCompletionRow[] })
      .columnActionCompletions;
    return Array.isArray(raw) ? raw : [];
  };

  const revertTaskColumn = (taskId: string, columnId: string) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) => (task.id === taskId ? { ...task, columnId } : task)),
    );
  };

  const finishColumnMove = async (
    taskId: string,
    targetColumnId: string,
    originColumnId: string,
    position?: number,
    revertSnapshot?: TaskType[] | null,
  ) => {
    try {
      const payload: { columnId: string; position?: number; boardId: string } = {
        columnId: targetColumnId,
        boardId: board.id,
      };
      if (typeof position === 'number') payload.position = position;
      const updated = (await tasksApi.update(taskId, payload)) as Record<string, unknown>;
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskId ? mergeTaskFromUpdateResponse(task, updated) : task,
        ),
      );
      const offer = await prepareForwardToBoardOffer(
        board,
        taskId,
        originColumnId,
        targetColumnId,
      );
      if (offer) setForwardOffer(offer);
    } catch (error) {
      console.error('Error updating task column:', error);
      const message =
        error instanceof ApiError ? error.message : 'Не удалось изменить статус задачи';
      setDragMoveError(message);
      if (revertSnapshot) {
        setTasks(revertSnapshot);
      } else {
        revertTaskColumn(taskId, originColumnId);
      }
      throw error;
    }
  };

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

  if (board.kind === 'aggregated') {
    return (
      <AggregatedBoardView
        board={board}
        tasks={tasks}
        users={users}
        onTasksChange={setTasks}
        onBoardChange={setBoard}
        isLoading={false}
      />
    );
  }

  const getTasksByColumn = (columnId: string) => {
    return filteredTasks
      .filter((t) => t.columnId === columnId)
      .sort(sortTasksByPosition);
  };

  const getCreatorName = (task: TaskType) => {
    if (task.creator?.name) return task.creator.name;
    return users.find((u) => u.id === task.createdBy)?.name ?? '—';
  };

  const toggleFilterValue = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    id: string,
  ) => {
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const clearAllFilters = () => {
    setAssigneeFilterIds([]);
    setTypeFilterIds([]);
    setPriorityFilterKeys([]);
    setColumnFilterIds([]);
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

  const handleCreateTask = async (
    data: {
      title: string;
      description?: string;
      typeId: string;
      assigneeId?: string;
      priority: string;
      customFields: Record<string, any>;
    },
    pendingFiles: File[] = [],
  ) => {
    if (!board) throw new Error('Доска не загружена');
    if (!createTaskColumnId) throw new Error('Не выбрана колонка');

    const created = await tasksApi.create({
      boardId: board.id,
      columnId: createTaskColumnId,
      typeId: data.typeId,
      title: data.title,
      description: data.description,
      assigneeId: data.assigneeId,
      priority: data.priority,
      customFields: data.customFields,
    });

    if (pendingFiles.length > 0 && created?.id) {
      await uploadPendingTaskAttachments(String(created.id), pendingFiles);
    }

    setTasks((prev) => {
      const next = prev.map((t) =>
        t.columnId === createTaskColumnId
          ? { ...t, position: (typeof t.position === 'number' ? t.position : 0) + 1 }
          : t,
      );
      return [{ ...created, position: created.position ?? 0 }, ...next];
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDragMoveError(null);
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    dragSnapshotRef.current = tasks;
    dragOriginColumnRef.current = task?.columnId ?? null;
    dragOriginOrderRef.current = task?.columnId
      ? getColumnTaskIds(tasks, task.columnId)
      : null;
    setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;
    const activeTask = tasks.find((t) => t.id === activeTaskId);
    if (!activeTask) return;

    const overTask = tasks.find((t) => t.id === overId);
    if (activeFilterCount > 0 && overTask && activeTask.columnId === overTask.columnId) {
      return;
    }

    setTasks((prevTasks) => applyDragReorder(prevTasks, activeTaskId, overId, columnIds));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    const activeTaskId = active.id as string;
    const originColumnId = dragOriginColumnRef.current;
    const originOrder = dragOriginOrderRef.current;
    const snapshot = dragSnapshotRef.current;
    dragOriginColumnRef.current = null;
    dragOriginOrderRef.current = null;
    dragSnapshotRef.current = null;

    if (!over) {
      if (snapshot) setTasks(snapshot);
      return;
    }

    const targetColumnId = resolveDropColumnId(over.id as string);
    if (!originColumnId || !targetColumnId) {
      if (snapshot) setTasks(snapshot);
      return;
    }

    if (originColumnId === targetColumnId) {
      if (activeFilterCount > 0) {
        if (snapshot) setTasks(snapshot);
        return;
      }
      const newOrder = getColumnTaskIds(tasks, originColumnId);
      if (!originOrder || columnIdsEqual(originOrder, newOrder)) {
        return;
      }
      if (!board) {
        if (snapshot) setTasks(snapshot);
        return;
      }
      try {
        await tasksApi.reorderInColumn(board.id, originColumnId, newOrder);
      } catch (error) {
        console.error('Error reordering tasks:', error);
        const message =
          error instanceof ApiError ? error.message : 'Не удалось изменить порядок задач';
        setDragMoveError(message);
        if (snapshot) setTasks(snapshot);
      }
      return;
    }

    const draggedTask = tasks.find((t) => t.id === activeTaskId);
    const pendingMsg = draggedTask
      ? formatPendingApprovalsMessage(
          approvalRules,
          originColumnId,
          taskColumnApprovals(draggedTask),
        )
      : null;
    if (pendingMsg) {
      setDragMoveError(pendingMsg);
      revertTaskColumn(activeTaskId, originColumnId);
      return;
    }

    const taskForPlan = {
      ...draggedTask,
      columnActionCompletions: taskColumnActionCompletions(draggedTask),
    };
    const actionPlan = buildColumnTransitionPlan(board, taskForPlan, originColumnId, targetColumnId);
    if (actionPlan.checkErrors.length > 0) {
      setDragMoveError(formatColumnTransitionCheckErrors(actionPlan.checkErrors));
      revertTaskColumn(activeTaskId, originColumnId);
      return;
    }

    if (actionPlan.interactiveSteps.length > 0) {
      revertTaskColumn(activeTaskId, originColumnId);
      const taskId = activeTaskId;
      const fromColumnId = originColumnId;
      const toColumnId = targetColumnId;
      openColumnTransition({
        task: taskForPlan,
        taskFields: board?.taskFields ?? [],
        targetColumnName: columns.find((c) => c.id === toColumnId)?.name,
        steps: actionPlan.interactiveSteps,
        onSubmitStep: async (step, payload) => {
          const row = (await tasksApi.completeColumnAction(
            taskId,
            step.rule.id,
            payload,
            step.forColumnId,
          )) as TaskColumnActionCompletionRow;
          setTasks((prev) =>
            prev.map((t) => {
              if (t.id !== taskId) return t;
              const list = taskColumnActionCompletions(t);
              return { ...t, columnActionCompletions: mergeActionCompletion(list, row) };
            }),
          );
        },
        onAllComplete: async () => {
          await finishColumnMove(taskId, toColumnId, fromColumnId);
        },
      });
      return;
    }

    const targetPosition = getColumnTaskIds(tasks, targetColumnId).indexOf(activeTaskId);

    try {
      await finishColumnMove(
        activeTaskId,
        targetColumnId,
        originColumnId,
        targetPosition >= 0 ? targetPosition : undefined,
        snapshot,
      );
    } catch {
      /* ошибка уже показана */
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleAllFilteredTasks = () => {
    const ids = filteredTasks.map((t) => t.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedTaskIds.has(id));
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return next;
    });
  };

  const handleTransferSuccess = (result: {
    mode: 'move' | 'mirror';
    moved: { taskId: string }[];
    added: { taskId: string; created: boolean }[];
    skipped: { taskId: string; reason: string }[];
    warnings: { message: string }[];
  }) => {
    if (result.mode === 'move') {
      const movedIds = new Set(result.moved.map((m) => m.taskId));
      setTasks((prev) => prev.filter((t) => !movedIds.has(t.id)));
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);
        for (const id of movedIds) next.delete(id);
        return next;
      });
    }

    const parts: string[] = [];
    if (result.mode === 'mirror') {
      const created = result.added.filter((a) => a.created).length;
      if (created) parts.push(`Добавлено на доску: ${created}`);
      const already = result.added.filter((a) => !a.created).length;
      if (already) parts.push(`Уже на доске: ${already}`);
    } else if (result.moved.length) {
      parts.push(`Перенесено: ${result.moved.length}`);
    }
    if (result.skipped.length) parts.push(`Пропущено: ${result.skipped.length}`);
    if (result.warnings.length) parts.push(`Предупреждений: ${result.warnings.length}`);
    setTransferNotice(parts.join(' · ') || 'Готово');
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
                  activeFilterCount > 0
                    ? 'bg-brand-light text-brand font-medium'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Filter className="w-4 h-4" />
                Фильтр
                {activeFilterCount > 0 ? (
                  <span className="text-xs opacity-80">({activeFilterCount})</span>
                ) : null}
              </button>
              {filterPanelOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg z-50 p-3 max-h-[min(28rem,calc(100dvh-8rem))] overflow-y-auto">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Тип задачи
                  </div>
                  {taskTypes.length === 0 ? (
                    <p className="text-sm text-slate-400 px-1">Нет типов</p>
                  ) : (
                    taskTypes.map((ty) => (
                      <label
                        key={ty.id}
                        className="flex items-center gap-2 py-1.5 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 rounded px-1"
                      >
                        <input
                          type="checkbox"
                          checked={typeFilterIds.includes(ty.id)}
                          onChange={() => toggleFilterValue(setTypeFilterIds, ty.id)}
                          className="rounded border-slate-300"
                        />
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white shrink-0"
                          style={{ backgroundColor: ty.color }}
                        >
                          {ty.name}
                        </span>
                      </label>
                    ))
                  )}

                  <div className="border-t border-slate-100 my-3" />

                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Приоритет
                  </div>
                  {TASK_PRIORITY_KEYS.map((key) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 py-1.5 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 rounded px-1"
                    >
                      <input
                        type="checkbox"
                        checked={priorityFilterKeys.includes(key)}
                        onChange={() => toggleFilterValue(setPriorityFilterKeys, key)}
                        className="rounded border-slate-300"
                      />
                      <TaskPriorityBadge priority={key} compact />
                    </label>
                  ))}

                  <div className="border-t border-slate-100 my-3" />

                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Статус
                  </div>
                  {columns.length === 0 ? (
                    <p className="text-sm text-slate-400 px-1">Нет колонок</p>
                  ) : (
                    columns.map((col) => (
                      <label
                        key={col.id}
                        className="flex items-center gap-2 py-1.5 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 rounded px-1"
                      >
                        <input
                          type="checkbox"
                          checked={columnFilterIds.includes(col.id)}
                          onChange={() => toggleFilterValue(setColumnFilterIds, col.id)}
                          className="rounded border-slate-300"
                        />
                        {col.name}
                      </label>
                    ))
                  )}

                  <div className="border-t border-slate-100 my-3" />

                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Исполнитель
                  </div>
                  <label className="flex items-center gap-2 py-1.5 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 rounded px-1">
                    <input
                      type="checkbox"
                      checked={assigneeFilterIds.includes(UNASSIGNED_FILTER)}
                      onChange={() => toggleFilterValue(setAssigneeFilterIds, UNASSIGNED_FILTER)}
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
                        onChange={() => toggleFilterValue(setAssigneeFilterIds, u.id)}
                        className="rounded border-slate-300"
                      />
                      {u.name}
                    </label>
                  ))}
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      className="mt-3 w-full text-xs text-slate-600 hover:text-slate-900 py-1.5 border border-slate-200 rounded"
                      onClick={clearAllFilters}
                    >
                      Сбросить все фильтры
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

      <div className="flex min-h-0 flex-1 flex-col px-3">
        {dragMoveError ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            {dragMoveError}
          </div>
        ) : null}
        {transferNotice ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 flex justify-between gap-2">
            <span>{transferNotice}</span>
            <button
              type="button"
              className="text-emerald-700 hover:text-emerald-900 shrink-0"
              onClick={() => setTransferNotice(null)}
            >
              ✕
            </button>
          </div>
        ) : null}

        <ScrollArea type="always" className="flex-1 min-h-0">
        {filtersHideAllTasks ? (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 flex flex-wrap items-center justify-between gap-2">
            <span>Нет задач по выбранным фильтрам.</span>
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-brand hover:underline text-sm font-medium"
            >
              Сбросить фильтры
            </button>
          </div>
        ) : null}
        {viewMode === 'kanban' ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex h-full min-w-max gap-4 pb-1 pr-1">
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
                    <div className="ml-6 min-w-0 max-w-full overflow-hidden">
                      <TaskMarkdownPreview markdown={activeTask.description} />
                    </div>
                  )}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
              {canManageBoardSettings && selectedTaskIds.size > 0 ? (
                <button
                  type="button"
                  onClick={() => setTransferOpen(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 text-slate-800 rounded hover:bg-slate-50 transition-colors"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Перенести ({selectedTaskIds.size})
                </button>
              ) : (
                <span />
              )}
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
                  {canManageBoardSettings ? (
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={
                          filteredTasks.length > 0 &&
                          filteredTasks.every((t) => selectedTaskIds.has(t.id))
                        }
                        onChange={toggleAllFilteredTasks}
                        className="rounded border-slate-300"
                        aria-label="Выбрать все"
                      />
                    </th>
                  ) : null}
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
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canManageBoardSettings ? 8 : 7}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      {activeFilterCount > 0
                        ? 'Нет задач по выбранным фильтрам'
                        : 'На доске пока нет задач'}
                    </td>
                  </tr>
                ) : null}
                {filteredTasks.map((task) => {
                  const column = columns.find((c) => c.id === task.columnId);
                  return (
                    <tr
                      key={task.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      {canManageBoardSettings ? (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedTaskIds.has(task.id)}
                            onChange={() => toggleTaskSelection(task.id)}
                            className="rounded border-slate-300"
                            aria-label={`Выбрать ${task.title}`}
                          />
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <Link
                          to={taskPath(task)}
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
                        <TaskPriorityBadge priority={normalizeTaskPriority(task.priority)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <ScrollBar />
        <ScrollBar orientation="horizontal" />
        </ScrollArea>
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

      {board && canManageBoardSettings ? (
        <TransferTaskModal
          open={transferOpen}
          sourceBoard={board}
          taskIds={[...selectedTaskIds]}
          onClose={() => setTransferOpen(false)}
          onSuccess={handleTransferSuccess}
        />
      ) : null}

      <ForwardToBoardOfferDialog
        offer={forwardOffer}
        onClose={() => setForwardOffer(null)}
        onAdded={(taskId, created) => {
          if (!created) return;
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? { ...t, boardPlacementsCount: (t.boardPlacementsCount ?? 1) + 1 }
                : t,
            ),
          );
        }}
      />

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
