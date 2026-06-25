import { FORMS_API_ORIGIN } from './formsMicroApp.config';

/** Ключи localStorage, которые использует headless-forms-app (из их bundle). */
const FORMS_ACCESS_TOKEN_KEY = 'accessToken';

/** LF session token из URL (?access_token=.eJx…), не JWT. */
export function extractAccessTokenFromFormsRaw(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      return new URL(trimmed).searchParams.get('access_token');
    }
    const q = trimmed.indexOf('?');
    if (q >= 0) {
      return new URLSearchParams(trimmed.slice(q + 1)).get('access_token');
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Путь LF без query/hash — token передаётся отдельно (localStorage / props). */
export function stripFormsEmbeddedQuery(path: string): string {
  const withoutQuery = path.split('?')[0]?.split('#')[0] ?? path;
  return withoutQuery.replace(/\/+$/, '') || '/';
}

export function persistFormsAccessToken(token: string): string {
  localStorage.setItem(FORMS_ACCESS_TOKEN_KEY, token);
  return token;
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

/** Пробрасываем LF-token из query; не подменяем JWT Legal Boards. */
export function syncAuthTokenForFormsApp(search = ''): string | null {
  const fromQuery = applyFormsAccessTokenFromSearch(search);
  if (fromQuery) return fromQuery;

  return localStorage.getItem(FORMS_ACCESS_TOKEN_KEY);
}

export function buildFormsMicroAppProps(_search = '', formsPath?: string) {
  const accessToken = localStorage.getItem(FORMS_ACCESS_TOKEN_KEY);
  const routePath = formsPath ? stripFormsEmbeddedQuery(formsPath) : undefined;
  return {
    embedded: true,
    basename: '/forms',
    accessToken,
    token: accessToken,
    pathname: routePath,
    path: routePath,
    route: routePath,
    /** Абсолютный origin LF; относительные `api/…` в prod идут на хост — нужен nginx/proxy. */
    apiBaseUrl: `${FORMS_API_ORIGIN}/`,
    apiOrigin: FORMS_API_ORIGIN,
  };
}

export function countFormsMountNodes(): number {
  const root = document.getElementById('legal-forms');
  if (!root) return 0;
  return root.querySelectorAll('*').length;
}
