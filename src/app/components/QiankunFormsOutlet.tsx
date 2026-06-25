import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { Loader2 } from 'lucide-react';
import { countFormsMountNodes, syncAuthTokenForFormsApp } from '../qiankun/formsMicroAppBridge';
import { hasFormsAccessToken } from '../qiankun/formsMicroAppApiAuth';

type Phase = 'booting' | 'waiting-container' | 'ready' | 'error';

export function QiankunFormsOutlet() {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<Phase>('booting');
  const [error, setError] = useState<string | null>(null);
  const [containerReady, setContainerReady] = useState(false);
  const [microAppMounted, setMicroAppMounted] = useState(false);
  const [domNodeCount, setDomNodeCount] = useState(0);

  const setContainerNode = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    setContainerReady(node != null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void import('../qiankun/startFormsMicroApp').then(({ onFormsMicroAppMount }) => {
      if (cancelled) return;
      return onFormsMicroAppMount((mounted) => {
        setMicroAppMounted(mounted);
        if (mounted) {
          window.setTimeout(() => setDomNodeCount(countFormsMountNodes()), 100);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        setPhase('booting');
        syncAuthTokenForFormsApp(location.search);
        const { initFormsQiankunHost } = await import('../qiankun/startFormsMicroApp');
        if (cancelled) return;
        await initFormsQiankunHost(location.search);
        setPhase('waiting-container');
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Ошибка инициализации qiankun');
          setPhase('error');
        }
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    syncAuthTokenForFormsApp(location.search);
    syncAuthTokenForFormsApp(location.search);
    if (phase !== 'ready') return;

    void import('../qiankun/startFormsMicroApp').then(({ rerouteFormsMicroApp }) => {
      rerouteFormsMicroApp();
    });
  }, [location.pathname, location.search, phase]);

  useEffect(() => {
    if (phase !== 'waiting-container' || !containerReady || !containerRef.current) return;

    let cancelled = false;

    const activate = async () => {
      try {
        const { rerouteFormsMicroApp } = await import('../qiankun/startFormsMicroApp');
        if (cancelled) return;
        rerouteFormsMicroApp();
        setPhase('ready');
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Ошибка активации микрофронта');
          setPhase('error');
        }
      }
    };

    void activate();
    return () => {
      cancelled = true;
    };
  }, [phase, containerReady]);

  useEffect(() => {
    if (!microAppMounted) return;
    const id = window.setInterval(() => setDomNodeCount(countFormsMountNodes()), 500);
    return () => window.clearInterval(id);
  }, [microAppMounted]);

  const showSpinner = phase === 'booting' || phase === 'waiting-container';
  const hasVisibleDom = domNodeCount > 5;
  const hasLfToken = hasFormsAccessToken();

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {import.meta.env.DEV ? (
        <div className="shrink-0 border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs text-slate-700">
          <div>
            qiankun: {microAppMounted ? 'mounted' : phase} · DOM nodes: {domNodeCount}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {!hasLfToken ? (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
          <p className="font-medium">Нужен LF access_token</p>
          <p className="mt-1">
            Откройте формы с параметром{' '}
            <span className="font-mono">?access_token=…</span> из URL legal-forms.ru (JWT Legal
            Boards не подходит).
          </p>
        </div>
      ) : null}

      {microAppMounted && !hasVisibleDom ? (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Микрофронт форм подключён, но UI пустой</p>
          <p className="mt-1 text-amber-900/90">
            Проверьте <span className="font-mono">access_token</span> (LF-token в query или{' '}
            <span className="font-mono">localStorage.accessToken</span>) и путь:
          </p>
          <p className="mt-1 break-all font-mono text-xs">{location.pathname}</p>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        {showSpinner ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90">
            <Loader2 className="size-8 animate-spin text-brand" />
          </div>
        ) : null}
        <div id="legal-forms" ref={setContainerNode} className="h-full min-h-[520px] w-full" />
      </div>
    </div>
  );
}
