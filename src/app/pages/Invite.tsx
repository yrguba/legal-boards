import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Briefcase, CheckCircle, XCircle } from 'lucide-react';
import { ApiError, authApi } from '../services/api';

export function Invite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Ссылка приглашения недействительна');
      return;
    }

    let cancelled = false;

    const accept = async () => {
      try {
        const result = await authApi.acceptInvite(token);
        if (cancelled) return;
        setStatus('success');
        setMessage(result.message);
        setTimeout(() => {
          window.location.href = '/change-password?from=invite';
        }, 800);
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage(err instanceof ApiError ? err.message : 'Не удалось активировать приглашение');
      }
    };

    void accept();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 bg-brand rounded-lg flex items-center justify-center mb-3">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900">Приглашение</h1>
          </div>

          {status === 'loading' ? (
            <p className="text-sm text-slate-500">Проверяем ссылку…</p>
          ) : null}

          {status === 'success' ? (
            <div className="space-y-3">
              <CheckCircle className="w-10 h-10 text-green-600 mx-auto" />
              <p className="text-sm text-green-800">{message}</p>
              <p className="text-xs text-slate-500">Переход к созданию пароля…</p>
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="space-y-4">
              <XCircle className="w-10 h-10 text-red-500 mx-auto" />
              <p className="text-sm text-red-700">{message}</p>
              <Link to="/login" className="inline-block text-sm text-brand hover:underline">
                Перейти ко входу
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
