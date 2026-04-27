import { useCallback, useEffect, useState } from 'react';
import { calendarEventsApi, type CalendarEventDto } from '../../../services/api';
import { getMonthGridRange } from '../utils/range';

export function useCalendarEventsForMonth(workspaceId: string | undefined, anchorMonth: Date) {
  const [events, setEvents] = useState<CalendarEventDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setEvents([]);
      return;
    }
    const { fromIso, toIso } = getMonthGridRange(anchorMonth);
    setLoading(true);
    setError(null);
    try {
      const list = await calendarEventsApi.listByWorkspace(workspaceId, fromIso, toIso);
      setEvents(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, anchorMonth]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { events, loading, error, refresh };
}
