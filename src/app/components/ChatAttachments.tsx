import { useEffect, useMemo } from 'react';
import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileSpreadsheet,
  FileText,
  FileVideo,
  X,
  type LucideIcon,
} from 'lucide-react';

export type ChatAttachmentLike = {
  id?: string;
  name: string;
  type: string;
  path?: string;
};

function fileExtension(name: string) {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function isImageAttachment(type: string, name = '') {
  const mime = type.toLowerCase();
  if (mime.startsWith('image/')) return true;
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(fileExtension(name));
}

export function isPdfAttachment(type: string, name = '') {
  const mime = type.toLowerCase();
  return mime === 'application/pdf' || fileExtension(name) === 'pdf';
}

type AttachmentKind =
  | 'image'
  | 'pdf'
  | 'spreadsheet'
  | 'archive'
  | 'video'
  | 'audio'
  | 'code'
  | 'document'
  | 'other';

function attachmentKind(type: string, name: string): AttachmentKind {
  if (isImageAttachment(type, name)) return 'image';
  const mime = type.toLowerCase();
  const ext = fileExtension(name);

  if (isPdfAttachment(type, name)) return 'pdf';
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    ['xls', 'xlsx', 'csv', 'ods'].includes(ext)
  ) {
    return 'spreadsheet';
  }
  if (
    mime.includes('zip') ||
    mime.includes('rar') ||
    mime.includes('7z') ||
    mime.includes('tar') ||
    ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)
  ) {
    return 'archive';
  }
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
    return 'video';
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) {
    return 'audio';
  }
  if (
    mime.includes('javascript') ||
    mime.includes('json') ||
    mime.includes('xml') ||
    ['js', 'ts', 'jsx', 'tsx', 'json', 'xml', 'html', 'css'].includes(ext)
  ) {
    return 'code';
  }
  if (
    mime.includes('word') ||
    mime.includes('document') ||
    mime.includes('text') ||
    ['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)
  ) {
    return 'document';
  }
  return 'other';
}

const ICON_BY_KIND: Record<AttachmentKind, LucideIcon> = {
  image: FileText,
  pdf: FileText,
  spreadsheet: FileSpreadsheet,
  archive: FileArchive,
  video: FileVideo,
  audio: FileAudio,
  code: FileCode,
  document: FileText,
  other: File,
};

export function ChatAttachmentIcon({
  type,
  name,
  className,
}: {
  type: string;
  name: string;
  className?: string;
}) {
  const Icon = ICON_BY_KIND[attachmentKind(type, name)];
  return <Icon className={className} aria-hidden />;
}

export function usePendingAttachmentPreviews(files: File[]) {
  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        key: `${file.name}-${file.size}-${file.lastModified}`,
        previewUrl: isImageAttachment(file.type, file.name) ? URL.createObjectURL(file) : null,
      })),
    [files],
  );

  useEffect(() => {
    return () => {
      for (const item of previews) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, [previews]);

  return previews;
}

export function PendingAttachmentPreview({
  name,
  type,
  previewUrl,
  onRemove,
}: {
  name: string;
  type: string;
  previewUrl: string | null;
  onRemove: () => void;
}) {
  if (previewUrl) {
    return (
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
        <img src={previewUrl} alt={name} className="h-full w-full object-cover" />
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1 top-1 rounded-full bg-black/55 p-0.5 text-white hover:bg-black/70"
          aria-label="Удалить вложение"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700">
      <ChatAttachmentIcon type={type} name={name} className="size-4 shrink-0 text-slate-500" />
      <span className="truncate">{name}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-red-600"
        aria-label="Удалить вложение"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export function MessageAttachmentItem({
  name,
  type,
  href,
  mine,
  onOpenPreview,
}: {
  name: string;
  type: string;
  href: string | null;
  mine: boolean;
  onOpenPreview?: (payload: { href: string; name: string; type: string }) => void;
}) {
  const isImage = isImageAttachment(type, name);
  const canModalPreview = !!href && (isImage || isPdfAttachment(type, name));

  if (isImage && href) {
    return (
      <div className="max-w-sm">
        <button
          type="button"
          onClick={() => onOpenPreview?.({ href, name, type })}
          className="block w-full overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/40"
          title={name}
        >
          <img
            src={href}
            alt={name}
            className="max-h-72 w-full cursor-zoom-in rounded-lg object-contain bg-black/5"
            loading="lazy"
          />
        </button>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className={`mt-1 block truncate text-[11px] ${
            mine ? 'text-white/80 hover:text-white hover:underline' : 'text-slate-500 hover:text-brand'
          }`}
        >
          {name}
        </a>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${
        mine ? 'bg-white/15' : 'border border-slate-100 bg-slate-50'
      }`}
    >
      <ChatAttachmentIcon
        type={type}
        name={name}
        className={`size-4 shrink-0 ${mine ? 'text-white/85' : 'text-slate-500'}`}
      />
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            if (canModalPreview && onOpenPreview) {
              e.preventDefault();
              onOpenPreview({ href, name, type });
            }
          }}
          className={`min-w-0 flex-1 truncate text-xs ${
            mine ? 'text-white hover:underline' : 'text-slate-700 hover:text-brand'
          }`}
        >
          {name}
        </a>
      ) : (
        <span className={`min-w-0 flex-1 truncate text-xs ${mine ? 'text-white' : 'text-slate-700'}`}>
          {name}
        </span>
      )}
      {canModalPreview && onOpenPreview ? (
        <button
          type="button"
          onClick={() => onOpenPreview({ href: href!, name, type })}
          className={`shrink-0 text-[10px] ${
            mine ? 'text-white/80 hover:text-white' : 'text-slate-500 hover:text-brand'
          }`}
        >
          Просмотр
        </button>
      ) : null}
    </div>
  );
}

export function ChatAttachmentLightbox({
  attachment,
  onClose,
}: {
  attachment: { href: string; name: string; type: string } | null;
  onClose: () => void;
}) {
  if (!attachment) return null;

  const isImage = isImageAttachment(attachment.type, attachment.name);
  const isPdf = isPdfAttachment(attachment.type, attachment.name);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-900">{attachment.name}</div>
            <div className="truncate text-xs text-slate-500">{attachment.type || 'Файл'}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={attachment.href}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-brand hover:text-brand-hover"
            >
              Открыть
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
            >
              Закрыть
            </button>
          </div>
        </div>
        <div className="max-h-[calc(90vh-56px)] overflow-auto bg-slate-50 p-4">
          {isImage ? (
            <img
              src={attachment.href}
              alt={attachment.name}
              className="mx-auto max-h-[75vh] max-w-full rounded-lg object-contain"
            />
          ) : isPdf ? (
            <iframe
              title={attachment.name}
              src={attachment.href}
              className="h-[75vh] w-full rounded-lg border border-slate-200 bg-white"
            />
          ) : (
            <div className="py-8 text-center text-sm text-slate-600">
              Для этого типа файла доступно только открытие в новой вкладке.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
