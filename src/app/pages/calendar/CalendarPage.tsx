import { useCallback, useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { usersApi } from '../../services/api';
import type { CalendarEventDto } from '../../services/api';
import { CalendarToolbar } from './components/CalendarToolbar';
import { CalendarGrid } from './components/CalendarGrid';
import { EventFormModal, type WorkspaceMemberOption } from './components/EventFormModal';
import { useMonthNavigation } from './hooks/useMonthNavigation';
import { useCalendarEventsForMonth } from './hooks/useCalendarEventsForMonth';

export function CalendarPage() {
  const { currentWorkspace, currentUser } = useApp();
  const { month, goPrev, goNext, goToday } = useMonthNavigation();
  const { events, loading, error, refresh } = useCalendarEventsForMonth(
    currentWorkspace?.id,
    month,
  );

  const [members, setMembers] = useState<WorkspaceMemberOption[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDay, setModalDay] = useState<Date | null>(null);
  const [editing, setEditing] = useState<CalendarEventDto | null>(null);

  const loadMembers = useCallback(async () => {
    if (!currentWorkspace) {
      setMembers([]);
      return;
    }
    try {
      const list = await usersApi.getByWorkspace(currentWorkspace.id);
      setMembers(
        list.map((u: { id: string; name: string; email: string; avatar: string | null }) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          avatar: u.avatar,
        })),
      );
    } catch {
      setMembers([]);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const openCreate = (day: Date | null = null) => {
    setEditing(null);
    setModalDay(day);
    setModalOpen(true);
  };

  const openEdit = (ev: CalendarEventDto) => {
    setEditing(ev);
    setModalDay(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setModalDay(null);
  };

  if (!currentWorkspace) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-4 py-3 text-sm">
          Выберите рабочее пространство в шапке, чтобы открыть календарь событий.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 text-slate-900 mb-1">
        <Calendar className="size-6 text-brand" />
        <span className="text-lg font-semibold">Календарь</span>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        События видны всем участникам пространства. Отметьте сотрудников как участников встречи.
      </p>

      <CalendarToolbar
        month={month}
        onPrev={goPrev}
        onNext={goNext}
        onToday={goToday}
        onNewEvent={() => openCreate(new Date())}
      />

      {loading && <div className="text-sm text-slate-500 mb-2">Загрузка событий…</div>}
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

      <div className="flex-1 min-h-0">
        <CalendarGrid
          anchorMonth={month}
          events={events}
          onSelectDay={(day) => openCreate(day)}
          onSelectEvent={openEdit}
        />
      </div>

      {currentUser && (
        <EventFormModal
          open={modalOpen}
          onClose={closeModal}
          workspaceId={currentWorkspace.id}
          members={members}
          defaultDay={modalDay}
          event={editing}
          onSaved={refresh}
          currentUserId={currentUser.id}
          isGlobalAdmin={currentUser.role === 'admin'}
        />
      )}
    </div>
  );
}
