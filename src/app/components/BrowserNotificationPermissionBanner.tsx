import { useState } from 'react';
import { Link } from 'react-router';
import { Bell, X } from 'lucide-react';
import { useNotificationPreferences } from '../store/NotificationPreferencesContext';

const DISMISS_KEY = 'browser_notif_banner_dismissed';

export function BrowserNotificationPermissionBanner() {
  const {
    browserNotificationsSupported,
    browserPermission,
    requestBrowserPermission,
    setBrowserNotificationsEnabled,
  } = useNotificationPreferences();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  const [isRequesting, setIsRequesting] = useState(false);

  if (!browserNotificationsSupported || dismissed || browserPermission !== 'default') {
    return null;
  }

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const handleEnable = () => {
    setIsRequesting(true);
    void requestBrowserPermission()
      .then((permission) => {
        if (permission === 'granted') {
          setBrowserNotificationsEnabled(true);
          dismiss();
        }
      })
      .finally(() => {
        setIsRequesting(false);
      });
  };

  return (
    <div className="border-b border-brand/20 bg-brand-light/60 px-4 py-2.5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Bell className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" />
          <p className="text-sm text-slate-700">
            Включите уведомления браузера, чтобы получать события, когда вкладка Legal Boards в
            фоне. Категории настраиваются в{' '}
            <Link to="/settings" className="font-medium text-brand hover:underline">
              Настройки → Уведомления
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleEnable}
            disabled={isRequesting}
            className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {isRequesting ? 'Запрос…' : 'Включить'}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded p-1.5 text-slate-500 hover:bg-white/70 hover:text-slate-700"
            title="Скрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
