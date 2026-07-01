import { FORMS_HOST_ACTIVE_RULE, FORMS_SUBAPP_BASENAME, FORMS_API_ORIGIN } from './formsMicroApp.config';
import { toHostRoutePath } from './formsMicroAppPaths';
import { getFormsMicroAppHostCallbacks } from './formsMicroAppHostBridge';

/** Ключи localStorage, которые использует docstream bundle. */
const FORMS_ACCESS_TOKEN_KEY = 'accessToken';
const FORMS_MOUNT_ROOT_ID = 'legal-forms';

/** LF session token из URL (?access_token=.eJx…), не JWT. */
export function normalizeFormsAccessToken(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let value = raw.trim();
  if (!value) return null;

  if (value.includes('access_token=')) {
    try {
      if (/^https?:\/\//i.test(value)) {
        const fromUrl = new URL(value).searchParams.get('access_token');
        if (fromUrl) value = fromUrl;
      } else {
        const q = value.indexOf('?');
        const query = q >= 0 ? value.slice(q + 1) : value;
        const fromQuery = new URLSearchParams(query).get('access_token');
        if (fromQuery) value = fromQuery;
      }
    } catch {
      /* keep value */
    }
  }

  const q = value.indexOf('?');
  if (q >= 0) value = value.slice(0, q);
  const h = value.indexOf('#');
  if (h >= 0) value = value.slice(0, h);

  value = value.trim();
  return value || null;
}

export function extractAccessTokenFromFormsRaw(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      return normalizeFormsAccessToken(new URL(trimmed).searchParams.get('access_token'));
    }
    const q = trimmed.indexOf('?');
    if (q >= 0) {
      return normalizeFormsAccessToken(
        new URLSearchParams(trimmed.slice(q + 1)).get('access_token'),
      );
    }
  } catch {
    /* ignore */
  }
  return normalizeFormsAccessToken(trimmed);
}

/** Путь LF без query/hash — token передаётся отдельно (localStorage / props). */
export function stripFormsEmbeddedQuery(path: string): string {
  const withoutQuery = path.split('?')[0]?.split('#')[0] ?? path;
  return withoutQuery.replace(/\/+$/, '') || '/';
}

export function persistFormsAccessToken(token: string): string {
  const clean = normalizeFormsAccessToken(token) ?? token.trim();
  localStorage.setItem(FORMS_ACCESS_TOKEN_KEY, clean);
  return clean;
}

/** LF передаёт Flask-session token в query (?access_token=…). */
export function applyFormsAccessTokenFromSearch(search: string): string | null {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const fromQuery = new URLSearchParams(raw).get('access_token');
  if (fromQuery) {
    return persistFormsAccessToken(fromQuery);
  }
  return null;
}

/** Читает LF access_token из localStorage (без «склеенных» ?access_token=…). */
export function readFormsAccessTokenFromStorage(): string | null {
  return normalizeFormsAccessToken(localStorage.getItem(FORMS_ACCESS_TOKEN_KEY));
}

/** Пробрасываем LF-token из query; не подменяем JWT Legal Boards. */
export function syncAuthTokenForFormsApp(search = ''): string | null {
  const fromQuery = applyFormsAccessTokenFromSearch(search);
  if (fromQuery) return fromQuery;

  return readFormsAccessTokenFromStorage();
}

export function buildFormsMicroAppProps(_search = '', formsPath?: string) {
  const accessToken = readFormsAccessTokenFromStorage();
  const hostPath = formsPath ? toHostRoutePath(stripFormsEmbeddedQuery(formsPath)) : undefined;
  const routePath = hostPath;
  const apiBaseUrl =
    import.meta.env.DEV && !import.meta.env.VITE_FORMS_API_ORIGIN?.trim()
      ? `${window.location.origin}/`
      : `${FORMS_API_ORIGIN}/`;
  return {
    embedded: true,
    basename: FORMS_SUBAPP_BASENAME,
    accessToken,
    token: accessToken,
    pathname: routePath,
    path: routePath,
    route: routePath,
    /** В dev — same-origin + Vite proxy на LF API; в prod — legal-forms.ru (или nginx proxy). */
    apiBaseUrl,
    apiOrigin: import.meta.env.VITE_FORMS_API_ORIGIN?.replace(/\/$/, '') ?? FORMS_API_ORIGIN,
    setGlobalForm: getFormsMicroAppHostCallbacks().setGlobalForm,
    saveForm: getFormsMicroAppHostCallbacks().saveForm,
  };
}

export function countFormsMountNodes(): number {
  const root = document.getElementById(FORMS_MOUNT_ROOT_ID);
  if (!root) return 0;
  return root.querySelectorAll('*').length;
}
