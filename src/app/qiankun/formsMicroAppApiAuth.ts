import { isLegalFormsApiPath } from './formsMicroApp.constants';

const FORMS_ACCESS_TOKEN_KEY = 'accessToken';
const PATCH_FLAG = '__formsApiFetchPatched';

/** LF session token из URL (?access_token=.eJx…), не JWT. */
export function isLegalFormsFlaskSessionToken(token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('eyJ')) return false;
  return trimmed.startsWith('.');
}

function readFormsAccessToken(): string | null {
  return localStorage.getItem(FORMS_ACCESS_TOKEN_KEY);
}

function resolveRequestUrl(input: RequestInfo | URL): URL | null {
  try {
    if (typeof input === 'string') return new URL(input, window.location.origin);
    if (input instanceof URL) return input;
    return new URL(input.url, window.location.origin);
  } catch {
    return null;
  }
}

function applyLegalFormsAuth(
  headers: Headers,
  parsed: URL,
  token: string,
): void {
  if (isLegalFormsFlaskSessionToken(token)) {
    // LF API: Bearer с .eJx… → «Malformed token» (JWT decoder). Только query, как на standalone.
    headers.delete('Authorization');
    parsed.searchParams.set('access_token', token);
    return;
  }

  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
}

/** LF API auth для прокси через localhost (Flask session → query param). */
export function installFormsApiAuthFetch(): void {
  const win = window as Window & { [PATCH_FLAG]?: boolean };
  if (win[PATCH_FLAG]) return;
  win[PATCH_FLAG] = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const parsed = resolveRequestUrl(input);
    if (!parsed || !isLegalFormsApiPath(parsed.pathname)) {
      return nativeFetch(input, init);
    }

    const token = readFormsAccessToken();
    if (!token) {
      return nativeFetch(input, init);
    }

    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    applyLegalFormsAuth(headers, parsed, token);

    const nextInit: RequestInit = { ...init, headers };
    const nextUrl = `${parsed.pathname}${parsed.search}${parsed.hash}`;

    if (typeof input === 'string' || input instanceof URL) {
      return nativeFetch(nextUrl, nextInit);
    }

    return nativeFetch(
      new Request(nextUrl, {
        method: input.method,
        headers,
        body: init?.body ?? input.body,
        mode: init?.mode ?? input.mode,
        credentials: init?.credentials ?? input.credentials,
        cache: init?.cache ?? input.cache,
        redirect: init?.redirect ?? input.redirect,
        referrer: init?.referrer ?? input.referrer,
        integrity: init?.integrity ?? input.integrity,
        signal: init?.signal ?? input.signal,
      }),
    );
  };
}

export function hasFormsAccessToken(): boolean {
  return Boolean(readFormsAccessToken());
}
