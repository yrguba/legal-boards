/** Суффикс пути должен совпадать с `path` в `WebSocketServer` backend (`/ws`). */
const WS_PATH_SUFFIX = '/ws';

function ensureWsPath(wsBaseUrl: string): string {
  const s = wsBaseUrl.trim().replace(/\/$/, '');
  if (s.toLowerCase().endsWith('/ws')) return s;
  return `${s}${WS_PATH_SUFFIX}`;
}

/** URL WebSocket: тот же хост/порт, что и REST без `/api`, плюс путь `/ws`. */
export function getWsUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL?.trim();
  if (explicit) {
    const e = explicit;
    const raw = /^wss?:\/\//i.test(e)
      ? e
      : e.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
    return ensureWsPath(raw);
  }

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5004/api';
  /**
   * Относительный `/api` на отдельном Vite-порту: WS на том же host — это dev-сервер (5175 и т.д.),
   * а не Express с ws://. Нужен origin API или явный VITE_WS_URL.
   */
  if (apiUrl.startsWith('/')) {
    const origin = import.meta.env.VITE_API_ORIGIN?.trim().replace(/\/$/, '');
    if (origin) {
      return ensureWsPath(origin.replace(/^http/, 'ws'));
    }
    if (import.meta.env.DEV) {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      return ensureWsPath(`${proto}://localhost:5004`);
    }
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return ensureWsPath(`${proto}://${window.location.host}`);
  }
  const base = apiUrl.replace(/\/api\/?$/, '');
  const raw = base.replace(/^http/, 'ws');
  return ensureWsPath(raw);
}
