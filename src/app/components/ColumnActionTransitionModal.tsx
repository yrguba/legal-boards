import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import type { ColumnTransitionInteractiveStep } from '../utils/boardColumnActions';

type Props = {
  open: boolean;
  steps: ColumnTransitionInteractiveStep[];
  targetColumnName?: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmitStep: (
    step: ColumnTransitionInteractiveStep,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  onAllComplete: () => Promise<void>;
};

export function ColumnActionTransitionModal({
  open,
  steps,
  targetColumnName,
  submitting,
  error,
  onClose,
  onSubmitStep,
  onAllComplete,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [checkboxConfirmed, setCheckboxConfirmed] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [localError, setLocalError] = useState<string | null>(null);

  const step = steps[stepIndex];
  const isLast = stepIndex >= steps.length - 1;

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    setCheckboxConfirmed(false);
    setFormValues({});
    setLocalError(null);
  }, [open, steps]);

  useEffect(() => {
    if (!step) return;
    setCheckboxConfirmed(false);
    setFormValues({});
    setLocalError(null);
  }, [step?.rule.id, stepIndex]);

  const title = useMemo(() => {
    if (!step) return 'Обязательное действие';
    return step.rule.name.trim() || 'Обязательное действие';
  }, [step]);

  if (!step) return null;

  const handleSubmit = async () => {
    setLocalError(null);
    if (step.rule.actionKind === 'confirm') {
      if (step.rule.config.requireCheckbox && !checkboxConfirmed) {
        setLocalError('Отметьте обязательный пункт');
        return;
      }
      await onSubmitStep(step, {
        confirmed: true,
        checkboxConfirmed,
      });
    } else if (step.rule.actionKind === 'form') {
      await onSubmitStep(step, formValues);
    }

    if (isLast) {
      await onAllComplete();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !submitting && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-left">
            {step.phase === 'enter'
              ? `Для перехода в «${targetColumnName || 'новый статус'}»`
              : 'Перед выходом из текущего статуса'}
            {' — шаг '}
            {stepIndex + 1} из {steps.length}
          </DialogDescription>
        </DialogHeader>

        {error || localError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {localError || error}
          </div>
        ) : null}

        {step.rule.actionKind === 'confirm' ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {step.rule.config.message?.trim() ||
                'Подтвердите выполнение обязательного действия.'}
            </p>
            {step.rule.config.requireCheckbox ? (
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={checkboxConfirmed}
                  onChange={(e) => setCheckboxConfirmed(e.target.checked)}
                  className="mt-0.5"
                />
                <span>{step.rule.config.checkboxLabel?.trim() || 'Подтверждаю'}</span>
              </label>
            ) : null}
          </div>
        ) : null}

        {step.rule.actionKind === 'form' ? (
          <div className="space-y-3">
            {(step.rule.config.fields ?? []).map((field) => {
              const val = formValues[field.key];
              return (
                <div key={field.key}>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    {field.label || field.key}
                    {field.required !== false ? <span className="text-red-500"> *</span> : null}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      value={(val as string) ?? ''}
                      onChange={(e) =>
                        setFormValues((p) => ({ ...p, [field.key]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={(val as string) ?? ''}
                      onChange={(e) =>
                        setFormValues((p) => ({ ...p, [field.key]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    >
                      <option value="">Выберите…</option>
                      {(field.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={val === true}
                        onChange={(e) =>
                          setFormValues((p) => ({ ...p, [field.key]: e.target.checked }))
                        }
                      />
                      <span>{field.label}</span>
                    </label>
                  ) : (
                    <input
                      type={field.type === 'date' ? 'date' : 'text'}
                      value={(val as string) ?? ''}
                      onChange={(e) =>
                        setFormValues((p) => ({ ...p, [field.key]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {isLast ? 'Выполнить и перевести' : 'Далее'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
