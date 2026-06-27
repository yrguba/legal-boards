import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { FORMS_MICRO_APP_CONTAINER } from '../qiankun/formsMicroApp.config';
import { mountLegalFormsMicroApp, unmountLegalFormsMicroApp } from '../qiankun/loadLegalFormsMicroApp';

type Props = {
  open: boolean;
  title: string;
  description?: string;
  formsPath: string | null;
  formsEntry: string;
  pathError?: string | null;
  accessToken: string | null;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onComplete: () => void | Promise<void>;
};

const FORMS_CONTAINER_ID = FORMS_MICRO_APP_CONTAINER.replace(/^#/, '');

export function LegalFormsMicroAppModal({
  open,
  title,
  description,
  formsPath,
  formsEntry,
  pathError = null,
  accessToken,
  submitting = false,
  error = null,
  onClose,
  onComplete,
}: Props) {
  const [mountContainer, setMountContainer] = useState<HTMLDivElement | null>(null);
  const [booting, setBooting] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const mountedRef = useRef(false);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setMountContainer(node);
  }, []);

  useEffect(() => {
    if (!open) {
      void unmountLegalFormsMicroApp();
      setBootError(null);
      setBooting(false);
      mountedRef.current = false;
      return;
    }

    if (pathError) {
      setBootError(pathError);
      setBooting(false);
      return;
    }

    if (!formsPath) {
      setBootError('Не задан путь к форме LF (проверьте параметры действия).');
      setBooting(false);
      return;
    }

    if (!mountContainer) return;

    let cancelled = false;
    setBooting(true);
    setBootError(null);

    void mountLegalFormsMicroApp(mountContainer, formsPath, accessToken, formsEntry)
      .then(() => {
        if (cancelled) {
          void unmountLegalFormsMicroApp();
          return;
        }
        mountedRef.current = true;
        setBooting(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setBootError(e instanceof Error ? e.message : 'Не удалось загрузить форму LF');
        setBooting(false);
      });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      void unmountLegalFormsMicroApp();
    };
  }, [open, formsPath, formsEntry, accessToken, pathError, mountContainer]);

  const displayError = error || bootError;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !submitting && !booting && onClose()}>
      <DialogContent
        size="xl"
        className="flex h-[90vh] max-h-[900px] flex-col gap-0 overflow-hidden p-0"
        style={{ width: 'min(95vw, 76.8rem)', maxWidth: '76.8rem' }}
      >
        <DialogHeader className="shrink-0 border-b border-slate-200 px-4 py-3">
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-left">{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        {displayError ? (
          <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {displayError}
          </div>
        ) : null}

        {!accessToken ? (
          <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            LF access_token не задан — укажите поле задачи или откройте формы с token из legal-forms.ru.
          </div>
        ) : null}

        <div className="relative min-h-0 flex-1 bg-white">
          {booting ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90">
              <Loader2 className="size-8 animate-spin text-brand" />
            </div>
          ) : null}
          <div
            ref={containerRef}
            id={FORMS_CONTAINER_ID}
            className="h-full min-h-[480px] w-full"
          />
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-slate-200 px-4 py-3 sm:gap-0">
          <button
            type="button"
            disabled={submitting || booting}
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={submitting || booting || !formsPath || Boolean(displayError)}
            onClick={() => void onComplete()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Готово — продолжить
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
