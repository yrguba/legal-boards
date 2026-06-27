import { stripFormsEmbeddedQuery } from './formsMicroAppBridge';
import { toHostRoutePath } from './formsMicroAppPaths';

type SavedBrowserUrl = {
  pathname: string;
  search: string;
  hash: string;
};

/** Сохранённый URL host до embed-модалки LF. */
let savedBrowserUrl: SavedBrowserUrl | null = null;
let embedUrlDepth = 0;

/**
 * forms-app preload_helper читает location.pathname при загрузке entry.
 * Для модалки подменяем URL через replaceState (без popstate — React Router не уходит с доски).
 */
export function pushFormsEmbedBrowserUrl(formsPath: string, search = ''): void {
  if (typeof window === 'undefined') return;

  const hostPath = toHostRoutePath(stripFormsEmbeddedQuery(formsPath));
  const nextSearch = search || window.location.search;
  const nextUrl = `${hostPath}${nextSearch}${window.location.hash}`;

  if (embedUrlDepth === 0) {
    savedBrowserUrl = {
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
    };
    window.history.replaceState(window.history.state, '', nextUrl);
  }
  embedUrlDepth += 1;
}

export function popFormsEmbedBrowserUrl(): void {
  if (typeof window === 'undefined') return;
  if (embedUrlDepth <= 0) return;

  embedUrlDepth -= 1;
  if (embedUrlDepth > 0 || !savedBrowserUrl) return;

  const { pathname, search, hash } = savedBrowserUrl;
  savedBrowserUrl = null;
  window.history.replaceState(window.history.state, '', `${pathname}${search}${hash}`);
}
