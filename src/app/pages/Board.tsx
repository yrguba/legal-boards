import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { boards, tasks, users, taskTypes } from '../store/mockData';
import {
  Plus,
  LayoutGrid,
  List,
  Filter,
  Settings,
  MoreHorizontal,
} from 'lucide-react';

export function Board() {
  const { boardId } = useParams();
  const board = boards.find((b) => b.id === boardId);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>(board?.viewMode || 'kanban');
  const boardTasks = tasks.filter((t) => t.boardId === boardId);

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
          <div className="flex gap-4 h-full">
            {board.columns.map((column) => {
              const columnTasks = getTasksByColumn(column.id);
              return (
                <div
                  key={column.id}
                  className="flex-shrink-0 w-80 bg-slate-50 rounded-lg p-4 flex flex-col"
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

                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {columnTasks.map((task) => (
                      <Link
                        key={task.id}
                        to={`/task/${task.id}`}
                        className="block bg-white rounded-lg p-4 border border-slate-200 hover:border-brand hover:shadow-md transition-all group"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-sm font-medium text-slate-900 group-hover:text-brand transition-colors flex-1">
                            {task.title}
                          </h4>
                          <button className="text-slate-400 hover:text-slate-600 ml-2">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>

                        {task.description && (
                          <p className="text-xs text-slate-600 mb-3 line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between">
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
                          <div className="mt-2 text-xs text-slate-600">
                            Приоритет: {task.customFields.priority}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>

                  <button className="mt-4 w-full flex items-center justify-center gap-2 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors">
                    <Plus className="w-4 h-4" />
                    Добавить задачу
                  </button>
                </div>
              );
            })}
          </div>
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
                  const column = board.columns.find((c) => c.id === task.columnId);
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
    </div>
  );
}
