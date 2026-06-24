import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { usersApi, ApiError } from '../services/api';
import type { User } from '../types';
import { useFeatureTabsConfig } from '../features/featureTabs/useFeatureTabsConfig';
import { useApp } from '../store/AppContext';
import { TemporaryPasswordField } from './TemporaryPasswordField';

type Props = {
  open: boolean;
  employee: User | null;
  onClose: () => void;
};

export function ResetPasswordModal({ open, employee, onClose }: Props) {
  const { currentWorkspace } = useApp();
  const { workspaceInviteEmail, loading: configLoading } = useFeatureTabsConfig();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [loginEmail, setLoginEmail] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(false);
    setError(null);
    setInviteSent(false);
    setLoginEmail(null);
    setTemporaryPassword(null);
  }, [open, employee?.id]);

  if (!open || !employee) return null;

  const handleReset = async () => {
    const confirmText = workspaceInviteEmail
      ? `Сбросить пароль для ${employee.name}? На ${employee.email} будет отправлен временный пароль, он также отобразится здесь.`
      : `Сбросить пароль для ${employee.name}? Будет сгенерирован временный пароль — email не отправляется. При первом входе сотруднику нужно будет задать новый пароль.`;

    if (!confirm(confirmText)) {
      return;
    }

    if (!currentWorkspace?.id) {
      setError('Пространство не выбрано');
      return;
    }

    setLoading(true);
    setError(null);
    setInviteSent(false);
    setLoginEmail(null);
    setTemporaryPassword(null);
    try {
      const result = await usersApi.resetPassword(employee.id, currentWorkspace.id);
      const password =
        typeof result.initialPassword === 'string' ? result.initialPassword : '';
      const email =
        typeof result.loginEmail === 'string' ? result.loginEmail.trim() : employee.email;

      if (password) {
        setTemporaryPassword(password);
        setLoginEmail(email || null);
        setInviteSent(!!result.inviteSent);
        return;
      }

      if (result.inviteSent) {
        setInviteSent(true);
        return;
      }

      setError(result.message || 'Не удалось сбросить пароль');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сбросить пароль');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setInviteSent(false);
    setLoginEmail(null);
    setTemporaryPassword(null);
    onClose();
  };

  const done = Boolean(temporaryPassword) || inviteSent;

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

        {done ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {temporaryPassword ? (
              <>
                Пароль для <span className="font-medium">{employee.name}</span> сброшен.
                {inviteSent ? (
                  <p className="text-xs text-green-700 mt-2">
                    Временный пароль также отправлен на{' '}
                    <span className="font-medium">{employee.email}</span>.
                  </p>
                ) : null}
                <p className="text-xs text-green-700 mt-2">
                  Для входа используйте email{' '}
                  <span className="font-medium font-mono">{loginEmail ?? employee.email}</span>
                  {' '}и временный пароль ниже. При первом входе потребуется сменить пароль.
                </p>
                <TemporaryPasswordField password={temporaryPassword} className="mt-2" />
              </>
            ) : (
              <>
                Приглашение отправлено на <span className="font-medium">{employee.email}</span>.
                <p className="text-xs text-green-700 mt-2">
                  Сотрудник перейдёт по ссылке из письма и задаст новый пароль.
                </p>
              </>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-600 mb-4">
            {configLoading
              ? 'Загрузка настроек…'
              : workspaceInviteEmail
                ? 'На email будет отправлен временный пароль. Он также отобразится здесь — при первом входе потребуется сменить пароль.'
                : 'Будет сгенерирован временный пароль. Email не отправляется — передайте пароль сотруднику вручную. При первом входе потребуется сменить пароль.'}
          </p>
        )}

        {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-800 hover:bg-slate-50"
          >
            {done ? 'Закрыть' : 'Отмена'}
          </button>
          {!done ? (
            <button
              type="button"
              disabled={loading || configLoading}
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
