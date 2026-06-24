import { useEffect } from 'react';
import { useNavigate } from 'react-router';

/** Навигация по клику на системное уведомление (внутри Router). */
export function BrowserNotificationNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ route?: string }>).detail;
      if (detail?.route) navigate(detail.route);
    };
    window.addEventListener('browser-notification-navigate', handler);
    return () => window.removeEventListener('browser-notification-navigate', handler);
  }, [navigate]);

  return null;
}
