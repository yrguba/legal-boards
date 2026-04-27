import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { t } from '../taskPage.classes';

type Props = {
  boardCodeOrId: string;
  title: string;
  isEditing: boolean;
  isSaving: boolean;
  onEditTitle: (v: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
};

export function TaskPageHeader({
  boardCodeOrId,
  title,
  isEditing,
  isSaving,
  onEditTitle,
  onStartEdit,
  onCancelEdit,
  onSave,
}: Props) {
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
          {isEditing ? (
            <input
              value={title}
              onChange={(e) => onEditTitle(e.target.value)}
              className={t.inputTitle}
            />
          ) : (
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <button type="button" onClick={onStartEdit} className={t.btnSecondary}>
              Редактировать
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onCancelEdit}
                disabled={isSaving}
                className={`${t.btnSecondary} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className={`${t.btnPrimary} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Сохранить
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
