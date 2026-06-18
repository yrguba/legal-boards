import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Loader2, Pencil, X } from 'lucide-react';

export type InlineEditEditorProps<T> = {
  value: T;
  onChange: (v: T) => void;
  onCommit: () => void;
  onCancel: () => void;
  saving: boolean;
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>;
};

type Props<T> = {
  fieldKey: string;
  label?: ReactNode;
  readOnly?: boolean;
  saving?: boolean;
  locked?: boolean;
  error?: string | null;
  placeholder?: string;
  layout?: 'default' | 'title' | 'full';
  className?: string;
  getValue: () => T;
  isEmpty?: (v: T) => boolean;
  onSave: (value: T) => Promise<void>;
  renderView: (value: T) => ReactNode;
  renderEditor: (props: InlineEditEditorProps<T>) => ReactNode;
  /** Сохранить сразу при выборе (для select / status) */
  commitOnChange?: boolean;
};

export function InlineEditField<T>({
  fieldKey,
  label,
  readOnly,
  saving = false,
  locked = false,
  error,
  placeholder = '—',
  layout = 'default',
  className = '',
  getValue,
  isEmpty,
  onSave,
  renderView,
  renderEditor,
  commitOnChange = false,
}: Props<T>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<T | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);

  const current = getValue();
  const empty = isEmpty ? isEmpty(current) : false;

  const startEdit = useCallback(() => {
    if (readOnly || locked || saving) return;
    setDraft(getValue());
    setEditing(true);
  }, [readOnly, locked, saving, getValue]);

  const cancel = useCallback(() => {
    setEditing(false);
    setDraft(null);
  }, []);

  const commit = useCallback(async () => {
    if (draft === null) return;
    try {
      await onSave(draft);
      setEditing(false);
      setDraft(null);
    } catch {
      /* ошибка отображается через error */
    }
  }, [draft, onSave]);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (el) {
      el.focus();
      if ('select' in el && typeof el.select === 'function') {
        el.select();
      }
    }
  }, [editing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!editing) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, cancel]);

  const handleDraftChange = useCallback(
    async (v: T) => {
      setDraft(v);
      if (commitOnChange) {
        try {
          await onSave(v);
          setEditing(false);
          setDraft(null);
        } catch {
          setDraft(v);
        }
      }
    },
    [commitOnChange, onSave],
  );

  if (editing && draft !== null) {
    return (
      <div className={className} data-inline-field={fieldKey}>
        {label ? <div className="mb-1">{label}</div> : null}
        <div className="relative">
          {renderEditor({
            value: draft,
            onChange: commitOnChange ? handleDraftChange : setDraft,
            onCommit: commit,
            onCancel: cancel,
            saving,
            inputRef,
          })}
          {!commitOnChange ? (
            <div className="mt-1 flex items-center gap-1">
              <button
                type="button"
                onClick={commit}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-white bg-brand hover:bg-brand-hover disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                Сохранить
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="size-3.5" />
                Отмена
              </button>
            </div>
          ) : null}
        </div>
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </div>
    );
  }

  const viewContent = empty ? (
    <span className="text-sm text-slate-400 italic">{placeholder}</span>
  ) : (
    renderView(current)
  );

  const rowClass =
    layout === 'title'
      ? 'group/title relative -mx-1 rounded px-1 py-0.5 hover:bg-slate-50'
      : layout === 'full'
        ? 'group/field relative rounded px-1 py-0.5 hover:bg-slate-50'
        : 'group/field relative rounded px-1 py-0.5 hover:bg-slate-50 min-h-[1.75rem]';

  return (
    <div className={className} data-inline-field={fieldKey}>
      {label ? <div className="mb-1">{label}</div> : null}
      <div className={`${rowClass} ${readOnly || locked ? '' : 'cursor-pointer'}`}>
        <div className="flex items-start gap-1 pr-7">
          <div className="min-w-0 flex-1">{viewContent}</div>
        </div>
        {!readOnly && !locked ? (
          <button
            type="button"
            title="Редактировать"
            onClick={(e) => {
              e.stopPropagation();
              startEdit();
            }}
            className="absolute right-0 top-0.5 rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-200 hover:text-slate-700 group-hover/field:opacity-100 group-hover/title:opacity-100"
          >
            <Pencil className="size-3.5" />
          </button>
        ) : null}
        {saving && !editing ? (
          <Loader2 className="absolute right-0 top-1 size-4 animate-spin text-slate-400" />
        ) : null}
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
