import {
  FORMS_ACTIVE_RULE,
  FORMS_MICRO_APP_CONTAINER,
  FORMS_MICRO_APP_ENTRY,
  FORMS_MICRO_APP_NAME,
} from './formsMicroApp.config';
import { installFormsApiAuthFetch } from './formsMicroAppApiAuth';
import { buildFormsMicroAppProps, syncAuthTokenForFormsApp } from './formsMicroAppBridge';
import { isFormsModalEmbedActive, setFormsModalEmbedActive as setModalEmbedFlag } from './formsModalEmbedState';

function normalizeMicroAppEntry(entry: string): string {
  const trimmed = entry.trim();
  if (!trimmed) return FORMS_MICRO_APP_ENTRY;
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

let qiankunRegistered = false;
let qiankunStarted = false;

/** Общий объект props — qiankun читает при mount; обновляем перед открытием модалки. */
const sharedFormsProps = buildFormsMicroAppProps('');

export { isFormsModalEmbedActive } from './formsModalEmbedState';

export function updateSharedFormsProps(search: string, formsPath?: string) {
  Object.assign(sharedFormsProps, buildFormsMicroAppProps(search, formsPath));
}

async function importQiankun() {
  return import('qiankun');
}

export function setFormsModalEmbedActive(active: boolean) {
  setModalEmbedFlag(active);
}

function formsActiveRule(location: Location) {
  if (isFormsModalEmbedActive()) return true;
  return (
    location.pathname === FORMS_ACTIVE_RULE ||
    location.pathname.startsWith(`${FORMS_ACTIVE_RULE}/`)
  );
}

async function ensureFormsQiankunStarted() {
  if (typeof window === 'undefined' || qiankunStarted) return;
  qiankunStarted = true;

  installFormsApiAuthFetch();
  const { addGlobalUncaughtErrorHandler, start } = await importQiankun();
  addGlobalUncaughtErrorHandler((event) => {
    console.error('[forms micro-app] qiankun uncaught', event);
  });

  const singleSpa = await import('single-spa');
  singleSpa.addErrorHandler((err) => {
    console.error('[forms micro-app] single-spa error', err);
  });

  start({
    prefetch: false,
    sandbox: false,
    singular: false,
  });
}

type MountListener = (mounted: boolean) => void;
const mountListeners = new Set<MountListener>();

export function onFormsMicroAppMount(listener: MountListener): () => void {
  mountListeners.add(listener);
  return () => mountListeners.delete(listener);
}

function notifyMounted(mounted: boolean) {
  mountListeners.forEach((l) => l(mounted));
}

export async function initFormsQiankunHost(
  search = '',
  entry: string = FORMS_MICRO_APP_ENTRY,
  formsPath?: string,
) {
  if (typeof window === 'undefined') return;

  installFormsApiAuthFetch();
  updateSharedFormsProps(search, formsPath);
  syncAuthTokenForFormsApp(search);

  if (qiankunRegistered) {
    await ensureFormsQiankunStarted();
    return;
  }
  qiankunRegistered = true;

  const { registerMicroApps } = await importQiankun();

  registerMicroApps(
    [
      {
        name: FORMS_MICRO_APP_NAME,
        entry: normalizeMicroAppEntry(entry),
        container: FORMS_MICRO_APP_CONTAINER,
        activeRule: formsActiveRule,
        props: sharedFormsProps,
      },
    ],
    {
      beforeLoad: [
        () => {
          syncAuthTokenForFormsApp(window.location.search);
          return Promise.resolve();
        },
      ],
      afterMount: [
        () => {
          notifyMounted(true);
          return Promise.resolve();
        },
      ],
      afterUnmount: [
        () => {
          notifyMounted(false);
          return Promise.resolve();
        },
      ],
    },
  );

  await ensureFormsQiankunStarted();
}

/** Полная страница /forms — нужен popstate для React Router. */
export function rerouteFormsMicroApp() {
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Модалка на доске — пересчёт activeRule без popstate (не уводим React Router). */
export async function rerouteFormsMicroAppWithoutHostNavigation() {
  const { triggerAppChange } = await import('single-spa');
  await triggerAppChange();
}

export function waitForFormsMicroAppMount(timeoutMs = 45000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      off();
      reject(new Error('Превышено время ожидания загрузки Legal Forms'));
    }, timeoutMs);

    const off = onFormsMicroAppMount((mounted) => {
      if (!mounted) return;
      window.clearTimeout(timer);
      off();
      resolve();
    });
  });
}

export function waitForFormsMicroAppUnmount(timeoutMs = 10000): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      off();
      resolve();
    }, timeoutMs);

    const off = onFormsMicroAppMount((mounted) => {
      if (mounted) return;
      window.clearTimeout(timer);
      off();
      resolve();
    });
  });
}
