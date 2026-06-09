import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Video, Plus, ExternalLink, CalendarPlus } from 'lucide-react';
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
            onClick={() => setScheduleOpen(true)}
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
            {rows.map((c) => (
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
                <button
                  type="button"
                  onClick={() => navigate(`/conferences/${c.id}`)}
                  className="text-sm text-brand hover:underline"
                >
                  Войти
                </button>
                <a
                  href={c.joinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-brand"
                >
                  <ExternalLink className="size-3.5" />
                  Ссылка для гостей
                </a>
              </li>
            ))}
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
          onClose={() => setScheduleOpen(false)}
          workspaceId={currentWorkspace.id}
          members={members}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
}
