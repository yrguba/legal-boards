import { format, isSameMonth, isToday } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { CalendarEventDto } from '../../../services/api';
import { getMonthGridRange } from '../utils/range';
import { eventsForDay } from '../utils/eventDay';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

type Props = {
  anchorMonth: Date;
  events: CalendarEventDto[];
  onSelectDay: (day: Date) => void;
  onSelectEvent: (event: CalendarEventDto) => void;
};

export function CalendarGrid({ anchorMonth, events, onSelectDay, onSelectEvent }: Props) {
  const { days } = getMonthGridRange(anchorMonth);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-slate-500 py-2 border-r border-slate-100 last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr min-h-[480px]">
        {days.map((day) => {
          const outside = !isSameMonth(day, anchorMonth);
          const today = isToday(day);
          const dayEvents = eventsForDay(events, day);
          return (
            <div
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectDay(day);
                }
              }}
              role="button"
              tabIndex={0}
              className={`min-h-[88px] border-b border-r border-slate-100 p-1.5 text-left align-top transition-colors cursor-pointer hover:bg-slate-50/80 ${
                outside ? 'bg-slate-50/50' : 'bg-white'
              } ${today ? 'ring-1 ring-inset ring-brand/30' : ''}`}
            >
              <div
                className={`text-sm font-medium mb-1 ${
                  outside ? 'text-slate-400' : today ? 'text-brand' : 'text-slate-900'
                }`}
              >
                {format(day, 'd', { locale: ru })}
              </div>
              <div className="space-y-0.5 overflow-hidden max-h-[72px]">
                {dayEvents.slice(0, 4).map((ev) => (
                  <div
                    key={ev.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(ev);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelectEvent(ev);
                      }
                    }}
                    className="text-[11px] leading-tight truncate rounded px-1 py-0.5 bg-brand-light text-brand cursor-pointer hover:opacity-90"
                    title={ev.title}
                  >
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 4 && (
                  <div className="text-[10px] text-slate-500 pl-1">+{dayEvents.length - 4}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
