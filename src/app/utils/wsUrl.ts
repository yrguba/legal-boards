/** Суффикс пути должен совпадать с `path` в `WebSocketServer` backend (`/ws`). */
const WS_PATH = '/ws';

function wsProtocol(): 'ws:' | 'wss:' {
  if (typeof window === 'undefined') return 'ws:';
  return window.location.protocol === 'https:' ? 'wss:' : 'ws:';
}

/** Абсолютный WS URL с ровно одним суффиксом `/ws`. */
function buildWsUrl(host: string, pathPrefix = ''): string {
  const prefix = pathPrefix.replace(/\/+$/, '');
  const base = `${wsProtocol()}//${host}${prefix}`;
  if (base.toLowerCase().endsWith(WS_PATH)) {
    return base.replace(/\/+$/, '') || base;
  }
  return `${base}${WS_PATH}`;
}

function sameOriginWsUrl(): string {
  return buildWsUrl(window.location.host);
}

function normalizeExplicitWsUrl(raw: string): string {
  let value = raw.trim();
  if (!value) return sameOriginWsUrl();

  if (value.startsWith('/') && !value.startsWith('//')) {
    return buildWsUrl(window.location.host, value.replace(/\/ws\/?$/i, ''));
  }

  if (!/^wss?:\/\//i.test(value)) {
    if (value.startsWith('//')) {
      value = `${wsProtocol()}${value}`;
    } else if (/^https?:\/\//i.test(value)) {
      value = value.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
    } else {
      value = `${wsProtocol()}//${value.replace(/^\/+/, '')}`;
    }
  }

  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/\/+$/, '').replace(/(\/ws)+$/i, WS_PATH);
    if (!url.pathname.endsWith(WS_PATH)) {
      url.pathname = `${url.pathname}${WS_PATH}`;
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return sameOriginWsUrl();
  }
}

/** URL WebSocket: в dev — через Vite proxy `/ws`; в prod — backend origin. */
export function getWsUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL?.trim();
  if (explicit) {
    return normalizeExplicitWsUrl(explicit);
  }

  /** Dev: same-origin → Vite проксирует `/ws` на backend. */
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return sameOriginWsUrl();
  }

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5004/api';

  if (apiUrl.startsWith('/')) {
    const origin = import.meta.env.VITE_API_ORIGIN?.trim().replace(/\/$/, '');
    if (origin) {
      try {
        const httpUrl = new URL(origin);
        return buildWsUrl(httpUrl.host);
      } catch {
        return sameOriginWsUrl();
      }
    }
    if (typeof window !== 'undefined') {
      return sameOriginWsUrl();
    }
    return buildWsUrl('localhost:5004');
  }

  try {
    const httpUrl = new URL(apiUrl);
    return buildWsUrl(httpUrl.host);
  } catch {
    return buildWsUrl('localhost:5004');
  }
}
