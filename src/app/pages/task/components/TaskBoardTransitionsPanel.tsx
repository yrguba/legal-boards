import { useEffect, useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import { tasksApi } from '../../../services/api';
import type { TaskBoardTransition } from '../../../types';
import { formatDateTime } from '../utils/format';

export function TaskBoardTransitionsPanel({ taskId }: { taskId: string }) {
  const [items, setItems] = useState<TaskBoardTransition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void tasksApi
      .getTransitions(taskId)
      .then((res) => {
        if (!cancelled) setItems(res.items ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Не удалось загрузить маршрут');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  if (loading) {
    return (
      <div className="border-t border-slate-200 pt-4 mt-4 flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Загрузка маршрута…
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-t border-slate-200 pt-4 mt-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
        {error}
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="border-t border-slate-200 pt-4 mt-4">
      <div className="mb-2 flex items-center gap-2">
        <History className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-medium text-slate-900">Маршрут</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <div className="text-slate-900">{item.summary ?? item.eventKind}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {formatDateTime(item.occurredAt)}
              {item.actor?.name ? ` · ${item.actor.name}` : ''}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
