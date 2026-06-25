import { FORMS_MICRO_APP_CONTAINER, FORMS_MICRO_APP_ENTRY } from './formsMicroApp.config';
import {
  persistFormsAccessToken,
  stripFormsEmbeddedQuery,
  syncAuthTokenForFormsApp,
} from './formsMicroAppBridge';
import {
  initFormsQiankunHost,
  rerouteFormsMicroAppWithoutHostNavigation,
  setFormsModalEmbedActive,
  updateSharedFormsProps,
  waitForFormsMicroAppMount,
  waitForFormsMicroAppUnmount,
} from './startFormsMicroApp';

let mountGeneration = 0;
let mountChain: Promise<void> = Promise.resolve();

let savedHostBrowserLocation: { pathname: string; search: string; hash: string } | null = null;

/** LF (Umi) читает window.location — без /forms/… нет запросов /api/flow/…. */
function syncFormsBrowserLocationForModal(routePath: string) {
  if (typeof window === 'undefined') return;
  savedHostBrowserLocation = {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  };
  window.history.replaceState(window.history.state, '', routePath);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function restoreHostBrowserLocationAfterModal() {
  if (typeof window === 'undefined' || !savedHostBrowserLocation) return;
  const { pathname, search, hash } = savedHostBrowserLocation;
  savedHostBrowserLocation = null;
  window.history.replaceState(window.history.state, '', `${pathname}${search}${hash}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function ensureFormsMountContainer(container: HTMLElement) {
  const id = FORMS_MICRO_APP_CONTAINER.replace(/^#/, '');
  if (container.id !== id) container.id = id;
}

function applyFormsAccessToken(accessToken: string | null) {
  if (accessToken?.trim()) {
    persistFormsAccessToken(accessToken.trim());
    return;
  }
  syncAuthTokenForFormsApp('');
}

/**
 * Модалка: registerMicroApps + formsModalEmbedActive + sync URL на /forms/… для Umi.
 * Модалка рендерится в ColumnTransitionProvider (вне страницы доски), поэтому RR может
 * перейти на /forms/* без закрытия диалога. Token — localStorage + props, не в address bar.
 */
export async function mountLegalFormsMicroApp(
  container: HTMLElement,
  formsPath: string,
  accessToken: string | null,
  entry: string = FORMS_MICRO_APP_ENTRY,
): Promise<void> {
  ensureFormsMountContainer(container);

  const routePath = stripFormsEmbeddedQuery(formsPath);
  applyFormsAccessToken(accessToken);
  updateSharedFormsProps('', routePath);

  const generation = ++mountGeneration;

  const run = async () => {
    await unmountLegalFormsMicroAppInternal();

    if (generation !== mountGeneration) {
      throw new Error('Legal Forms mount cancelled');
    }

    const mountPromise = waitForFormsMicroAppMount();
    await initFormsQiankunHost('', entry, routePath);

    if (generation !== mountGeneration) {
      throw new Error('Legal Forms mount cancelled');
    }

    setFormsModalEmbedActive(true);
    syncFormsBrowserLocationForModal(routePath);
    await rerouteFormsMicroAppWithoutHostNavigation();
    await mountPromise;

    if (generation !== mountGeneration) {
      throw new Error('Legal Forms mount cancelled');
    }
  };

  mountChain = mountChain.then(() => run());
  await mountChain;
}

async function unmountLegalFormsMicroAppInternal() {
  setFormsModalEmbedActive(false);
  restoreHostBrowserLocationAfterModal();
  const unmountPromise = waitForFormsMicroAppUnmount();
  await rerouteFormsMicroAppWithoutHostNavigation();
  await unmountPromise;
}

export async function unmountLegalFormsMicroApp() {
  mountGeneration += 1;
  mountChain = mountChain.then(() => unmountLegalFormsMicroAppInternal());
  await mountChain;
}
