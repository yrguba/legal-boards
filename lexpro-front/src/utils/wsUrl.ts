/** Базовый URL WebSocket (тот же хост/протокол, что и REST без суффикса `/api`). */
export function getWsUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL?.trim();
  if (explicit) {
    const e = explicit;
    if (/^wss?:\/\//i.test(e)) return e;
    return e.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
  }

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5004/api';
  /**
   * Относительный `/api` на отдельном Vite-порту: WS на том же host — это dev-сервер, а не backend с WS.
   */
  if (apiUrl.startsWith('/')) {
    const origin = import.meta.env.VITE_API_ORIGIN?.trim().replace(/\/$/, '');
    if (origin) {
      return origin.replace(/^http/, 'ws');
    }
    if (import.meta.env.DEV) {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      return `${proto}://localhost:5004`;
    }
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.host}`;
  }
  const base = apiUrl.replace(/\/api\/?$/, '');
  return base.replace(/^http/, 'ws');
}
