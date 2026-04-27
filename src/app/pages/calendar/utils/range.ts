import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfDay,
  startOfWeek,
} from 'date-fns';

const weekStartsOn = 1 as const;

/** Дни сетки (обычно 5–6 недель) и границы запроса к API: [from, to) */
export function getMonthGridRange(anchorMonth: Date) {
  const monthStart = startOfMonth(anchorMonth);
  const monthEnd = endOfMonth(anchorMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const fromIso = startOfDay(gridStart).toISOString();
  const toIso = addDays(startOfDay(gridEnd), 1).toISOString();
  return { days, fromIso, toIso };
}
