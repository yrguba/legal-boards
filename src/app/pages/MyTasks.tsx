import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ListTodo, Loader2, RefreshCw, Search } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { tasksApi } from '../services/api';
import { TaskPriorityBadge } from '../components/TaskPriorityBadge';
import type { Task } from '../types';

type MyTaskRow = Task & {
  boardName?: string;
  columnName?: string;
  displayBoardId?: string;
};

type ScopeFilter = 'assigned' | 'created' | 'all';

const SCOPE_OPTIONS: { value: ScopeFilter; label: string }[] = [
  { value: 'assigned', label: 'Назначенные мне' },
  { value: 'created', label: 'Созданные мной' },
  { value: 'all', label: 'Назначенные и созданные' },
];

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function MyTasks() {
  const { currentWorkspace } = useApp();
  const [tasks, setTasks] = useState<MyTaskRow[]>([]);
  const [scope, setScope] = useState<ScopeFilter>('assigned');
  const [boardFilter, setBoardFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    const workspaceId = currentWorkspace?.id;
    if (!workspaceId) {
      setTasks([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await tasksApi.getMyTasks(workspaceId, { scope });
      setTasks((data || []) as MyTaskRow[]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Не удалось загрузить задачи';
      setError(message);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, scope]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const boardOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      const id = task.displayBoardId ?? task.boardId;
      const name = task.boardName ?? task.boardCode ?? id;
      if (id) map.set(id, name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (boardFilter) {
        const boardId = task.displayBoardId ?? task.boardId;
        if (boardId !== boardFilter) return false;
      }
      if (!q) return true;
      const haystack = [
        task.key,
        task.title,
        task.boardName,
        task.columnName,
        task.type?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [tasks, boardFilter, search]);

  if (!currentWorkspace) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-600">
        Выберите рабочее пространство
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
              <ListTodo className="size-6 text-brand" />
              Мои задачи
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Все ваши задачи на досках пространства «{currentWorkspace.name}»
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadTasks()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Обновить
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="whitespace-nowrap">Показать:</span>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as ScopeFilter)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
            >
              {SCOPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="whitespace-nowrap">Доска:</span>
            <select
              value={boardFilter}
              onChange={(e) => setBoardFilter(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
            >
              <option value="">Все доски</option>
              {boardOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <label className="relative flex min-w-[220px] flex-1 items-center">
            <Search className="pointer-events-none absolute left-2.5 size-4 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по ключу, названию, доске…"
              className="w-full rounded-md border border-slate-200 py-1.5 pl-9 pr-3 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : loading && tasks.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-600">
            <Loader2 className="size-5 animate-spin" />
            Загрузка задач…
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-600">
            {tasks.length === 0
              ? 'Задач по выбранному фильтру пока нет'
              : 'Ничего не найдено по текущим фильтрам'}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Ключ</th>
                  <th className="px-4 py-3">Название</th>
                  <th className="px-4 py-3">Доска</th>
                  <th className="px-4 py-3">Колонка</th>
                  <th className="px-4 py-3">Тип</th>
                  <th className="px-4 py-3">Приоритет</th>
                  <th className="px-4 py-3">Обновлено</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((task) => {
                  const boardId = task.displayBoardId ?? task.boardId;
                  const taskHref = task.key ? `/task/${task.key}` : `/task/${task.id}`;

                  return (
                    <tr key={task.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          to={taskHref}
                          className="font-mono text-xs font-medium text-brand hover:underline"
                        >
                          {task.key ?? task.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link to={taskHref} className="font-medium text-slate-900 hover:text-brand">
                          {task.title}
                        </Link>
                        {(task.boardPlacementsCount ?? 0) > 1 ? (
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                            {task.boardPlacementsCount} доски
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          to={`/board/${boardId}`}
                          className="text-slate-700 hover:text-brand hover:underline"
                        >
                          {task.boardName ?? task.boardCode ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {task.columnName ?? '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {task.type?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <TaskPriorityBadge priority={task.priority} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        {formatDateTime(task.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
              Показано {filteredTasks.length} из {tasks.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
