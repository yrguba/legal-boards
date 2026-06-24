import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Briefcase } from 'lucide-react';
import { conferencesApi } from '../services/api';
import { ConferenceJoinFlow } from '../features/conferences/ConferenceJoinFlow';
import type { ConferencePublicInfo } from '../types';

export function ConferenceJoin() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [info, setInfo] = useState<ConferencePublicInfo | null>(null);
  const [joinUrl, setJoinUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shareToken) return;
    setJoinUrl(`${window.location.origin}/conferences/join/${shareToken}`);
    let cancelled = false;

    conferencesApi
      .getPublic(shareToken)
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Конференция недоступна');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-400 text-sm">
        Загрузка…
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="max-w-md w-full rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-red-700 text-sm mb-4">{error ?? 'Конференция не найдена'}</p>
          <Link to="/login" className="text-brand text-sm hover:underline">
            Войти в Legal Boards
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-slate-900">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-700 px-4 py-2">
        <Briefcase className="size-4 text-brand" />
        <span className="text-sm text-slate-300">Legal Boards — конференция</span>
        <Link to="/login" className="ml-auto text-xs text-slate-400 hover:text-white">
          Войти
        </Link>
      </div>
      <ConferenceJoinFlow
        info={info}
        defaultDisplayName=""
        requireName
        joinUrl={joinUrl}
        standalone
      />
    </div>
  );
}
