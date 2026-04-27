import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

type Props = {
  month: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onNewEvent: () => void;
};

export function CalendarToolbar({ month, onPrev, onNext, onToday, onNewEvent }: Props) {
  const label = format(month, 'LLLL yyyy', { locale: ru });
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
          aria-label="Предыдущий месяц"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          onClick={onNext}
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
          aria-label="Следующий месяц"
        >
          <ChevronRight className="size-5" />
        </button>
        <h1 className="text-xl font-semibold text-slate-900 capitalize ml-2">{label}</h1>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToday}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800"
        >
          Сегодня
        </button>
        <button
          type="button"
          onClick={onNewEvent}
          className="px-4 py-2 text-sm rounded-lg bg-brand text-white hover:opacity-90"
        >
          Новое событие
        </button>
      </div>
    </div>
  );
}
