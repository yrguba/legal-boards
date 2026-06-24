import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useApp } from './AppContext';
import { getWsUrl } from '../utils/wsUrl';

type RealtimeHandler = (data: Record<string, unknown>) => void;

type RealtimeContextType = {
  subscribe: (handler: RealtimeHandler) => () => void;
};

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

const RECONNECT_MS = 4000;

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, currentUser } = useApp();
  const handlersRef = useRef(new Set<RealtimeHandler>());

  const subscribe = useCallback((handler: RealtimeHandler) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;

    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (cancelled) return;

      try {
        ws = new WebSocket(getWsUrl());
      } catch {
        reconnectTimer = window.setTimeout(connect, RECONNECT_MS);
        return;
      }

      ws.onopen = () => {
        if (import.meta.env.DEV) {
          console.info('[realtime] WebSocket connected:', getWsUrl());
        }
      };

      ws.onerror = () => {
        if (import.meta.env.DEV) {
          console.warn('[realtime] WebSocket error:', getWsUrl());
        }
      };

      ws.onclose = () => {
        ws = null;
        if (!cancelled) {
          reconnectTimer = window.setTimeout(connect, RECONNECT_MS);
        }
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data as string);
          if (!data || typeof data !== 'object') return;
          const record = data as Record<string, unknown>;
          for (const handler of handlersRef.current) {
            handler(record);
          }
        } catch {
          // ignore malformed payloads
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [isAuthenticated, currentUser?.id]);

  const value = useMemo(() => ({ subscribe }), [subscribe]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used within RealtimeProvider');
  return ctx;
}
