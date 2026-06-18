import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import type { AggregatedBoardSource, Board, Task, User } from '../types';
import { TaskPriorityBadge } from './TaskPriorityBadge';
import { normalizeTaskPriority } from '../utils/taskPriority';
import { taskPath } from '../utils/taskUrls';
import { statusDotClass } from '../utils/taskStatusDisplay';
import { sortTasksByPosition } from '../utils/kanbanTaskOrder';
import {
  aggDropZoneId,
  applyAggregatedDragReorder,
  columnIdsEqual,
  columnNameById,
  getStatusColumnTaskIds,
  resolveAggregatedDrop,
  taskSourceBoardId,
  taskStatusColumnId,
} from '../utils/aggregatedKanbanDnD';
import { mergeTaskFromUpdateResponse } from '../utils/taskBoardMerge';
import {
  formatPendingApprovalsMessage,
  getBoardApprovalRules,
  type TaskColumnApprovalRow,
} from '../utils/boardApprovals';
import {
  buildColumnTransitionPlan,
  formatColumnTransitionCheckErrors,
  mergeActionCompletion,
  type ColumnTransitionInteractiveStep,
  type TaskColumnActionCompletionRow,
} from '../utils/boardColumnActions';
import { boardsApi, tasksApi, ApiError } from '../services/api';
import { ColumnActionTransitionModal } from './ColumnActionTransitionModal';
import { TransferTaskModal } from './TransferTaskModal';

type Props = {
  board: Board;
  tasks: Task[];
  users: User[];
  onTasksChange: (updater: Task[] | ((prev: Task[]) => Task[])) => void;
  isLoading?: boolean;
};

function statusGroupKey(sourceBoardId: string, columnId: string): string {
  return `${sourceBoardId}:${columnId}`;
}

function AggregatedTaskCard({
  task,
  getAssigneeName,
}: {
  task: Task;
  getAssigneeName: (id?: string) => string;
}) {
  const typeName = task.type?.name ?? '—';
  const typeColor = task.type?.color ?? '#6b7280';
  const statusName = task.sourceColumnName ?? '—';

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white rounded-lg p-3 border border-slate-200 hover:border-brand hover:shadow-md transition-all cursor-grab active:cursor-grabbing touch-none"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <Link
            to={taskPath(task)}
            className="text-sm font-medium text-slate-900 hover:text-brand line-clamp-2"
            onClick={(e) => e.stopPropagation()}
          >
            {task.title}
          </Link>
          {task.key ? (
            <span className="text-xs text-slate-400 font-mono">{task.key}</span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-2">
        <span className={`inline-block size-2 rounded-full shrink-0 ${statusDotClass(statusName)}`} />
        <span className="text-xs text-slate-600">{statusName}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
          style={{ backgroundColor: typeColor }}
        >
          {typeName}
        </span>
        <div className="flex items-center gap-2">
          <TaskPriorityBadge priority={normalizeTaskPriority(task.priority)} compact />
          {task.assigneeId ? (
            <span className="text-xs text-slate-500 truncate max-w-[100px]">
              {getAssigneeName(task.assigneeId)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatusDropZone({
  sourceBoardId,
  column,
  tasks,
  getAssigneeName,
  isCollapsed,
  onToggleCollapse,
}: {
  sourceBoardId: string;
  column: { id: string; name: string };
  tasks: Task[];
  getAssigneeName: (id?: string) => string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const dropId = aggDropZoneId(sourceBoardId, column.id);
  const { setNodeRef, isOver } = useDroppable({ id: dropId });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg p-2 transition-colors border-2 ${
        isOver
          ? 'bg-brand-light/60 border-dashed border-brand'
          : 'border-transparent'
      }`}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex items-center gap-1.5 mb-2 sticky top-0 bg-slate-50 py-1 z-[1] w-full text-left rounded hover:bg-slate-100/80 transition-colors"
        aria-expanded={!isCollapsed}
      >
        {isCollapsed ? (
          <ChevronRight className="size-3.5 shrink-0 text-slate-500" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0 text-slate-500" />
        )}
        <span className={`inline-block size-2 rounded-full shrink-0 ${statusDotClass(column.name)}`} />
        <span className="text-xs font-medium text-slate-700">{column.name}</span>
        <span className="text-xs text-slate-400">({tasks.length})</span>
      </button>
      {isCollapsed ? (
        <div className="min-h-[2rem]" aria-hidden />
      ) : (
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-[2rem]">
            {tasks.map((task) => (
              <AggregatedTaskCard key={task.id} task={task} getAssigneeName={getAssigneeName} />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}

function UnknownStatusGroup({
  tasks,
  getAssigneeName,
  isCollapsed,
  onToggleCollapse,
}: {
  tasks: Task[];
  getAssigneeName: (id?: string) => string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  return (
    <div className="rounded-lg p-2 border-2 border-transparent">
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex items-center gap-1.5 mb-2 w-full text-left rounded hover:bg-slate-100/80 transition-colors py-1"
        aria-expanded={!isCollapsed}
      >
        {isCollapsed ? (
          <ChevronRight className="size-3.5 shrink-0 text-slate-500" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0 text-slate-500" />
        )}
        <span className="text-xs font-medium text-slate-500">Прочие</span>
        <span className="text-xs text-slate-400">({tasks.length})</span>
      </button>
      {isCollapsed ? (
        <div className="min-h-[2rem]" aria-hidden />
      ) : (
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {tasks.map((task) => (
              <AggregatedTaskCard key={task.id} task={task} getAssigneeName={getAssigneeName} />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}

function SourceBoardColumn({
  source,
  tasks,
  getAssigneeName,
  collapsedGroups,
  onToggleStatusGroup,
}: {
  source: AggregatedBoardSource;
  tasks: Task[];
  getAssigneeName: (id?: string) => string;
  collapsedGroups: Set<string>;
  onToggleStatusGroup: (key: string) => void;
}) {
  const columnOrder = [...source.columns].sort((a, b) => a.position - b.position);

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const col of columnOrder) {
      map.set(col.id, []);
    }
    const unknown: Task[] = [];
    for (const task of tasks) {
      const colId = taskStatusColumnId(task);
      const bucket = map.get(colId);
      if (bucket) bucket.push(task);
      else unknown.push(task);
    }
    for (const [, list] of map) {
      list.sort(sortTasksByPosition);
    }
    unknown.sort(sortTasksByPosition);
    return { map, unknown };
  }, [tasks, columnOrder]);

  const totalCount = tasks.length;
  const unknownKey = statusGroupKey(source.id, '__unknown__');

  return (
    <div className="flex-shrink-0 w-80 rounded-lg bg-slate-50 p-4 flex flex-col max-h-[calc(100vh-12rem)]">
      <div className="flex items-center justify-between mb-4">
        <Link
          to={`/board/${source.code}`}
          className="font-medium text-slate-900 hover:text-brand transition-colors"
        >
          {source.name}
        </Link>
        <span className="text-sm text-slate-500">{totalCount}</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 min-h-[200px] px-0.5">
        {columnOrder.map((col) => {
          const colTasks = tasksByColumn.map.get(col.id) ?? [];
          if (colTasks.length === 0) return null;
          const groupKey = statusGroupKey(source.id, col.id);
          return (
            <StatusDropZone
              key={col.id}
              sourceBoardId={source.id}
              column={col}
              tasks={colTasks}
              getAssigneeName={getAssigneeName}
              isCollapsed={collapsedGroups.has(groupKey)}
              onToggleCollapse={() => onToggleStatusGroup(groupKey)}
            />
          );
        })}

        {tasksByColumn.unknown.length > 0 ? (
          <UnknownStatusGroup
            tasks={tasksByColumn.unknown}
            getAssigneeName={getAssigneeName}
            isCollapsed={collapsedGroups.has(unknownKey)}
            onToggleCollapse={() => onToggleStatusGroup(unknownKey)}
          />
        ) : null}

        {totalCount === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-slate-400 border-2 border-dashed border-slate-300 rounded-lg">
            Перетащите задачу сюда
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AggregatedBoardView({
  board,
  tasks,
  users,
  onTasksChange,
  isLoading,
}: Props) {
  const sources = useMemo(
    () => [...(board.sources || [])].sort((a, b) => a.position - b.position),
    [board.sources],
  );

  const [sourceBoards, setSourceBoards] = useState<Map<string, Board>>(new Map());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [dragMoveError, setDragMoveError] = useState<string | null>(null);
  const dragSnapshotRef = useRef<Task[] | null>(null);
  const dragOriginColumnRef = useRef<string | null>(null);
  const dragOriginBoardRef = useRef<string | null>(null);
  const dragOriginOrderRef = useRef<string[] | null>(null);

  const [columnTransition, setColumnTransition] = useState<{
    taskId: string;
    sourceBoardId: string;
    fromColumnId: string;
    toColumnId: string;
    steps: ColumnTransitionInteractiveStep[];
  } | null>(null);
  const [columnTransitionError, setColumnTransitionError] = useState<string | null>(null);
  const [columnTransitionSubmitting, setColumnTransitionSubmitting] = useState(false);

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTaskId, setTransferTaskId] = useState<string | null>(null);
  const [transferSourceBoardId, setTransferSourceBoardId] = useState<string | null>(null);
  const [transferPreset, setTransferPreset] = useState<{
    boardId: string;
    columnId: string;
  } | null>(null);
  const [transferNotice, setTransferNotice] = useState<string | null>(null);

  const allColumnIds = useMemo(
    () => sources.flatMap((s) => s.columns.map((c) => c.id)),
    [sources],
  );
  const sourceBoardIds = useMemo(() => sources.map((s) => s.id), [sources]);

  useEffect(() => {
    if (sources.length === 0) return;
    let cancelled = false;
    const load = async () => {
      try {
        const boards = await Promise.all(sources.map((s) => boardsApi.getById(s.id)));
        if (cancelled) return;
        setSourceBoards(new Map(boards.map((b) => [b.id, b])));
      } catch {
        /* настройки согласований подгрузятся при следующем действии */
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [sources]);

  useEffect(() => {
    if (!transferSourceBoardId || sourceBoards.has(transferSourceBoardId)) return;
    let cancelled = false;
    void boardsApi.getById(transferSourceBoardId).then((b) => {
      if (cancelled) return;
      setSourceBoards((prev) => new Map(prev).set(b.id, b));
    });
    return () => {
      cancelled = true;
    };
  }, [transferSourceBoardId, sourceBoards]);

  const toggleStatusGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const getAssigneeName = useCallback(
    (userId?: string) => {
      if (!userId) return 'Не назначено';
      return users.find((u) => u.id === userId)?.name || 'Неизвестно';
    },
    [users],
  );

  const tasksBySource = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const s of sources) {
      map.set(s.id, []);
    }
    for (const task of tasks) {
      const sourceId = taskSourceBoardId(task);
      const bucket = map.get(sourceId);
      if (bucket) bucket.push(task);
    }
    return map;
  }, [tasks, sources]);

  const taskColumnApprovals = (task: Task): TaskColumnApprovalRow[] => {
    const raw = (task as Task & { columnApprovals?: TaskColumnApprovalRow[] }).columnApprovals;
    return Array.isArray(raw) ? raw : [];
  };

  const taskColumnActionCompletions = (task: Task): TaskColumnActionCompletionRow[] => {
    const raw = (task as Task & { columnActionCompletions?: TaskColumnActionCompletionRow[] })
      .columnActionCompletions;
    return Array.isArray(raw) ? raw : [];
  };

  const revertTaskStatus = (taskId: string, columnId: string) => {
    onTasksChange((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              columnId,
              sourceColumnId: columnId,
              sourceColumnName: columnNameById(sources, columnId) ?? t.sourceColumnName,
            }
          : t,
      ),
    );
  };

  const finishColumnMove = async (
    taskId: string,
    targetColumnId: string,
    originColumnId: string,
    position?: number,
    revertSnapshot?: Task[] | null,
  ) => {
    try {
      const payload: { columnId: string; position?: number } = { columnId: targetColumnId };
      if (typeof position === 'number') payload.position = position;
      const updated = (await tasksApi.update(taskId, payload)) as Record<string, unknown>;
      const colName = columnNameById(sources, targetColumnId);
      onTasksChange((prev) =>
        prev.map((task) =>
          task.id === taskId ? mergeTaskFromUpdateResponse(task, updated, colName) : task,
        ),
      );
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Не удалось изменить статус задачи';
      setDragMoveError(message);
      if (revertSnapshot) {
        onTasksChange(revertSnapshot);
      } else {
        revertTaskStatus(taskId, originColumnId);
      }
      throw error;
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDragMoveError(null);
    const task = tasks.find((t) => t.id === event.active.id);
    dragSnapshotRef.current = tasks;
    dragOriginColumnRef.current = task ? taskStatusColumnId(task) : null;
    dragOriginBoardRef.current = task ? taskSourceBoardId(task) : null;
    dragOriginOrderRef.current = task
      ? getStatusColumnTaskIds(tasks, taskStatusColumnId(task))
      : null;
    setActiveTask(task ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    onTasksChange((prev) =>
      applyAggregatedDragReorder(prev, String(active.id), String(over.id), allColumnIds, sources),
    );
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    const activeTaskId = String(active.id);
    const originColumnId = dragOriginColumnRef.current;
    const originBoardId = dragOriginBoardRef.current;
    const originOrder = dragOriginOrderRef.current;
    const snapshot = dragSnapshotRef.current;
    dragOriginColumnRef.current = null;
    dragOriginBoardRef.current = null;
    dragOriginOrderRef.current = null;
    dragSnapshotRef.current = null;

    if (!over || !originColumnId || !originBoardId) {
      if (snapshot) onTasksChange(snapshot);
      return;
    }

    const drop = resolveAggregatedDrop(String(over.id), tasks);
    if (!drop) {
      if (snapshot) onTasksChange(snapshot);
      return;
    }

    const { sourceBoardId: targetBoardId, columnId: targetColumnId } = drop;
    const draggedTask = tasks.find((t) => t.id === activeTaskId);

    if (targetBoardId !== originBoardId) {
      if (snapshot) onTasksChange(snapshot);
      if (!draggedTask) return;
      setTransferSourceBoardId(originBoardId);
      setTransferTaskId(activeTaskId);
      setTransferPreset({ boardId: targetBoardId, columnId: targetColumnId });
      setTransferOpen(true);
      return;
    }

    if (originColumnId === targetColumnId) {
      const newOrder = getStatusColumnTaskIds(tasks, originColumnId);
      if (!originOrder || columnIdsEqual(originOrder, newOrder)) return;
      const srcBoard = sourceBoards.get(originBoardId);
      if (!srcBoard) {
        if (snapshot) onTasksChange(snapshot);
        setDragMoveError('Не удалось сохранить порядок');
        return;
      }
      try {
        await tasksApi.reorderInColumn(srcBoard.id, originColumnId, newOrder);
      } catch (error) {
        const message =
          error instanceof ApiError ? error.message : 'Не удалось изменить порядок задач';
        setDragMoveError(message);
        if (snapshot) onTasksChange(snapshot);
      }
      return;
    }

    const srcBoard = sourceBoards.get(originBoardId);
    if (!srcBoard || !draggedTask) {
      if (snapshot) onTasksChange(snapshot);
      return;
    }

    const approvalRules = getBoardApprovalRules(srcBoard);
    const pendingMsg = formatPendingApprovalsMessage(
      approvalRules,
      originColumnId,
      taskColumnApprovals(draggedTask),
    );
    if (pendingMsg) {
      setDragMoveError(pendingMsg);
      revertTaskStatus(activeTaskId, originColumnId);
      return;
    }

    const actionPlan = buildColumnTransitionPlan(
      srcBoard,
      {
        ...draggedTask,
        columnActionCompletions: taskColumnActionCompletions(draggedTask),
      },
      originColumnId,
      targetColumnId,
    );
    if (actionPlan.checkErrors.length > 0) {
      setDragMoveError(formatColumnTransitionCheckErrors(actionPlan.checkErrors));
      revertTaskStatus(activeTaskId, originColumnId);
      return;
    }

    if (actionPlan.interactiveSteps.length > 0) {
      revertTaskStatus(activeTaskId, originColumnId);
      setColumnTransitionError(null);
      setColumnTransition({
        taskId: activeTaskId,
        sourceBoardId: originBoardId,
        fromColumnId: originColumnId,
        toColumnId: targetColumnId,
        steps: actionPlan.interactiveSteps,
      });
      return;
    }

    const targetPosition = getStatusColumnTaskIds(tasks, targetColumnId).indexOf(activeTaskId);
    try {
      await finishColumnMove(
        activeTaskId,
        targetColumnId,
        originColumnId,
        targetPosition >= 0 ? targetPosition : undefined,
        snapshot,
      );
    } catch {
      /* сообщение уже показано */
    }
  };

  const handleTransferSuccess = async (result: {
    moved: { taskId: string; newKey: string }[];
    skipped: { taskId: string; reason: string }[];
  }) => {
    const movedIds = new Set(result.moved.map((m) => m.taskId));
    if (movedIds.size === 0) {
      setTransferNotice(
        result.skipped.length ? `Пропущено: ${result.skipped.length}` : 'Перенос не выполнен',
      );
      return;
    }

    try {
      const refreshed = await tasksApi.getByBoard(board.id);
      onTasksChange(refreshed);
      setTransferNotice(`Перенесено: ${result.moved.length}`);
    } catch {
      onTasksChange((prev) => prev.filter((t) => !movedIds.has(t.id)));
      setTransferNotice(`Перенесено: ${result.moved.length}`);
    }
  };

  const resolvedTransferSource =
    transferSourceBoardId != null ? sourceBoards.get(transferSourceBoardId) : null;

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3 mb-1">
          <Link to="/" className="text-slate-500 hover:text-slate-800">
            <ArrowLeft className="size-5" />
          </Link>
          <Layers className="size-5 text-brand" />
          <h1 className="text-xl font-semibold text-slate-900">{board.name}</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-brand-light text-brand font-medium">
            Сводная
          </span>
        </div>
        {board.description ? (
          <p className="text-sm text-slate-600 ml-11">{board.description}</p>
        ) : null}
        {dragMoveError ? (
          <p className="text-sm text-red-600 mt-2 ml-11">{dragMoveError}</p>
        ) : null}
        {transferNotice ? (
          <p className="text-sm text-green-700 mt-2 ml-11">{transferNotice}</p>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
          Загрузка задач…
        </div>
      ) : sources.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
          В сводной доске не выбраны исходные доски
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={(e) => void handleDragEnd(e)}
        >
          <div className="flex-1 overflow-x-auto p-6">
            <div className="flex gap-4 min-h-full">
              {sources.map((source) => (
                <SourceBoardColumn
                  key={source.id}
                  source={source}
                  tasks={tasksBySource.get(source.id) ?? []}
                  getAssigneeName={getAssigneeName}
                  collapsedGroups={collapsedGroups}
                  onToggleStatusGroup={toggleStatusGroup}
                />
              ))}
            </div>
          </div>
          <DragOverlay>
            {activeTask ? (
              <div className="bg-white rounded-lg p-3 border-2 border-brand shadow-lg w-72 opacity-95">
                <p className="text-sm font-medium text-slate-900">{activeTask.title}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {transferOpen && transferTaskId && !resolvedTransferSource ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 text-sm text-slate-600">
          Загрузка настроек доски…
        </div>
      ) : null}

      {transferOpen && transferTaskId && resolvedTransferSource ? (
        <TransferTaskModal
          open={transferOpen}
          sourceBoard={resolvedTransferSource}
          taskIds={[transferTaskId]}
          presetTargetBoardId={transferPreset?.boardId}
          presetTargetColumnId={transferPreset?.columnId}
          restrictTargetBoardIds={sourceBoardIds}
          onClose={() => {
            setTransferOpen(false);
            setTransferTaskId(null);
            setTransferSourceBoardId(null);
            setTransferPreset(null);
          }}
          onSuccess={(result) => {
            void handleTransferSuccess(result);
            setTransferOpen(false);
            setTransferTaskId(null);
            setTransferSourceBoardId(null);
            setTransferPreset(null);
          }}
        />
      ) : null}

      <ColumnActionTransitionModal
        open={!!columnTransition}
        steps={columnTransition?.steps ?? []}
        targetColumnName={
          columnTransition
            ? columnNameById(sources, columnTransition.toColumnId)
            : undefined
        }
        submitting={columnTransitionSubmitting}
        error={columnTransitionError}
        onClose={() => {
          if (columnTransitionSubmitting) return;
          setColumnTransition(null);
          setColumnTransitionError(null);
        }}
        onSubmitStep={async (step, payload) => {
          if (!columnTransition) return;
          setColumnTransitionSubmitting(true);
          setColumnTransitionError(null);
          try {
            const row = (await tasksApi.completeColumnAction(
              columnTransition.taskId,
              step.rule.id,
              payload,
              step.forColumnId,
            )) as TaskColumnActionCompletionRow;
            onTasksChange((prev) =>
              prev.map((t) => {
                if (t.id !== columnTransition.taskId) return t;
                const list = taskColumnActionCompletions(t);
                return { ...t, columnActionCompletions: mergeActionCompletion(list, row) };
              }),
            );
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Не удалось выполнить действие';
            setColumnTransitionError(msg);
            throw e;
          } finally {
            setColumnTransitionSubmitting(false);
          }
        }}
        onAllComplete={async () => {
          if (!columnTransition) return;
          setColumnTransitionSubmitting(true);
          setColumnTransitionError(null);
          try {
            await finishColumnMove(
              columnTransition.taskId,
              columnTransition.toColumnId,
              columnTransition.fromColumnId,
            );
            setColumnTransition(null);
          } catch (e: unknown) {
            setColumnTransitionError(
              e instanceof Error ? e.message : 'Не удалось перевести задачу',
            );
            throw e;
          } finally {
            setColumnTransitionSubmitting(false);
          }
        }}
      />
    </div>
  );
}
