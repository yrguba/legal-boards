const ENABLED_STORAGE_KEY = 'browser_notifications_enabled';
const SW_URL = '/sw-notifications.js';
const DEDUP_MS = 3000;

const recentTags = new Map<string, number>();
const liveNotifications = new Set<Notification>();

let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

export function isBrowserNotificationsSupported(): boolean {
  if (typeof Notification === 'undefined') return false;
  return window.isSecureContext || isLocalDevHost();
}

export function isBrowserNotificationsEnabled(): boolean {
  return localStorage.getItem(ENABLED_STORAGE_KEY) !== 'false';
}

export function setBrowserNotificationsEnabledStorage(enabled: boolean): void {
  localStorage.setItem(ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
}

export function getBrowserNotificationPermission(): NotificationPermission {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  const current = Notification.permission;
  if (current === 'granted' || current === 'denied') return current;
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    void registerNotificationServiceWorker();
  }
  return permission;
}

/** Регистрация SW для showNotification (на macOS Chrome надёжнее, чем window.Notification). */
export function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);

  if (!swRegistrationPromise) {
    swRegistrationPromise = (async () => {
      try {
        await navigator.serviceWorker.register(SW_URL, { scope: '/' });
        return await navigator.serviceWorker.ready;
      } catch (error) {
        console.warn('[browser-notifications] service worker register failed', error);
        swRegistrationPromise = null;
        return null;
      }
    })();
  }

  return swRegistrationPromise;
}

export function isChromeBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Chrome\//i.test(navigator.userAgent) && !/Edg\//i.test(navigator.userAgent);
}

export function getBrowserNotificationBlockReason(): string | null {
  if (typeof Notification === 'undefined') {
    return 'Браузер не поддерживает Notification API (попробуйте Chrome или Safari).';
  }
  if (!isBrowserNotificationsSupported()) {
    return 'Уведомления браузера недоступны на этом адресе. Нужен HTTPS или localhost.';
  }
  if (Notification.permission === 'denied') {
    return 'Уведомления заблокированы для этого сайта — разрешите в настройках браузера.';
  }
  if (Notification.permission !== 'granted') {
    return 'Сначала нажмите «Разрешить уведомления».';
  }
  if (!isBrowserNotificationsEnabled()) {
    return 'Включите переключатель «Показывать в браузере».';
  }
  return null;
}

export function shouldUseBrowserNotifications(): boolean {
  return getBrowserNotificationBlockReason() === null;
}

export type ShowBrowserNotificationOptions = {
  inAppHandledWhenVisible?: boolean;
  skipVisibilityCheck?: boolean;
  skipDedup?: boolean;
  requireInteraction?: boolean;
};

export type ShowBrowserNotificationResult =
  | { ok: true; via: 'service-worker' | 'window'; notification?: Notification }
  | { ok: false; reason: string };

function shouldShowForVisibility(options?: ShowBrowserNotificationOptions): boolean {
  if (options?.skipVisibilityCheck) return true;
  if (document.hidden) return true;
  return !options?.inAppHandledWhenVisible;
}

function shouldSkipDuplicate(tag: string | undefined, skipDedup?: boolean): boolean {
  if (skipDedup || !tag) return false;
  const now = Date.now();
  const prev = recentTags.get(tag);
  if (prev != null && now - prev < DEDUP_MS) return true;
  recentTags.set(tag, now);
  if (recentTags.size > 100) {
    for (const [key, ts] of recentTags) {
      if (now - ts > DEDUP_MS * 2) recentTags.delete(key);
    }
  }
  return false;
}

function trackNotification(notification: Notification): void {
  liveNotifications.add(notification);
  const release = () => {
    liveNotifications.delete(notification);
  };
  notification.addEventListener('close', release, { once: true });
  notification.addEventListener('error', release, { once: true });
}

function resolveTag(opts: { tag?: string }, options?: ShowBrowserNotificationOptions): string {
  if (options?.skipDedup) return `lb-${Date.now()}`;
  return opts.tag ?? `lb-${Date.now()}`;
}

async function showViaServiceWorker(
  opts: { title: string; body: string; tag?: string; route?: string },
  options?: ShowBrowserNotificationOptions,
): Promise<ShowBrowserNotificationResult | null> {
  if (!('serviceWorker' in navigator)) return null;

  const reg = await registerNotificationServiceWorker();
  if (!reg) return null;

  const tag = resolveTag(opts, options);
  await reg.showNotification(opts.title, {
    body: opts.body,
    tag,
    requireInteraction: options?.requireInteraction ?? false,
    silent: false,
    data: { route: opts.route ?? null },
  });

  return { ok: true, via: 'service-worker' };
}

function showViaWindow(
  opts: { title: string; body: string; tag?: string; route?: string },
  options?: ShowBrowserNotificationOptions,
): ShowBrowserNotificationResult {
  const notification = new Notification(opts.title, {
    body: opts.body,
    tag: resolveTag(opts, options),
    requireInteraction: options?.requireInteraction ?? false,
    silent: false,
  });

  trackNotification(notification);

  notification.onclick = () => {
    window.focus();
    notification.close();
    if (opts.route) {
      window.dispatchEvent(
        new CustomEvent('browser-notification-navigate', { detail: { route: opts.route } }),
      );
    }
  };

  return { ok: true, via: 'window', notification };
}

export async function showBrowserNotification(
  opts: {
    title: string;
    body: string;
    tag?: string;
    route?: string;
  },
  options?: ShowBrowserNotificationOptions,
): Promise<ShowBrowserNotificationResult> {
  const blockReason = getBrowserNotificationBlockReason();
  if (blockReason) return { ok: false, reason: blockReason };

  if (!shouldShowForVisibility(options)) {
    return { ok: false, reason: 'Уведомление скрыто: вкладка активна (для этого типа события).' };
  }

  if (shouldSkipDuplicate(opts.tag, options?.skipDedup)) {
    return { ok: false, reason: 'Такое уведомление уже показывалось несколько секунд назад.' };
  }

  try {
    const viaSw = await showViaServiceWorker(opts, options);
    if (viaSw?.ok) return viaSw;
    return showViaWindow(opts, options);
  } catch (error) {
    try {
      return showViaWindow(opts, options);
    } catch (fallbackError) {
      const message =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError ?? error);
      console.warn('[browser-notifications] failed to show', error, fallbackError);
      return { ok: false, reason: message || 'Браузер отклонил показ уведомления.' };
    }
  }
}

export function showTestBrowserNotification(): Promise<ShowBrowserNotificationResult> {
  if (typeof Notification === 'undefined') {
    return Promise.resolve({ ok: false, reason: 'Notification API недоступен в этом браузере.' });
  }

  const show = (): Promise<ShowBrowserNotificationResult> => {
    if (!isBrowserNotificationsEnabled()) {
      setBrowserNotificationsEnabledStorage(true);
    }
    return showBrowserNotification(
      {
        title: 'Legal Boards',
        body: 'Тестовое уведомление — всё работает.',
      },
      { skipVisibilityCheck: true, skipDedup: true, requireInteraction: true },
    );
  };

  if (Notification.permission === 'granted') {
    return registerNotificationServiceWorker().then(() => show());
  }

  if (Notification.permission === 'denied') {
    return Promise.resolve({
      ok: false,
      reason: 'Уведомления заблокированы для этого сайта — разрешите в настройках браузера.',
    });
  }

  return Notification.requestPermission().then((permission) => {
    if (permission === 'denied') {
      return {
        ok: false,
        reason: 'Уведомления заблокированы для этого сайта — разрешите в настройках браузера.',
      };
    }
    if (permission !== 'granted') {
      return { ok: false, reason: 'Разрешение не получено.' };
    }
    return registerNotificationServiceWorker().then(() => show());
  });
}

/** @deprecated use shouldUseBrowserNotifications */
export function canShowBrowserNotifications(): boolean {
  return shouldUseBrowserNotifications() && document.hidden;
}
