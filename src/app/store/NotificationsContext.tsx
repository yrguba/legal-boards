import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Notification } from '../types';
import { notificationsApi } from '../services/api';
import { useApp } from './AppContext';

type Toast = { id: string; title: string; message: string };

interface NotificationsContextType {
  items: Notification[];
  unreadCount: number;
  isLoading: boolean;
  toast: Toast | null;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, currentUser } = useApp();
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const [list, unread] = await Promise.all([notificationsApi.getAll(), notificationsApi.getUnreadCount()]);
      setItems(list);
      setUnreadCount(unread.count);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const markAsRead = useCallback(async (id: string) => {
    await notificationsApi.markAsRead(id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    await notificationsApi.markAllAsRead();
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;

    const apiUrl: string = import.meta.env.VITE_API_URL || 'http://localhost:5004/api';
    let wsUrl: string;
    if (apiUrl.startsWith('/')) {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      wsUrl = `${proto}://${window.location.host}`;
    } else {
      const base = apiUrl.replace(/\/api\/?$/, '');
      wsUrl = base.replace(/^http/, 'ws');
    }

    const ws = new WebSocket(wsUrl);
    ws.onerror = () => {
      // keep silent in UI, but useful for debugging
      console.warn('WebSocket error (notifications)', wsUrl);
    };
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.type !== 'notification' || data?.userId !== currentUser.id || !data?.notification) return;
        const n = data.notification as Notification;

        setItems((prev) => {
          if (prev.some((x) => x.id === n.id)) return prev;
          return [n, ...prev].slice(0, 50);
        });
        setUnreadCount((c) => c + 1);

        setToast({ id: n.id, title: n.title, message: n.message });
        if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = window.setTimeout(() => setToast(null), 3500);
      } catch {
        // ignore
      }
    };

    return () => {
      ws.close();
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    };
  }, [currentUser?.id, isAuthenticated]);

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      isLoading,
      toast,
      refresh,
      markAsRead,
      markAllAsRead,
    }),
    [items, unreadCount, isLoading, toast, refresh, markAsRead, markAllAsRead]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}

