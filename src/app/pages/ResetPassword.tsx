import { useEffect, useState, FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Briefcase, CheckCircle, XCircle } from 'lucide-react';
import { ApiError, authApi } from '../services/api';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error'>('loading');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Ссылка восстановления недействительна');
      return;
    }

    let cancelled = false;

    const validate = async () => {
      try {
        const result = await authApi.validateResetPassword(token);
        if (cancelled) return;
        setEmail(result.email);
        setMessage(result.message);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage(err instanceof ApiError ? err.message : 'Ссылка недействительна');
      }
    };

    void validate();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (newPassword.length < 6) {
      setFormError('Пароль должен быть не короче 6 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('Пароли не совпадают');
      return;
    }

    setSubmitting(true);
    try {
      const result = await authApi.resetPassword(token, newPassword);
      setMessage(result.message);
      setStatus('success');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Не удалось сменить пароль');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 bg-brand rounded-lg flex items-center justify-center mb-3">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900">Новый пароль</h1>
          </div>

          {status === 'loading' ? (
            <p className="text-sm text-slate-500 text-center">Проверяем ссылку…</p>
          ) : null}

          {status === 'error' ? (
            <div className="space-y-4 text-center">
              <XCircle className="w-10 h-10 text-red-500 mx-auto" />
              <p className="text-sm text-red-700">{message}</p>
              <Link to="/forgot-password" className="inline-block text-sm text-brand hover:underline">
                Запросить ссылку снова
              </Link>
            </div>
          ) : null}

          {status === 'success' ? (
            <div className="space-y-4 text-center">
              <CheckCircle className="w-10 h-10 text-green-600 mx-auto" />
              <p className="text-sm text-green-800">{message}</p>
              <Link to="/login" className="inline-block text-sm text-brand hover:underline">
                Перейти ко входу
              </Link>
            </div>
          ) : null}

          {status === 'ready' ? (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <p className="text-sm text-slate-600 text-center">
                {message}
                {email ? (
                  <>
                    {' '}
                    для <span className="font-medium">{email}</span>
                  </>
                ) : null}
              </p>

              {formError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              ) : null}

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 mb-1">
                  Новый пароль
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Подтверждение пароля
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-brand text-white py-2 px-4 rounded hover:bg-brand-hover transition-colors disabled:opacity-50"
              >
                {submitting ? 'Сохранение…' : 'Сохранить пароль'}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
