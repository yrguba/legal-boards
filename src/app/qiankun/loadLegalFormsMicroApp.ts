import { FORMS_MICRO_APP_CONTAINER, FORMS_MICRO_APP_ENTRY } from './formsMicroApp.config';
import {
  persistFormsAccessToken,
  stripFormsEmbeddedQuery,
  syncAuthTokenForFormsApp,
} from './formsMicroAppBridge';
import { popFormsEmbedBrowserUrl, pushFormsEmbedBrowserUrl } from './formsMicroAppBrowserUrl';
import { toHostRoutePath } from './formsMicroAppPaths';
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

function ensureFormsMountContainer(container: HTMLElement) {
  const id = FORMS_MICRO_APP_CONTAINER.replace(/^#/, '');
  if (container.id !== id) container.id = id;
}

function splitPathAndSearch(input: string): { pathname: string; search: string } {
  const queryIndex = input.indexOf('?');
  if (queryIndex < 0) return { pathname: input, search: '' };
  return { pathname: input.slice(0, queryIndex), search: input.slice(queryIndex) };
}

function applyFormsAccessToken(accessToken: string | null) {
  if (accessToken?.trim()) {
    persistFormsAccessToken(accessToken.trim());
    return;
  }
  syncAuthTokenForFormsApp('');
}

/**
 * Модалка / embed: qiankun монтируется в контейнер.
 * URL React Router не меняется; для preload LF временно подменяем pathname через replaceState.
 */
export async function mountLegalFormsMicroApp(
  container: HTMLElement,
  formsPath: string,
  accessToken: string | null,
  entry: string = FORMS_MICRO_APP_ENTRY,
): Promise<void> {
  ensureFormsMountContainer(container);

  const { pathname: rawPath, search: pathSearch } = splitPathAndSearch(formsPath);
  const hostPath = toHostRoutePath(stripFormsEmbeddedQuery(rawPath));

  const generation = ++mountGeneration;

  const run = async () => {
    await unmountLegalFormsMicroAppInternal();

    if (generation !== mountGeneration) {
      throw new Error('Legal Forms mount cancelled');
    }

    applyFormsAccessToken(accessToken);
    syncAuthTokenForFormsApp(pathSearch);
    pushFormsEmbedBrowserUrl(hostPath, pathSearch);
    updateSharedFormsProps(pathSearch, hostPath);

    try {
      const mountPromise = waitForFormsMicroAppMount();
      await initFormsQiankunHost(pathSearch, entry, hostPath);

      if (generation !== mountGeneration) {
        throw new Error('Legal Forms mount cancelled');
      }

      setFormsModalEmbedActive(true);
      await rerouteFormsMicroAppWithoutHostNavigation();
      await mountPromise;

      if (generation !== mountGeneration) {
        throw new Error('Legal Forms mount cancelled');
      }
    } catch (error) {
      popFormsEmbedBrowserUrl();
      setFormsModalEmbedActive(false);
      throw error;
    }
  };

  mountChain = mountChain.then(() => run());
  await mountChain;
}

async function unmountLegalFormsMicroAppInternal() {
  setFormsModalEmbedActive(false);
  const unmountPromise = waitForFormsMicroAppUnmount();
  await rerouteFormsMicroAppWithoutHostNavigation();
  await unmountPromise;
  popFormsEmbedBrowserUrl();
}

export async function unmountLegalFormsMicroApp() {
  mountGeneration += 1;
  mountChain = mountChain.then(() => unmountLegalFormsMicroAppInternal());
  await mountChain;
}
