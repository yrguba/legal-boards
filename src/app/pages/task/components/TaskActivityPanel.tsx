import {
  ArrowRightLeft,
  CheckCircle2,
  ClipboardCheck,
  History,
  ListChecks,
  Loader2,
  UserCog,
} from 'lucide-react';
import type { TaskActivityItem } from '../../../utils/activityLog';
import { activityEventIconKind, activityEventLabel } from '../../../utils/activityLog';
import { formatDateTime } from '../utils/format';

function EventIcon({ eventType }: { eventType: string }) {
  const kind = activityEventIconKind(eventType);
  const cls = 'size-4 shrink-0';
  switch (kind) {
    case 'status':
      return <ArrowRightLeft className={`${cls} text-blue-600`} aria-hidden />;
    case 'user':
      return <UserCog className={`${cls} text-violet-600`} aria-hidden />;
    case 'approval':
      return <ClipboardCheck className={`${cls} text-emerald-600`} aria-hidden />;
    case 'action':
      return <ListChecks className={`${cls} text-amber-600`} aria-hidden />;
    default:
      return <History className={`${cls} text-slate-500`} aria-hidden />;
  }
}

export function TaskActivityPanel({
  items,
  loading,
  error,
}: {
  items: TaskActivityItem[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
        Загрузка истории…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
        <CheckCircle2 className="mx-auto mb-2 size-8 text-slate-300" aria-hidden />
        Пока нет записей в истории задачи.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5"
        >
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 rounded-md bg-white p-1.5 shadow-sm ring-1 ring-slate-100">
              <EventIcon eventType={item.eventType} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  {activityEventLabel(item.eventType)}
                </span>
                <span className="text-[11px] text-slate-400">{formatDateTime(item.occurredAt)}</span>
              </div>
              <p className="mt-0.5 text-sm text-slate-800">{item.summary}</p>
              {item.actor ? (
                <p className="mt-1 text-xs text-slate-500">{item.actor.name}</p>
              ) : item.source === 'legacy' ? (
                <p className="mt-1 text-xs text-slate-400">Архивная запись</p>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
