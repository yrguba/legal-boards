import { useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { usersApi, ApiError } from '../services/api';
import type { User } from '../types';

type Props = {
  open: boolean;
  employee: User | null;
  onClose: () => void;
};

type SuccessState =
  | { kind: 'invite' }
  | { kind: 'password'; initialPassword: string };

export function ResetPasswordModal({ open, employee, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [copied, setCopied] = useState(false);

  if (!open || !employee) return null;

  const handleReset = async () => {
    if (!confirm(`Сбросить пароль для ${employee.name}?`)) {
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await usersApi.resetPassword(employee.id);
      if (result.initialPassword) {
        setSuccess({ kind: 'password', initialPassword: result.initialPassword });
      } else {
        setSuccess({ kind: 'invite' });
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сбросить пароль');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPassword = async (password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Не удалось скопировать пароль');
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(null);
    setCopied(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} aria-hidden />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Сброс пароля</h2>
            <p className="text-sm text-slate-600 mt-1">{employee.name}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
          >
            <X className="size-5" />
          </button>
        </div>

        {success?.kind === 'invite' ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Приглашение отправлено на <span className="font-medium">{employee.email}</span>.
            <p className="text-xs text-green-700 mt-2">
              Сотрудник перейдёт по ссылке из письма и задаст новый пароль. Старая ссылка перестанет
              действовать после активации.
            </p>
          </div>
        ) : success?.kind === 'password' ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p>Новый временный пароль для {employee.name}:</p>
            <p className="text-xs text-amber-800 mt-2">
              Передайте пароль сотруднику — письмо не отправлялось.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 rounded border border-amber-300 bg-white px-3 py-2 font-mono text-sm text-slate-900">
                {success.initialPassword}
              </code>
              <button
                type="button"
                onClick={() => void handleCopyPassword(success.initialPassword)}
                className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-amber-100"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600 mb-4">
            Будет сгенерирован новый пароль или отправлена ссылка для его смены — в зависимости от
            настройки сервера.
          </p>
        )}

        {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-800 hover:bg-slate-50"
          >
            {success ? 'Закрыть' : 'Отмена'}
          </button>
          {!success ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleReset()}
              className="px-4 py-2 text-sm rounded-lg bg-brand text-white disabled:opacity-50"
            >
              {loading ? 'Сброс…' : 'Сбросить пароль'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
