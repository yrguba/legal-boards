import { useState } from 'react';
import { X } from 'lucide-react';
import { usersApi, ApiError } from '../services/api';
import type { User } from '../types';

type Props = {
  open: boolean;
  employee: User | null;
  onClose: () => void;
};

export function ResetPasswordModal({ open, employee, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  if (!open || !employee) return null;

  const handleReset = async () => {
    if (
      !confirm(
        `Сбросить пароль для ${employee.name}? На ${employee.email} будет отправлена ссылка для создания нового пароля.`,
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    setInviteSent(false);
    try {
      await usersApi.resetPassword(employee.id);
      setInviteSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сбросить пароль');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setInviteSent(false);
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

        {inviteSent ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Приглашение отправлено на <span className="font-medium">{employee.email}</span>.
            <p className="text-xs text-green-700 mt-2">
              Сотрудник перейдёт по ссылке из письма и задаст новый пароль. Старая ссылка перестанет
              действовать после активации.
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-600 mb-4">
            На email сотрудника будет отправлена ссылка для создания нового пароля. Временный пароль в
            интерфейсе показан не будет.
          </p>
        )}

        {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-800 hover:bg-slate-50"
          >
            {inviteSent ? 'Закрыть' : 'Отмена'}
          </button>
          {!inviteSent ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleReset()}
              className="px-4 py-2 text-sm rounded-lg bg-brand text-white disabled:opacity-50"
            >
              {loading ? 'Отправка…' : 'Сбросить пароль'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
