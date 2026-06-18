import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Video, Plus, ExternalLink, CalendarPlus, Pencil, Trash2, Ban } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { conferencesApi, usersApi } from '../services/api';
import { useConferencesConfig } from '../features/conferences/useConferencesConfig';
import {
  ScheduleConferenceModal,
  type WorkspaceMemberOption,
} from '../features/conferences/ScheduleConferenceModal';
import type { Conference } from '../types';

export function Conferences() {
  const { currentWorkspace, currentUser } = useApp();
  const navigate = useNavigate();
  const { enabled, loading: configLoading } = useConferencesConfig();
  const [rows, setRows] = useState<Conference[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editingConference, setEditingConference] = useState<Conference | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await conferencesApi.listByWorkspace(currentWorkspace.id);
      setRows(data as Conference[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  useEffect(() => {
    if (!currentWorkspace?.id) {
      setMembers([]);
      return;
    }
    usersApi
      .getByWorkspace(currentWorkspace.id)
      .then((list) =>
        setMembers(
          list.map((u: { id: string; name: string; email: string; avatar: string | null }) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            avatar: u.avatar,
          })),
        ),
      )
      .catch(() => setMembers([]));
  }, [currentWorkspace?.id]);

  const handleStartInstant = async () => {
    if (!currentWorkspace?.id || creating) return;
    setCreating(true);
    setError(null);
    try {
      const conf = await conferencesApi.createInstant(currentWorkspace.id);
      navigate(`/conferences/${conf.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось создать конференцию');
    } finally {
      setCreating(false);
    }
  };

  const canManage = (c: Conference) =>
    currentUser?.id === c.createdById || currentUser?.role === 'admin';

  const hasInvitees = (c: Conference) =>
    (c.attendeeIds ?? []).some((id) => id !== c.createdById);

  const openEdit = async (c: Conference) => {
    setActionId(c.id);
    setError(null);
    try {
      const full = (await conferencesApi.getById(c.id)) as Conference;
      setEditingConference(full);
      setScheduleOpen(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить конференцию');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (c: Conference) => {
    if (!canManage(c)) return;
    if (!confirm(`Удалить конференцию «${c.title}»?`)) return;
    setActionId(c.id);
    setError(null);
    try {
      await conferencesApi.delete(c.id);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить');
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (c: Conference) => {
    if (!canManage(c)) return;
    const msg = hasInvitees(c)
      ? `Отменить «${c.title}»? Приглашённые сотрудники получат уведомление и письмо.`
      : `Отменить «${c.title}»?`;
    if (!confirm(msg)) return;
    setActionId(c.id);
    setError(null);
    try {
      const result = await conferencesApi.cancel(c.id);
      const stats = result.notifyStats;
      if (stats && (stats.notifications || stats.emails)) {
        window.alert(
          `Конференция отменена (уведомлений: ${stats.notifications ?? 0}, писем: ${stats.emails ?? 0})`,
        );
      }
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось отменить');
    } finally {
      setActionId(null);
    }
  };

  if (configLoading) {
    return <p className="p-8 text-sm text-slate-500">Загрузка…</p>;
  }

  if (!enabled) {
    return (
      <div className="p-8 text-center text-sm text-slate-600">
        Раздел «Конференции» отключён (CONFERENCES_ENABLED=false).
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Video className="size-7 text-brand" />
            Конференции
          </h1>
          <p className="text-sm text-slate-600 mt-1">Видеозвонки через Jitsi</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={creating || !currentWorkspace}
            onClick={() => void handleStartInstant()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            <Plus className="size-4" />
            {creating ? 'Создание…' : 'Начать сейчас'}
          </button>
          <button
            type="button"
            disabled={!currentWorkspace}
            onClick={() => {
              setEditingConference(null);
              setScheduleOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            <CalendarPlus className="size-4" />
            Запланировать
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-800">
          Активные и запланированные
        </div>
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Загрузка…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500 text-center">
            Нет конференций. Нажмите «Начать сейчас», чтобы создать видеозвонок.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((c) => {
              const busy = actionId === c.id;
              const managed = canManage(c);
              const scheduled = c.mode === 'scheduled' && c.status === 'scheduled';
              return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{c.title}</p>
                  <p className="text-xs text-slate-500">
                    {c.createdBy?.name ?? '—'} ·{' '}
                    {c.mode === 'scheduled'
                      ? format(new Date(c.startAt), 'd MMM yyyy, HH:mm', { locale: ru })
                      : c.status === 'active'
                        ? 'Активна'
                        : c.status}
                  </p>
                </div>
                {c.canJoin !== false ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/conferences/${c.id}`)}
                    className="text-sm text-brand hover:underline"
                  >
                    Войти
                  </button>
                ) : null}
                <a
                  href={c.joinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-brand"
                >
                  <ExternalLink className="size-3.5" />
                  Ссылка для гостей
                </a>
                {managed && scheduled ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void openEdit(c)}
                      className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-brand disabled:opacity-50"
                    >
                      <Pencil className="size-3.5" />
                      Изменить
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleCancel(c)}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                      <Ban className="size-3.5" />
                      Отменить
                    </button>
                  </>
                ) : null}
                {managed && c.mode === 'instant' ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDelete(c)}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" />
                    Удалить
                  </button>
                ) : null}
                {managed && scheduled && !hasInvitees(c) ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDelete(c)}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" />
                    Удалить
                  </button>
                ) : null}
              </li>
            );
            })}
          </ul>
        )}
      </div>

      {!currentUser ? null : (
        <p className="mt-4 text-xs text-slate-500">
          Гостям отправляйте ссылку «для гостей» — они смогут представиться и настроить камеру/микрофон перед входом.
        </p>
      )}

      {currentWorkspace && (
        <ScheduleConferenceModal
          open={scheduleOpen}
          onClose={() => {
            setScheduleOpen(false);
            setEditingConference(null);
          }}
          workspaceId={currentWorkspace.id}
          members={members}
          conference={editingConference}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
}
