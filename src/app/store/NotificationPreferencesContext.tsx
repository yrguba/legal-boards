import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { notificationsApi } from '../services/api';
import { useApp } from './AppContext';
import {
  getBrowserNotificationPermission,
  isBrowserNotificationsEnabled,
  isBrowserNotificationsSupported,
  registerNotificationServiceWorker,
  requestBrowserNotificationPermission,
  setBrowserNotificationsEnabledStorage,
} from '../utils/browserNotifications';
import { resolveNotificationSettingKey } from '../utils/notificationSettingKeys';

export type NotificationSettingGroup = { id: string; label: string };

export type NotificationSettingItem = {
  key: string;
  label: string;
  description: string;
  group: string;
  defaultEnabled: boolean;
  enabled: boolean;
};

type NotificationPreferencesContextType = {
  groups: NotificationSettingGroup[];
  settings: NotificationSettingItem[];
  isLoading: boolean;
  isSaving: boolean;
  loadError: string | null;
  saveError: string | null;
  refresh: () => Promise<void>;
  updateSettings: (patch: Record<string, boolean>) => Promise<void>;
  isCategoryEnabled: (key: string) => boolean;
  isWsEventEnabled: (wsEventType: string, notificationType?: string) => boolean;
  browserNotificationsEnabled: boolean;
  setBrowserNotificationsEnabled: (enabled: boolean) => void;
  browserPermission: NotificationPermission;
  requestBrowserPermission: () => Promise<NotificationPermission>;
  browserNotificationsSupported: boolean;
};

const NotificationPreferencesContext = createContext<NotificationPreferencesContextType | undefined>(
  undefined,
);

export function NotificationPreferencesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useApp();
  const [groups, setGroups] = useState<NotificationSettingGroup[]>([]);
  const [settings, setSettings] = useState<NotificationSettingItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [browserNotificationsEnabled, setBrowserEnabledState] = useState(isBrowserNotificationsEnabled);
  const [browserPermission, setBrowserPermission] = useState(getBrowserNotificationPermission);

  const browserNotificationsSupported = isBrowserNotificationsSupported();

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await notificationsApi.getSettings();
      setGroups(data.groups);
      setSettings(data.settings);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить настройки');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const updateSettings = useCallback(async (patch: Record<string, boolean>) => {
    if (!isAuthenticated || Object.keys(patch).length === 0) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const data = await notificationsApi.updateSettings(patch);
      setGroups(data.groups);
      setSettings(data.settings);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Не удалось сохранить настройки');
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [isAuthenticated]);

  const isCategoryEnabled = useCallback(
    (key: string) => {
      const item = settings.find((s) => s.key === key);
      return item?.enabled ?? true;
    },
    [settings],
  );

  const isWsEventEnabled = useCallback(
    (wsEventType: string, notificationType?: string) => {
      const key = resolveNotificationSettingKey(wsEventType, notificationType);
      if (!key) return true;
      return isCategoryEnabled(key);
    },
    [isCategoryEnabled],
  );

  const setBrowserNotificationsEnabled = useCallback((enabled: boolean) => {
    setBrowserEnabledState(enabled);
    setBrowserNotificationsEnabledStorage(enabled);
  }, []);

  const requestBrowserPermission = useCallback(async () => {
    const permission = await requestBrowserNotificationPermission();
    setBrowserPermission(permission);
    if (permission === 'granted') {
      void registerNotificationServiceWorker();
    }
    return permission;
  }, []);

  useEffect(() => {
    if (getBrowserNotificationPermission() === 'granted') {
      void registerNotificationServiceWorker();
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setGroups([]);
      setSettings([]);
      setLoadError(null);
      setSaveError(null);
      return;
    }
    refresh();
  }, [isAuthenticated, refresh]);

  useEffect(() => {
    setBrowserPermission(getBrowserNotificationPermission());
  }, [browserNotificationsEnabled]);

  useEffect(() => {
    const syncPermission = () => setBrowserPermission(getBrowserNotificationPermission());
    document.addEventListener('visibilitychange', syncPermission);
    window.addEventListener('focus', syncPermission);
    window.addEventListener('pageshow', syncPermission);
    return () => {
      document.removeEventListener('visibilitychange', syncPermission);
      window.removeEventListener('focus', syncPermission);
      window.removeEventListener('pageshow', syncPermission);
    };
  }, []);

  const value = useMemo(
    () => ({
      groups,
      settings,
      isLoading,
      isSaving,
      loadError,
      saveError,
      refresh,
      updateSettings,
      isCategoryEnabled,
      isWsEventEnabled,
      browserNotificationsEnabled,
      setBrowserNotificationsEnabled,
      browserPermission,
      requestBrowserPermission,
      browserNotificationsSupported,
    }),
    [
      groups,
      settings,
      isLoading,
      isSaving,
      loadError,
      saveError,
      refresh,
      updateSettings,
      isCategoryEnabled,
      isWsEventEnabled,
      browserNotificationsEnabled,
      setBrowserNotificationsEnabled,
      browserPermission,
      requestBrowserPermission,
      browserNotificationsSupported,
    ],
  );

  return (
    <NotificationPreferencesContext.Provider value={value}>
      {children}
    </NotificationPreferencesContext.Provider>
  );
}

export function useNotificationPreferences() {
  const ctx = useContext(NotificationPreferencesContext);
  if (!ctx) {
    throw new Error('useNotificationPreferences must be used within NotificationPreferencesProvider');
  }
  return ctx;
}
