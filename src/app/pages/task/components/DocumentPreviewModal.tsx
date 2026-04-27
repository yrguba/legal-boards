import type { DocumentPreviewState } from '../types';

type Props = {
  preview: DocumentPreviewState | null;
  onClose: () => void;
};

export function DocumentPreviewModal({ preview, onClose }: Props) {
  if (!preview) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[85vh] bg-white rounded-lg overflow-hidden border border-slate-200 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900 truncate">{preview.name}</div>
            <div className="text-xs text-slate-500">{(preview as { type?: string }).type}</div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={preview.href}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-brand hover:text-brand-hover"
            >
              Открыть
            </a>
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-2 py-1 rounded hover:bg-slate-100"
            >
              Закрыть
            </button>
          </div>
        </div>
        <div className="p-4 overflow-auto max-h-[calc(85vh-56px)] bg-slate-50">
          {String(preview.type || '').startsWith('image/') ? (
            <img
              src={preview.href}
              alt={String(preview.name)}
              className="max-w-full h-auto mx-auto rounded"
            />
          ) : preview.type === 'application/pdf' ? (
            <iframe title={String(preview.name)} src={preview.href} className="w-full h-[70vh] rounded" />
          ) : (
            <div className="text-sm text-slate-600">
              Для этого типа файла доступно только открытие в новой вкладке.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
