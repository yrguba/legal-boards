import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bell, Monitor } from 'lucide-react';
import { BrowserNotificationTroubleshooting } from './BrowserNotificationTroubleshooting';
import { useNotificationPreferences } from '../store/NotificationPreferencesContext';
import {
  showTestBrowserNotification,
  getBrowserNotificationPermission,
} from '../utils/browserNotifications';

function permissionLabel(permission: NotificationPermission): string {
  if (permission === 'granted') return 'Разрешены';
  if (permission === 'denied') return 'Заблокированы';
  return 'Не запрошены';
}

function permissionBadgeClass(permission: NotificationPermission): string {
  if (permission === 'granted') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (permission === 'denied') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

export function NotificationSettingsPanel() {
  const {
    groups,
    settings,
    isLoading,
    isSaving,
    loadError,
    saveError,
    updateSettings,
    browserNotificationsEnabled,
    setBrowserNotificationsEnabled,
    browserPermission,
    requestBrowserPermission,
    browserNotificationsSupported,
  } = useNotificationPreferences();

  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const item of settings) {
      next[item.key] = item.enabled;
    }
    setDraft(next);
  }, [settings]);

  const dirtyKeys = useMemo(() => {
    const keys: string[] = [];
    for (const item of settings) {
      if (draft[item.key] !== item.enabled) keys.push(item.key);
    }
    return keys;
  }, [draft, settings]);

  const groupedSettings = useMemo(() => {
    return groups.map((group) => ({
      ...group,
      items: settings.filter((s) => s.group === group.id),
    }));
  }, [groups, settings]);

  const handleToggle = (key: string, enabled: boolean) => {
    setDraft((prev) => ({ ...prev, [key]: enabled }));
    setSavedMessage(null);
    setLocalError(null);
    setShowTroubleshooting(false);
  };

  const handleSave = async () => {
    if (dirtyKeys.length === 0) return;
    setLocalError(null);
    setSavedMessage(null);
    setShowTroubleshooting(false);

    const patch: Record<string, boolean> = {};
    for (const key of dirtyKeys) {
      patch[key] = draft[key];
    }

    try {
      await updateSettings(patch);
      setSavedMessage('Настройки сохранены');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Не удалось сохранить');
    }
  };

  const handleRequestPermission = () => {
    setLocalError(null);
    setShowTroubleshooting(false);
    void requestBrowserPermission().then((permission) => {
      if (permission === 'granted') {
        setBrowserNotificationsEnabled(true);
      } else if (permission === 'denied') {
        setLocalError('Браузер заблокировал уведомления для этого сайта.');
        setShowTroubleshooting(true);
      }
    });
  };

  const handleTestNotification = () => {
    setLocalError(null);
    setSavedMessage(null);
    setShowTroubleshooting(false);

    void showTestBrowserNotification().then((result) => {
      void requestBrowserPermission();
      if (getBrowserNotificationPermission() === 'granted') {
        setBrowserNotificationsEnabled(true);
      }

      if (!result.ok) {
        setLocalError(result.reason);
        setShowTroubleshooting(true);
        return;
      }

      if (result.via === 'window' && result.notification) {
        result.notification.onerror = () => {
          setLocalError('Браузер не смог показать уведомление.');
          setShowTroubleshooting(true);
          setSavedMessage(null);
        };
      }

      setSavedMessage('Тестовое уведомление отправлено.');
    });
  };

  const needsTroubleshooting =
    showTroubleshooting ||
    browserPermission === 'denied' ||
    !browserNotificationsSupported;

  if (isLoading && settings.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <p className="text-sm text-slate-600">Загрузка настроек…</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Уведомления</h2>
      <p className="text-sm text-slate-600 mb-6">
        Выберите, о каких событиях получать уведомления в приложении, на телефоне и в браузере.
      </p>

      {(loadError || saveError || localError) && (
        <div className="mb-4 flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{loadError || saveError || localError}</span>
        </div>
      )}

      {savedMessage && (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {savedMessage}
        </div>
      )}

      <div className="mb-8 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Monitor className="h-5 w-5 text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-900">Уведомления браузера</h3>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          Показываются, когда вкладка в фоне. При активной вкладке — всплывающие уведомления в
          приложении.
        </p>

        {!browserNotificationsSupported ? (
          <p className="text-sm text-slate-500 mb-3">
            Недоступны на этом адресе. Нужен HTTPS или localhost.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-900">Разрешение браузера</div>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${permissionBadgeClass(browserPermission)}`}
                  >
                    {permissionLabel(browserPermission)}
                  </span>
                </div>
              </div>
              {browserPermission !== 'granted' && (
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Разрешить уведомления
                </button>
              )}
            </div>

            <label className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3">
              <div>
                <div className="text-sm font-medium text-slate-900">Показывать в браузере</div>
                <div className="text-xs text-slate-500 mt-0.5">На этом устройстве</div>
              </div>
              <input
                type="checkbox"
                checked={browserNotificationsEnabled}
                onChange={(e) => setBrowserNotificationsEnabled(e.target.checked)}
                disabled={browserPermission !== 'granted'}
                className="h-4 w-4 text-brand disabled:opacity-40"
              />
            </label>

            {browserNotificationsSupported && (
              <div className="border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={handleTestNotification}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Проверить уведомление
                </button>
              </div>
            )}
          </div>
        )}

        {needsTroubleshooting && (
          <div className="mt-3">
            <BrowserNotificationTroubleshooting />
          </div>
        )}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Bell className="h-5 w-5 text-slate-600" />
        <h3 className="text-sm font-semibold text-slate-900">Категории событий</h3>
      </div>

      <div className="space-y-6">
        {groupedSettings.map((group) =>
          group.items.length === 0 ? null : (
            <section key={group.id}>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {group.label}
              </h4>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between gap-4 rounded border border-transparent py-3 hover:border-slate-100"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900">{item.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={draft[item.key] ?? item.enabled}
                      onChange={(e) => handleToggle(item.key, e.target.checked)}
                      className="h-4 w-4 flex-shrink-0 text-brand"
                    />
                  </label>
                ))}
              </div>
            </section>
          ),
        )}
      </div>

      <div className="pt-6 mt-6 border-t border-slate-200 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={dirtyKeys.length === 0 || isSaving}
          className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Сохранение…' : 'Сохранить настройки'}
        </button>
        {dirtyKeys.length > 0 && !isSaving && (
          <span className="text-xs text-slate-500">Есть несохранённые изменения</span>
        )}
      </div>
    </div>
  );
}
