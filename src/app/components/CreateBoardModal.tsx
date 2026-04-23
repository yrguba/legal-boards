import { useState } from 'react';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import type { BoardColumn, TaskField, TaskType } from '../types';
import { departments, groups } from '../store/mockData';
import { useApp } from '../store/AppContext';

interface CreateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (boardData: any) => void;
}

type Step = 'general' | 'columns' | 'fields' | 'types';

const fieldTypeOptions = [
  { value: 'text', label: 'Текстовое поле' },
  { value: 'textarea', label: 'Многострочное поле' },
  { value: 'select', label: 'Выпадающий список' },
  { value: 'multiselect', label: 'Множественный выбор' },
  { value: 'date', label: 'Дата' },
  { value: 'user', label: 'Пользователь' },
  { value: 'file', label: 'Файл' },
];

export function CreateBoardModal({ isOpen, onClose, onSubmit }: CreateBoardModalProps) {
  const { currentWorkspace } = useApp();
  const [currentStep, setCurrentStep] = useState<Step>('general');

  const [boardName, setBoardName] = useState('');
  const [boardDescription, setBoardDescription] = useState('');
  const [visibilityType, setVisibilityType] = useState<'workspace' | 'department' | 'group'>('workspace');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const [columns, setColumns] = useState<BoardColumn[]>([
    { id: 'col-temp-1', name: 'К выполнению', description: '', position: 0, visibility: {} },
    { id: 'col-temp-2', name: 'В работе', description: '', position: 1, visibility: {} },
    { id: 'col-temp-3', name: 'Завершено', description: '', position: 2, visibility: {} },
  ]);

  const [taskFields, setTaskFields] = useState<TaskField[]>([
    { id: 'field-temp-1', name: 'Название', type: 'text', required: true, position: 0 },
    { id: 'field-temp-2', name: 'Описание', type: 'textarea', required: false, position: 1 },
  ]);

  const [taskTypes, setTaskTypes] = useState<TaskType[]>([
    { id: 'type-temp-1', name: 'Задача', color: '#3b82f6' },
  ]);

  const workspaceDepartments = departments.filter((d) => d.workspaceId === currentWorkspace?.id);
  const workspaceGroups = groups.filter((g) => g.workspaceId === currentWorkspace?.id);

  if (!isOpen) return null;

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
    setTaskTypes(taskTypes.filter((type) => type.id !== id));
  };

  const handleSubmit = () => {
    const visibility: any = {};
    if (visibilityType === 'department') {
      visibility.departmentIds = selectedDepartments;
    } else if (visibilityType === 'group') {
      visibility.groupIds = selectedGroups;
    }

    const boardData = {
      name: boardName,
      description: boardDescription,
      visibility,
      columns,
      taskFields,
      taskTypes,
    };

    onSubmit(boardData);
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setBoardName('');
    setBoardDescription('');
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
            </div>
          )}

          {currentStep === 'columns' && (
            <div className="space-y-4">
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

              <div className="space-y-3">
                {columns.map((column, index) => (
                  <div
                    key={column.id}
                    className="border border-slate-200 rounded-lg p-4 bg-slate-50"
                  >
                    <div className="flex items-start gap-3">
                      <GripVertical className="w-5 h-5 text-slate-400 mt-2 flex-shrink-0" />
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
                      </div>
                      <button
                        onClick={() => removeColumn(column.id)}
                        className="text-red-600 hover:text-red-700 p-1 flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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

              <div className="space-y-3">
                {taskFields.map((field) => (
                  <div
                    key={field.id}
                    className="border border-slate-200 rounded-lg p-4 bg-slate-50"
                  >
                    <div className="flex items-start gap-3">
                      <GripVertical className="w-5 h-5 text-slate-400 mt-2 flex-shrink-0" />
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

                        {(field.type === 'select' || field.type === 'multiselect') && (
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
                        onClick={() => removeTaskField(field.id)}
                        className="text-red-600 hover:text-red-700 p-1 flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 'types' && (
            <div className="space-y-4">
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

              <div className="space-y-3">
                {taskTypes.map((type) => (
                  <div
                    key={type.id}
                    className="border border-slate-200 rounded-lg p-4 bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
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
                        onClick={() => removeTaskType(type.id)}
                        className="text-red-600 hover:text-red-700 p-1 flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
                Создать доску
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
