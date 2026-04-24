import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import type { BoardColumn, TaskField, TaskType } from '../types';
import { departments, groups } from '../store/mockData';
import { useApp } from '../store/AppContext';
import { boardsApi } from '../services/api';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableItem({
  id,
  children,
}: {
  id: string;
  children: (args: { handleProps: any; isDragging: boolean }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ handleProps: { ...attributes, ...listeners }, isDragging })}
    </div>
  );
}

interface CreateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (boardData: any) => void | Promise<void>;
  initialData?: any;
  submitLabel?: string;
  columnTaskCounts?: Record<string, number>;
  typeTaskCounts?: Record<string, number>;
}

type Step = 'general' | 'columns' | 'fields' | 'types';

const fieldTypeOptions = [
  { value: 'text', label: 'Текстовое поле' },
  { value: 'textarea', label: 'Многострочное поле' },
  { value: 'select', label: 'Выпадающий список' },
  { value: 'date', label: 'Дата' },
];

export function CreateBoardModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  submitLabel = 'Создать доску',
  columnTaskCounts = {},
  typeTaskCounts = {},
}: CreateBoardModalProps) {
  const { currentWorkspace } = useApp();
  const [currentStep, setCurrentStep] = useState<Step>('general');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [boardName, setBoardName] = useState('');
  const [boardDescription, setBoardDescription] = useState('');
  const [attachmentsEnabled, setAttachmentsEnabled] = useState(true);
  const [visibilityType, setVisibilityType] = useState<'workspace' | 'department' | 'group'>('workspace');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const [columns, setColumns] = useState<BoardColumn[]>([
    { id: 'col-temp-1', name: 'К выполнению', description: '', position: 0, visibility: {} },
    { id: 'col-temp-2', name: 'В работе', description: '', position: 1, visibility: {} },
    { id: 'col-temp-3', name: 'Завершено', description: '', position: 2, visibility: {} },
  ]);
  const [deleteColumnError, setDeleteColumnError] = useState<string | null>(null);
  const [pendingDeleteColumnId, setPendingDeleteColumnId] = useState<string>('');
  const [moveTasksToColumnId, setMoveTasksToColumnId] = useState<string>('');
  const [isMovingTasks, setIsMovingTasks] = useState(false);

  const [taskFields, setTaskFields] = useState<TaskField[]>([
    { id: 'field-temp-1', name: 'Название', type: 'text', required: true, position: 0 },
    { id: 'field-temp-2', name: 'Описание', type: 'textarea', required: false, position: 1 },
  ]);

  const [taskTypes, setTaskTypes] = useState<TaskType[]>([
    { id: 'type-temp-1', name: 'Задача', color: '#3b82f6' },
  ]);
  const [deleteTypeError, setDeleteTypeError] = useState<string | null>(null);
  const [pendingDeleteTypeId, setPendingDeleteTypeId] = useState<string>('');
  const [moveTasksToTypeId, setMoveTasksToTypeId] = useState<string>('');
  const [isMovingTypeTasks, setIsMovingTypeTasks] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (!initialData) return;

    setBoardName(initialData.name || '');
    setBoardDescription(initialData.description || '');
    setAttachmentsEnabled(initialData.attachmentsEnabled !== false);

    const vis = initialData.visibility || {};
    if (Array.isArray(vis.departmentIds) && vis.departmentIds.length) {
      setVisibilityType('department');
      setSelectedDepartments(vis.departmentIds);
      setSelectedGroups([]);
    } else if (Array.isArray(vis.groupIds) && vis.groupIds.length) {
      setVisibilityType('group');
      setSelectedGroups(vis.groupIds);
      setSelectedDepartments([]);
    } else {
      setVisibilityType('workspace');
      setSelectedDepartments([]);
      setSelectedGroups([]);
    }

    setColumns(
      (initialData.columns || []).map((c: any, idx: number) => ({
        id: c.id || `col-temp-${Date.now()}-${idx}`,
        name: c.name || '',
        description: c.description || '',
        position: typeof c.position === 'number' ? c.position : idx,
        visibility: c.visibility || {},
        autoAssign: c.autoAssign,
      }))
    );

    setTaskFields(
      (initialData.taskFields || []).map((f: any, idx: number) => ({
        id: f.id || `field-temp-${Date.now()}-${idx}`,
        name: f.name || '',
        type: f.type || 'text',
        required: !!f.required,
        options: f.options,
        position: typeof f.position === 'number' ? f.position : idx,
      }))
    );

    setTaskTypes(
      (initialData.taskTypes || []).map((t: any, idx: number) => ({
        id: t.id || `type-temp-${Date.now()}-${idx}`,
        name: t.name || '',
        color: t.color || '#3b82f6',
        icon: t.icon,
      }))
    );
  }, [initialData, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setDeleteColumnError(null);
    setPendingDeleteColumnId('');
    setMoveTasksToColumnId('');
    setIsMovingTasks(false);
    setDeleteTypeError(null);
    setPendingDeleteTypeId('');
    setMoveTasksToTypeId('');
    setIsMovingTypeTasks(false);
  }, [isOpen]);

  const workspaceDepartments = departments.filter((d) => d.workspaceId === currentWorkspace?.id);
  const workspaceGroups = groups.filter((g) => g.workspaceId === currentWorkspace?.id);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const reorderColumns = (activeId: string, overId: string) => {
    const oldIndex = columns.findIndex((c) => c.id === activeId);
    const newIndex = columns.findIndex((c) => c.id === overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    const next = arrayMove(columns, oldIndex, newIndex).map((c, idx) => ({ ...c, position: idx }));
    setColumns(next);
  };

  const reorderFields = (activeId: string, overId: string) => {
    const oldIndex = taskFields.findIndex((f) => f.id === activeId);
    const newIndex = taskFields.findIndex((f) => f.id === overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    const next = arrayMove(taskFields, oldIndex, newIndex).map((f, idx) => ({ ...f, position: idx }));
    setTaskFields(next);
  };

  const reorderTypes = (activeId: string, overId: string) => {
    const oldIndex = taskTypes.findIndex((t) => t.id === activeId);
    const newIndex = taskTypes.findIndex((t) => t.id === overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    setTaskTypes(arrayMove(taskTypes, oldIndex, newIndex));
  };

  const canMoveTasksForColumnDeletion =
    !!initialData?.id && !!pendingDeleteColumnId && (columnTaskCounts[pendingDeleteColumnId] || 0) > 0;

  const handleMoveTasksAndDeleteColumn = async () => {
    if (!initialData?.id) return;
    if (!pendingDeleteColumnId) return;
    if (!moveTasksToColumnId) {
      setDeleteColumnError('Выберите колонку, куда перенести задачи');
      return;
    }
    if (moveTasksToColumnId === pendingDeleteColumnId) {
      setDeleteColumnError('Нельзя переносить задачи в ту же колонку');
      return;
    }

    setIsMovingTasks(true);
    setDeleteColumnError(null);
    try {
      await boardsApi.moveTasks(initialData.id, pendingDeleteColumnId, moveTasksToColumnId);
      setColumns((prev) => prev.filter((c) => c.id !== pendingDeleteColumnId));
      setPendingDeleteColumnId('');
      setMoveTasksToColumnId('');
    } catch (e: any) {
      setDeleteColumnError(e?.message || 'Не удалось перенести задачи');
    } finally {
      setIsMovingTasks(false);
    }
  };

  const canMoveTasksForTypeDeletion =
    !!initialData?.id && !!pendingDeleteTypeId && (typeTaskCounts[pendingDeleteTypeId] || 0) > 0;

  const handleMoveTasksAndDeleteType = async () => {
    if (!initialData?.id) return;
    if (!pendingDeleteTypeId) return;
    if (!moveTasksToTypeId) {
      setDeleteTypeError('Выберите тип, на который заменить');
      return;
    }
    if (moveTasksToTypeId === pendingDeleteTypeId) {
      setDeleteTypeError('Нельзя заменить на тот же тип');
      return;
    }

    setIsMovingTypeTasks(true);
    setDeleteTypeError(null);
    try {
      await boardsApi.moveTasksType(initialData.id, pendingDeleteTypeId, moveTasksToTypeId);
      setTaskTypes((prev) => prev.filter((t) => t.id !== pendingDeleteTypeId));
      setPendingDeleteTypeId('');
      setMoveTasksToTypeId('');
    } catch (e: any) {
      setDeleteTypeError(e?.message || 'Не удалось заменить тип');
    } finally {
      setIsMovingTypeTasks(false);
    }
  };

  const addColumn = () => {
    const newColumn: BoardColumn = {
      id: `col-temp-${Date.now()}`,
      name: '',
      description: '',
      position: columns.length,
      visibility: {},
    };
    setColumns([...columns, newColumn]);
  };

  const updateColumn = (id: string, updates: Partial<BoardColumn>) => {
    setColumns(columns.map((col) => (col.id === id ? { ...col, ...updates } : col)));
  };

  const removeColumn = (id: string) => {
    const cnt = columnTaskCounts[id] || 0;
    if (cnt > 0) {
      setDeleteColumnError(`Нельзя удалить колонку: в ней ${cnt} задач(и). Перенесите их в другую колонку.`);
      setPendingDeleteColumnId(id);
      const fallback = columns.find((c) => c.id !== id)?.id || '';
      setMoveTasksToColumnId(fallback);
      return;
    }
    setColumns(columns.filter((col) => col.id !== id));
  };

  const addTaskField = () => {
    const newField: TaskField = {
      id: `field-temp-${Date.now()}`,
      name: '',
      type: 'text',
      required: false,
      position: taskFields.length,
    };
    setTaskFields([...taskFields, newField]);
  };

  const updateTaskField = (id: string, updates: Partial<TaskField>) => {
    setTaskFields(taskFields.map((field) => (field.id === id ? { ...field, ...updates } : field)));
  };

  const removeTaskField = (id: string) => {
    setTaskFields(taskFields.filter((field) => field.id !== id));
  };

  const addTaskType = () => {
    const colors = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899'];
    const newType: TaskType = {
      id: `type-temp-${Date.now()}`,
      name: '',
      color: colors[taskTypes.length % colors.length],
    };
    setTaskTypes([...taskTypes, newType]);
  };

  const updateTaskType = (id: string, updates: Partial<TaskType>) => {
    setTaskTypes(taskTypes.map((type) => (type.id === id ? { ...type, ...updates } : type)));
  };

  const removeTaskType = (id: string) => {
    const cnt = typeTaskCounts[id] || 0;
    if (cnt > 0) {
      setDeleteTypeError(
        `Нельзя удалить тип: он используется в ${cnt} задач(е/ах). Выберите тип для замены.`
      );
      setPendingDeleteTypeId(id);
      const fallback = taskTypes.find((t) => t.id !== id)?.id || '';
      setMoveTasksToTypeId(fallback);
      return;
    }
    setTaskTypes(taskTypes.filter((type) => type.id !== id));
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    const visibility: any = {};
    if (visibilityType === 'department') {
      visibility.departmentIds = selectedDepartments;
    } else if (visibilityType === 'group') {
      visibility.groupIds = selectedGroups;
    }

    const boardData = {
      name: boardName,
      description: boardDescription,
      attachmentsEnabled,
      visibility,
      columns,
      taskFields,
      taskTypes,
    };

    try {
      await onSubmit(boardData);
      resetForm();
      onClose();
    } catch (e: any) {
      setSubmitError(e?.message || 'Не удалось создать доску');
    }
  };

  const resetForm = () => {
    setBoardName('');
    setBoardDescription('');
    setAttachmentsEnabled(true);
    setVisibilityType('workspace');
    setSelectedDepartments([]);
    setSelectedGroups([]);
    setCurrentStep('general');
    setColumns([
      { id: 'col-temp-1', name: 'К выполнению', description: '', position: 0, visibility: {} },
      { id: 'col-temp-2', name: 'В работе', description: '', position: 1, visibility: {} },
      { id: 'col-temp-3', name: 'Завершено', description: '', position: 2, visibility: {} },
    ]);
    setTaskFields([
      { id: 'field-temp-1', name: 'Название', type: 'text', required: true, position: 0 },
      { id: 'field-temp-2', name: 'Описание', type: 'textarea', required: false, position: 1 },
    ]);
    setTaskTypes([{ id: 'type-temp-1', name: 'Задача', color: '#3b82f6' }]);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'general':
        return boardName.trim() !== '';
      case 'columns':
        return columns.length > 0 && columns.every((col) => col.name.trim() !== '');
      case 'fields':
        return taskFields.length > 0 && taskFields.every((field) => field.name.trim() !== '');
      case 'types':
        return taskTypes.length > 0 && taskTypes.every((type) => type.name.trim() !== '');
      default:
        return false;
    }
  };

  const steps: Step[] = ['general', 'columns', 'fields', 'types'];
  const stepLabels = {
    general: 'Общие настройки',
    columns: 'Колонки (статусы)',
    fields: 'Поля задачи',
    types: 'Типы задач',
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Создание рабочей доски</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitError && (
          <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-200 overflow-x-auto">
          {steps.map((step, index) => (
            <button
              key={step}
              onClick={() => setCurrentStep(step)}
              className={`px-4 py-2 rounded text-sm whitespace-nowrap transition-colors ${
                currentStep === step
                  ? 'bg-brand-light text-brand'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {index + 1}. {stepLabels[step]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {currentStep === 'general' && (
            <div className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Название доски *
                </label>
                <input
                  type="text"
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                  placeholder="Введите название доски"
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Описание
                </label>
                <textarea
                  value={boardDescription}
                  onChange={(e) => setBoardDescription(e.target.value)}
                  placeholder="Краткое описание доски"
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Доступность
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={visibilityType === 'workspace'}
                      onChange={() => setVisibilityType('workspace')}
                      className="w-4 h-4 text-brand"
                    />
                    <span className="text-sm text-slate-700">Всё рабочее пространство</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={visibilityType === 'department'}
                      onChange={() => setVisibilityType('department')}
                      className="w-4 h-4 text-brand"
                    />
                    <span className="text-sm text-slate-700">Выбранные отделы</span>
                  </label>

                  {visibilityType === 'department' && (
                    <div className="ml-6 mt-2 space-y-2">
                      {workspaceDepartments.map((dept) => (
                        <label key={dept.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedDepartments.includes(dept.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedDepartments([...selectedDepartments, dept.id]);
                              } else {
                                setSelectedDepartments(
                                  selectedDepartments.filter((id) => id !== dept.id)
                                );
                              }
                            }}
                            className="w-4 h-4 text-brand"
                          />
                          <span className="text-sm text-slate-700">{dept.name}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={visibilityType === 'group'}
                      onChange={() => setVisibilityType('group')}
                      className="w-4 h-4 text-brand"
                    />
                    <span className="text-sm text-slate-700">Выбранные группы</span>
                  </label>

                  {visibilityType === 'group' && (
                    <div className="ml-6 mt-2 space-y-2">
                      {workspaceGroups.map((group) => (
                        <label key={group.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedGroups.includes(group.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedGroups([...selectedGroups, group.id]);
                              } else {
                                setSelectedGroups(selectedGroups.filter((id) => id !== group.id));
                              }
                            }}
                            className="w-4 h-4 text-brand"
                          />
                          <span className="text-sm text-slate-700">{group.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={attachmentsEnabled}
                    onChange={(e) => setAttachmentsEnabled(e.target.checked)}
                    className="w-4 h-4 text-brand"
                  />
                  <span className="text-sm text-slate-700">Вложения включены</span>
                </label>
              </div>
            </div>
          )}

          {currentStep === 'columns' && (
            <div className="space-y-4">
              {deleteColumnError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {deleteColumnError}
                </div>
              )}

              {canMoveTasksForColumnDeletion && (
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="text-sm font-medium text-slate-900 mb-2">
                    Перенос задач перед удалением
                  </div>
                  <div className="text-sm text-slate-600 mb-3">
                    Вы пытаетесь удалить колонку, в которой есть задачи. Выберите колонку-приемник,
                    чтобы перенести задачи, затем колонка будет удалена.
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={moveTasksToColumnId}
                      onChange={(e) => setMoveTasksToColumnId(e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      <option value="" disabled>
                        Выберите колонку
                      </option>
                      {columns
                        .filter((c) => c.id !== pendingDeleteColumnId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name || 'Без названия'}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleMoveTasksAndDeleteColumn}
                      disabled={isMovingTasks}
                      className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isMovingTasks ? 'Перенос…' : 'Перенести и удалить'}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-600">
                  Настройте колонки (статусы) для вашей доски
                </p>
                <button
                  onClick={addColumn}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-brand text-white rounded hover:bg-brand-hover transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Добавить колонку
                </button>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => {
                  if (!e.over) return;
                  reorderColumns(String(e.active.id), String(e.over.id));
                }}
              >
                <SortableContext items={columns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {columns.map((column) => (
                      <SortableItem key={column.id} id={column.id}>
                        {({ handleProps }) => (
                          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                {...handleProps}
                                className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 mt-1 flex-shrink-0"
                                aria-label="Переместить колонку"
                              >
                                <GripVertical className="w-5 h-5" />
                              </button>
                              <div className="flex-1 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">
                                      Название *
                                    </label>
                                    <input
                                      type="text"
                                      value={column.name}
                                      onChange={(e) => updateColumn(column.id, { name: e.target.value })}
                                      placeholder="Название колонки"
                                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">
                                      Краткое описание
                                    </label>
                                    <input
                                      type="text"
                                      value={column.description || ''}
                                      onChange={(e) =>
                                        updateColumn(column.id, { description: e.target.value })
                                      }
                                      placeholder="Описание"
                                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                                    />
                                  </div>
                                </div>
                                {!!columnTaskCounts[column.id] && (
                                  <div className="text-xs text-slate-500">
                                    Задач в колонке: {columnTaskCounts[column.id]}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => removeColumn(column.id)}
                                className="text-red-600 hover:text-red-700 p-1 flex-shrink-0"
                                type="button"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </SortableItem>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {currentStep === 'fields' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-600">
                  Настройте поля, которые будут у каждой задачи
                </p>
                <button
                  onClick={addTaskField}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-brand text-white rounded hover:bg-brand-hover transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Добавить поле
                </button>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => {
                  if (!e.over) return;
                  reorderFields(String(e.active.id), String(e.over.id));
                }}
              >
                <SortableContext
                  items={taskFields.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {taskFields.map((field) => (
                      <SortableItem key={field.id} id={field.id}>
                        {({ handleProps }) => (
                          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                {...handleProps}
                                className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 mt-1 flex-shrink-0"
                                aria-label="Переместить поле"
                              >
                                <GripVertical className="w-5 h-5" />
                              </button>
                              <div className="flex-1 space-y-3">
                                <div className="grid grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">
                                      Название поля *
                                    </label>
                                    <input
                                      type="text"
                                      value={field.name}
                                      onChange={(e) => updateTaskField(field.id, { name: e.target.value })}
                                      placeholder="Название"
                                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">
                                      Тип поля *
                                    </label>
                                    <select
                                      value={field.type}
                                      onChange={(e) =>
                                        updateTaskField(field.id, {
                                          type: e.target.value as TaskField['type'],
                                        })
                                      }
                                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                                    >
                                      {fieldTypeOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="flex items-end">
                                    <label className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={field.required}
                                        onChange={(e) =>
                                          updateTaskField(field.id, { required: e.target.checked })
                                        }
                                        className="w-4 h-4 text-brand"
                                      />
                                      <span className="text-sm text-slate-700">Обязательное</span>
                                    </label>
                                  </div>
                                </div>

                                {field.type === 'select' && (
                                  <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">
                                      Варианты (через запятую)
                                    </label>
                                    <input
                                      type="text"
                                      value={field.options?.join(', ') || ''}
                                      onChange={(e) =>
                                        updateTaskField(field.id, {
                                          options: e.target.value.split(',').map((o) => o.trim()),
                                        })
                                      }
                                      placeholder="Вариант 1, Вариант 2, Вариант 3"
                                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                                    />
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeTaskField(field.id)}
                                className="text-red-600 hover:text-red-700 p-1 flex-shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </SortableItem>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {currentStep === 'types' && (
            <div className="space-y-4">
              {deleteTypeError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {deleteTypeError}
                </div>
              )}

              {canMoveTasksForTypeDeletion && (
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="text-sm font-medium text-slate-900 mb-2">Замена типа перед удалением</div>
                  <div className="text-sm text-slate-600 mb-3">
                    Этот тип используется в задачах. Выберите тип, на который заменить, и нажмите
                    «Заменить и удалить».
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={moveTasksToTypeId}
                      onChange={(e) => setMoveTasksToTypeId(e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      <option value="" disabled>
                        Выберите тип
                      </option>
                      {taskTypes
                        .filter((t) => t.id !== pendingDeleteTypeId)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name || 'Без названия'}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleMoveTasksAndDeleteType}
                      disabled={isMovingTypeTasks}
                      className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isMovingTypeTasks ? 'Замена…' : 'Заменить и удалить'}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-600">Настройте типы задач для классификации</p>
                <button
                  onClick={addTaskType}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-brand text-white rounded hover:bg-brand-hover transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Добавить тип
                </button>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => {
                  if (!e.over) return;
                  reorderTypes(String(e.active.id), String(e.over.id));
                }}
              >
                <SortableContext
                  items={taskTypes.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {taskTypes.map((type) => (
                      <SortableItem key={type.id} id={type.id}>
                        {({ handleProps }) => (
                          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                {...handleProps}
                                className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 flex-shrink-0"
                                aria-label="Переместить тип"
                              >
                                <GripVertical className="w-5 h-5" />
                              </button>
                              <div className="flex-1 grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Название типа *
                                  </label>
                                  <input
                                    type="text"
                                    value={type.name}
                                    onChange={(e) => updateTaskType(type.id, { name: e.target.value })}
                                    placeholder="Название типа"
                                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Цвет
                                  </label>
                                  <input
                                    type="color"
                                    value={type.color}
                                    onChange={(e) => updateTaskType(type.id, { color: e.target.value })}
                                    className="w-full h-10 px-1 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
                                  />
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeTaskType(type.id)}
                                className="text-red-600 hover:text-red-700 p-1 flex-shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </SortableItem>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded transition-colors"
          >
            Отмена
          </button>
          <div className="flex items-center gap-2">
            {currentStep !== 'general' && (
              <button
                onClick={() => {
                  const currentIndex = steps.indexOf(currentStep);
                  setCurrentStep(steps[currentIndex - 1]);
                }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded transition-colors"
              >
                Назад
              </button>
            )}
            {currentStep !== 'types' ? (
              <button
                onClick={() => {
                  const currentIndex = steps.indexOf(currentStep);
                  setCurrentStep(steps[currentIndex + 1]);
                }}
                disabled={!canProceed()}
                className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Далее
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canProceed()}
                className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
