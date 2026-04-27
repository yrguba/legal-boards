import { endOfDay, startOfDay } from 'date-fns';
import type { CalendarEventDto } from '../../../services/api';

export function eventTouchesDay(event: CalendarEventDto, day: Date): boolean {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const d0 = startOfDay(day);
  const d1 = endOfDay(day);
  return start < d1 && end > d0;
}

export function eventsForDay(events: CalendarEventDto[], day: Date): CalendarEventDto[] {
  return events.filter((e) => eventTouchesDay(e, day));
}
