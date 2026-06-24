import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { Loader2, Paperclip, X } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { feedbackApi, ApiError, type FeedbackCategory } from '../services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: 'bug', label: 'Ошибка' },
  { value: 'improvement', label: 'Улучшение' },
  { value: 'question', label: 'Вопрос' },
  { value: 'other', label: 'Другое' },
];

const MAX_FILES = 3;
const MAX_FILE_MB = 5;

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmitted?: (message: string) => void;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FeedbackModal({ open, onClose, onSubmitted }: Props) {
  const { currentWorkspace } = useApp();
  const location = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [includeContext, setIncludeContext] = useState(true);
  const [attachWorkspace, setAttachWorkspace] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCategory('bug');
    setSubject('');
    setDescription('');
    setIncludeContext(true);
    setAttachWorkspace(Boolean(currentWorkspace?.id));
    setFiles([]);
    setError(null);
  }, [open, currentWorkspace?.id]);

  const handlePickFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_FILES) break;
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`Файл «${file.name}» больше ${MAX_FILE_MB} МБ`);
        continue;
      }
      next.push(file);
    }
    setFiles(next.slice(0, MAX_FILES));
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const trimmedSubject = subject.trim();
    const trimmedDescription = description.trim();
    if (!trimmedSubject) {
      setError('Укажите тему');
      return;
    }
    if (!trimmedDescription) {
      setError('Опишите проблему или предложение');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const pageUrl = includeContext
        ? `${window.location.origin}${location.pathname}${location.search}`
        : null;
      const result = await feedbackApi.submit({
        category,
        subject: trimmedSubject,
        description: trimmedDescription,
        workspaceId: attachWorkspace ? currentWorkspace?.id ?? null : null,
        pageUrl,
        includeContext,
        files,
      });
      onSubmitted?.(result.message);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось отправить обращение');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Обратная связь</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-slate-600">
          Сообщите об ошибке, предложите улучшение или задайте вопрос команде поддержки.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Тип</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setCategory(item.value)}
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                    category === item.value
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="feedback-subject" className="block text-sm font-medium text-slate-700 mb-1.5">
              Тема
            </label>
            <input
              id="feedback-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              placeholder="Кратко опишите суть"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label htmlFor="feedback-description" className="block text-sm font-medium text-slate-700 mb-1.5">
              Описание
            </label>
            <textarea
              id="feedback-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={8000}
              placeholder="Что произошло? Что вы ожидали? Шаги для воспроизведения…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-y min-h-[120px]"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={includeContext}
                onChange={(e) => setIncludeContext(e.target.checked)}
                className="mt-0.5"
              />
              <span>Прикрепить адрес страницы и данные браузера</span>
            </label>
            {currentWorkspace ? (
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={attachWorkspace}
                  onChange={(e) => setAttachWorkspace(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Указать пространство:{' '}
                  <span className="font-medium text-slate-900">{currentWorkspace.name}</span>
                </span>
              </label>
            ) : null}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-slate-700">Вложения</span>
              <span className="text-xs text-slate-500">
                до {MAX_FILES} файлов, макс. {MAX_FILE_MB} МБ каждый
              </span>
            </div>
            {files.length > 0 ? (
              <ul className="mb-2 space-y-1">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    <Paperclip className="size-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate text-slate-700">{file.name}</span>
                    <span className="text-xs text-slate-500 shrink-0">{formatFileSize(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="p-1 text-slate-400 hover:text-slate-700"
                      aria-label="Удалить файл"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handlePickFiles(e.target.files)}
            />
            <button
              type="button"
              disabled={files.length >= MAX_FILES}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Paperclip className="size-4" />
              Прикрепить файл
            </button>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Отправка…
              </>
            ) : (
              'Отправить'
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
