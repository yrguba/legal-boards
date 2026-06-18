import { Link } from 'react-router';
import { ArrowLeft, ArrowRightLeft } from 'lucide-react';
import { t } from '../taskPage.classes';
import { InlineEditField } from '../../../components/inline-edit/InlineEditField';
import type { InlineFieldKey } from '../utils/validateField';

type Props = {
  boardCodeOrId: string;
  title: string;
  canTransfer?: boolean;
  onTransfer?: () => void;
  savingField: InlineFieldKey | null;
  fieldError?: string | null;
  titleLocked?: boolean;
  onSaveTitle: (title: string) => Promise<void>;
};

export function TaskPageHeader({
  boardCodeOrId,
  title,
  canTransfer,
  onTransfer,
  savingField,
  fieldError,
  titleLocked,
  onSaveTitle,
}: Props) {
  const saving = savingField === 'title';

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-4">
      <Link
        to={`/board/${boardCodeOrId}`}
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-3"
      >
        <ArrowLeft className="w-4 h-4" />
        Назад к доске
      </Link>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <InlineEditField
            fieldKey="title"
            layout="title"
            saving={saving}
            locked={titleLocked}
            error={fieldError}
            placeholder="Добавить название…"
            getValue={() => title}
            isEmpty={(v) => !v.trim()}
            onSave={onSaveTitle}
            renderView={(v) => (
              <h1 className="text-xl font-semibold text-slate-900 whitespace-pre-wrap break-words">
                {v}
              </h1>
            )}
            renderEditor={({ value, onChange, onCommit, onCancel, saving: isSaving, inputRef }) => (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                rows={1}
                value={value}
                disabled={isSaving}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void onCommit();
                  }
                }}
                className={`${t.inputTitle} resize-none overflow-hidden min-h-[2.5rem]`}
                style={{ fieldSizing: 'content' } as React.CSSProperties}
              />
            )}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canTransfer && onTransfer ? (
            <button type="button" onClick={onTransfer} className={t.btnSecondary}>
              <span className="inline-flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4" />
                Перенести
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
