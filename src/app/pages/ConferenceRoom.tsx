import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useNavigate, useParams } from 'react-router';
import { useApp } from '../store/AppContext';
import { conferencesApi } from '../services/api';
import { ConferenceJoinFlow } from '../features/conferences/ConferenceJoinFlow';
import type { Conference, ConferencePublicInfo } from '../types';

export function ConferenceRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [conference, setConference] = useState<Conference | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    conferencesApi
      .getById(id)
      .then((data) => {
        if (!cancelled) setConference(data as Conference);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Не удалось загрузить');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return <p className="p-8 text-sm text-slate-500">Загрузка конференции…</p>;
  }

  if (error || !conference) {
    return (
      <div className="p-8">
        <p className="text-red-700 text-sm">{error ?? 'Конференция не найдена'}</p>
      </div>
    );
  }

  const info: ConferencePublicInfo = {
    title: conference.title,
    roomName: conference.roomName,
    jitsiDomain: conference.jitsiDomain,
    status: conference.status,
  };

  const canEnd = currentUser?.id === conference.createdById || currentUser?.role === 'admin';

  if (conference.canJoin === false) {
    return (
      <div className="p-8 max-w-lg mx-auto">
        <h1 className="text-xl font-semibold text-slate-900 mb-2">{conference.title}</h1>
        <p className="text-sm text-slate-600 mb-4">
          {conference.mode === 'scheduled' ? (
            <>
              Запланировано на{' '}
              {format(new Date(conference.startAt), 'd MMMM yyyy, HH:mm', { locale: ru })}
              {conference.endAt
                ? ` — ${format(new Date(conference.endAt), 'HH:mm', { locale: ru })}`
                : ''}
              . Вход откроется за 15 минут до начала.
            </>
          ) : (
            'Конференция сейчас недоступна для входа.'
          )}
        </p>
        <button
          type="button"
          onClick={() => navigate('/conferences')}
          className="text-sm text-brand hover:underline"
        >
          ← К списку конференций
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col">
    <ConferenceJoinFlow
      info={info}
      defaultDisplayName={currentUser?.name ?? ''}
      requireName={false}
      conferenceId={conference.id}
      joinUrl={conference.joinUrl}
      onShareChat={async () => {
        const r = await conferencesApi.shareToChat(conference.id);
        window.alert(r.message);
      }}
      canEnd={canEnd}
      onEnd={async () => {
        await conferencesApi.end(conference.id);
        navigate('/conferences');
      }}
      onMeetingLeft={async () => {
        if (canEnd && conference.status !== 'ended') {
          try {
            await conferencesApi.end(conference.id);
          } catch {
            /* уже завершена */
          }
        }
        navigate('/conferences');
      }}
    />
    </div>
  );
}
