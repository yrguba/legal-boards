import { useMemo, useState } from 'react';
import type { Board, TaskField, TaskType, User } from '../types';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  board: Board;
  columnId: string;
  users: User[];
  onSubmit: (data: {
    title: string;
    description?: string;
    typeId: string;
    assigneeId?: string;
    customFields: Record<string, any>;
  }) => Promise<void> | void;
}

function isEmptyValue(v: unknown) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function fieldLabel(field: TaskField) {
  return `${field.name}${field.required ? ' *' : ''}`;
}

export function CreateTaskModal({ isOpen, onClose, board, columnId, users, onSubmit }: CreateTaskModalProps) {
  const [typeId, setTypeId] = useState<string>(() => board.taskTypes?.[0]?.id || '');
  const [customFields, setCustomFields] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const taskTypes: TaskType[] = useMemo(() => board.taskTypes || [], [board.taskTypes]);
  const taskFields: TaskField[] = useMemo(
    () => [...(board.taskFields || [])].sort((a, b) => a.position - b.position),
    [board.taskFields]
  );

  const titleField = useMemo(() => {
    const byName = taskFields.find((f) => f.type === 'text' && f.name.trim().toLowerCase() === 'название');
    if (byName) return byName;
    const requiredText = taskFields.find((f) => f.type === 'text' && f.required);
    if (requiredText) return requiredText;
    return taskFields.find((f) => f.type === 'text') || null;
  }, [taskFields]);

  const descriptionField = useMemo(() => {
    const byName = taskFields.find(
      (f) => (f.type === 'textarea' || f.type === 'text') && f.name.trim().toLowerCase() === 'описание'
    );
    return byName || null;
  }, [taskFields]);

  if (!isOpen) return null;

  const reset = () => {
    setTypeId(board.taskTypes?.[0]?.id || '');
    setCustomFields({});
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const validate = () => {
    if (!typeId) return 'Выберите тип задачи';
    if (!titleField) return 'В настройках доски нет текстового поля для названия задачи';

    for (const f of taskFields) {
      if (!f.required) continue;
      if (isEmptyValue(customFields[f.id])) return `Заполните поле: ${f.name}`;
    }

    return null;
  };

  const submit = async () => {
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const rawTitle = customFields[titleField!.id];
      const title = typeof rawTitle === 'string' ? rawTitle.trim() : String(rawTitle ?? '').trim();
      if (!title) throw new Error('Заполните поле: ' + titleField!.name);

      const rawDescription = descriptionField ? customFields[descriptionField.id] : undefined;
      const description =
        typeof rawDescription === 'string' ? rawDescription.trim() : rawDescription !== undefined ? String(rawDescription) : '';

      const { [titleField!.id]: _t, ...restAfterTitle } = customFields;
      const { [descriptionField?.id || '']: _d, ...restAfterDescription } = restAfterTitle;
      const restCustomFields = restAfterDescription;

      await onSubmit({
        title,
        description: description || undefined,
        typeId,
        assigneeId: undefined,
        customFields: restCustomFields,
      });
      handleClose();
    } catch (e: any) {
      setError(e?.message || 'Не удалось создать задачу');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Создать задачу</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Тип *</label>
            <select
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="" disabled>
                Выберите тип
              </option>
              {taskTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {taskFields.length > 0 && (
            <div className="w-full">
              <div className="flex w-full flex-col gap-4">
                {taskFields.map((f) => (
                  <div key={f.id} className="w-full space-y-1">
                    <label className="block text-sm font-medium text-slate-700">
                      {fieldLabel(f)}
                    </label>

                    {f.type === 'text' && (
                      <input
                        value={customFields[f.id] ?? ''}
                        onChange={(e) => setCustomFields((p) => ({ ...p, [f.id]: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    )}

                    {f.type === 'textarea' && (
                      <textarea
                        rows={3}
                        value={customFields[f.id] ?? ''}
                        onChange={(e) => setCustomFields((p) => ({ ...p, [f.id]: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    )}

                    {f.type === 'select' && (
                      <select
                        value={customFields[f.id] ?? ''}
                        onChange={(e) => {
                          setCustomFields((p) => ({ ...p, [f.id]: e.target.value }));
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
                      >
                        {(f.options || []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}

                    {f.type === 'date' && (
                      <input
                        type="date"
                        value={customFields[f.id] ?? ''}
                        onChange={(e) => setCustomFields((p) => ({ ...p, [f.id]: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    )}

                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded transition-colors"
            disabled={isSubmitting}
          >
            Отмена
          </button>
          <button
            onClick={submit}
            className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            Создать
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

