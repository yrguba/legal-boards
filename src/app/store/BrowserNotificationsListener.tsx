import { useEffect, useRef } from 'react';
import { useApp } from './AppContext';
import { useNotificationPreferences } from './NotificationPreferencesContext';
import { useRealtime } from './RealtimeContext';
import { resolveBrowserNotificationFromWs } from '../notifications/browserNotificationRouter';
import { showBrowserNotification, shouldUseBrowserNotifications } from '../utils/browserNotifications';

/** Глобальный слушатель WS → системные уведомления (не привязан к Layout). */
export function BrowserNotificationsListener() {
  const { currentUser, currentWorkspace } = useApp();
  const { isWsEventEnabled } = useNotificationPreferences();
  const { subscribe } = useRealtime();
  const isWsEventEnabledRef = useRef(isWsEventEnabled);
  const workspaceIdRef = useRef(currentWorkspace?.id);

  useEffect(() => {
    isWsEventEnabledRef.current = isWsEventEnabled;
  }, [isWsEventEnabled]);

  useEffect(() => {
    workspaceIdRef.current = currentWorkspace?.id;
  }, [currentWorkspace?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;

    return subscribe((data) => {
      if (!shouldUseBrowserNotifications()) return;

      const eventType = typeof data.type === 'string' ? data.type : '';
      const notificationType =
        eventType === 'notification' && data.notification && typeof data.notification === 'object'
          ? String((data.notification as Record<string, unknown>).type ?? '')
          : undefined;

      if (!isWsEventEnabledRef.current(eventType, notificationType || undefined)) return;

      const payload = resolveBrowserNotificationFromWs(data, {
        currentUserId: currentUser.id,
        currentWorkspaceId: workspaceIdRef.current,
        currentPathname: window.location.pathname,
      });
      if (!payload) return;

      void showBrowserNotification(payload, {
        inAppHandledWhenVisible: eventType === 'notification',
      }).then((result) => {
        if (!result.ok && import.meta.env.DEV) {
          console.debug('[browser-notifications] skipped:', result.reason, data.type);
        }
      });
    });
  }, [currentUser?.id, subscribe]);

  return null;
}
