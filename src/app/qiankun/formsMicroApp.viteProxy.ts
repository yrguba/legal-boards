import type { ProxyOptions } from 'vite';
import {
  DEFAULT_FORMS_API_ORIGIN,
  DEFAULT_FORMS_DOCSTREAM_PREFIX,
  FORMS_API_PATH_PREFIXES,
} from './formsMicroApp.constants';

const formsProxyTarget =
  process.env.VITE_FORMS_API_ORIGIN?.replace(/\/$/, '') ?? DEFAULT_FORMS_API_ORIGIN;

const formsProxyEntry: ProxyOptions = {
  target: formsProxyTarget,
  changeOrigin: true,
  secure: true,
  configure: (proxy) => {
    proxy.on('proxyReq', (proxyReq, req) => {
      const url = req.url ?? '';
      const authHeader = req.headers.authorization;
      const flaskInQuery = url.includes('access_token=.');
      const flaskInBearer =
        typeof authHeader === 'string' && /^Bearer\s+\./i.test(authHeader.trim());

      if (flaskInQuery || flaskInBearer) {
        proxyReq.removeHeader('authorization');
      }
    });
  },
};

/** Vite dev-server: LF docstream + API на legal-forms.ru, остальной /api — Legal Boards. */
export function buildFormsApiViteProxy(): Record<string, ProxyOptions> {
  return {
    [DEFAULT_FORMS_DOCSTREAM_PREFIX]: { ...formsProxyEntry },
    ...Object.fromEntries(
      FORMS_API_PATH_PREFIXES.map((prefix) => [prefix, { ...formsProxyEntry }]),
    ),
  };
}
