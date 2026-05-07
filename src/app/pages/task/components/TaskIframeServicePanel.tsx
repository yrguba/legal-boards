import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HTMLAttributeReferrerPolicy } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { BoardIframeService } from '../../../features/board-settings/boardAdvancedSettings.types';

const IFRAME_ATTR_KEYS = new Set(['sandbox', 'allow', 'referrerpolicy']);

function buildIframeSrc(service: BoardIframeService): string | null {
  const raw = service.url.trim();
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    for (const row of service.extraFields ?? []) {
      const k = row.key.trim();
      if (!k || IFRAME_ATTR_KEYS.has(k.toLowerCase())) continue;
      if (row.value) u.searchParams.set(k, row.value);
    }
    return u.toString();
  } catch {
    return null;
  }
}

function iframeHtmlAttrs(service: BoardIframeService): {
  sandbox?: string;
  allow?: string;
  referrerPolicy?: HTMLAttributeReferrerPolicy;
} {
  const out: {
    sandbox?: string;
    allow?: string;
    referrerPolicy?: HTMLAttributeReferrerPolicy;
  } = {};
  for (const row of service.extraFields ?? []) {
    const k = row.key.trim().toLowerCase();
    if (!k) continue;
    if (k === 'sandbox') out.sandbox = row.value;
    else if (k === 'allow') out.allow = row.value;
    else if (k === 'referrerpolicy' && row.value)
      out.referrerPolicy = row.value as HTMLAttributeReferrerPolicy;
  }
  return out;
}

function isFullscreenElement(el: Element | null): boolean {
  if (!el) return false;
  const doc = el.ownerDocument;
  return (
    doc.fullscreenElement === el ||
    (doc as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement === el
  );
}

export function TaskIframeServicePanel({ service }: { service: BoardIframeService }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const src = useMemo(() => buildIframeSrc(service), [service]);
  const attrs = useMemo(() => iframeHtmlAttrs(service), [service]);

  const title = service.name.trim() || 'Сервис';

  useEffect(() => {
    const sync = () => {
      const root = rootRef.current;
      setIsFullscreen(root ? isFullscreenElement(root) : false);
    };
    const doc = rootRef.current?.ownerDocument ?? document;
    doc.addEventListener('fullscreenchange', sync);
    const webkitFs = 'webkitfullscreenchange' as keyof DocumentEventMap;
    doc.addEventListener(webkitFs, sync as EventListener);
    sync();
    return () => {
      doc.removeEventListener('fullscreenchange', sync);
      doc.removeEventListener(webkitFs, sync as EventListener);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = rootRef.current;
    if (!el || !src) return;
    const doc = el.ownerDocument;
    const webkitFs = doc as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void>;
    };
    const fsEl = doc.fullscreenElement ?? webkitFs.webkitFullscreenElement;
    try {
      if (!fsEl) {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (
          (
            el as unknown as HTMLElement & {
              webkitRequestFullscreen?: (allowKeyboardInput?: boolean) => void;
            }
          ).webkitRequestFullscreen
        )
          (
            el as unknown as HTMLElement & { webkitRequestFullscreen: () => void }
          ).webkitRequestFullscreen();
      } else if (fsEl === el) {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else if (webkitFs.webkitExitFullscreen) await webkitFs.webkitExitFullscreen();
      }
    } catch {
      // Fullscreen may be blocked by browser policy (e.g. missing user gesture on some paths).
    }
  }, [src]);

  if (!src) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-6 text-center">
        <p className="text-sm text-slate-600">Укажите корректный URL (http или https) в настройках доски.</p>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 sm:px-4">
        <span className="min-w-0 truncate text-sm font-medium text-slate-800">{title}</span>
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          title={isFullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'}
          className="shrink-0 rounded p-1.5 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {isFullscreen ? (
            <Minimize2 className="size-[18px]" aria-hidden />
          ) : (
            <Maximize2 className="size-[18px]" aria-hidden />
          )}
          <span className="sr-only">
            {isFullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'}
          </span>
        </button>
      </div>
      <div className="min-h-0 flex-1 bg-white">
        <iframe
          title={title}
          src={src}
          className="h-full min-h-[320px] w-full border-0"
          sandbox={
            attrs.sandbox ??
            'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox'
          }
          allow={attrs.allow}
          referrerPolicy={attrs.referrerPolicy}
        />
      </div>
    </div>
  );
}
