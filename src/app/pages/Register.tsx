import { useEffect, useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Briefcase } from 'lucide-react';
import { ApiError, authApi } from '../services/api';
import { useApp } from '../store/AppContext';

export function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resending, setResending] = useState(false);
  const { isAuthenticated } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
      return;
    }
    authApi
      .getRegistrationConfig()
      .then((cfg) => setEnabled(cfg.enabled))
      .catch(() => setEnabled(false))
      .finally(() => setChecking(false));
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов');
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.register(email.trim(), password, name.trim());
      setRegisteredEmail(result.email);
      setSuccess(result.message);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Не удалось зарегистрироваться');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!registeredEmail) return;
    setResending(true);
    setError(null);
    try {
      const result = await authApi.resendVerification(registeredEmail);
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить письмо');
    } finally {
      setResending(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-sm text-slate-500">
        Загрузка…
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
          <p className="text-slate-700">Регистрация отключена.</p>
          <Link to="/login" className="mt-4 inline-block text-brand hover:underline text-sm">
            Вернуться ко входу
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-brand rounded-lg flex items-center justify-center mb-3">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">Регистрация</h1>
            <p className="text-sm text-slate-600 mt-1">Создайте аккаунт Legal Boards</p>
          </div>

          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                {success}
              </div>
              <p className="text-sm text-slate-600 text-center">
                Проверьте почту <span className="font-medium">{registeredEmail}</span> и перейдите по ссылке из письма.
              </p>
              <button
                type="button"
                onClick={() => void handleResend()}
                disabled={resending}
                className="w-full border border-slate-200 text-slate-700 py-2 px-4 rounded hover:bg-slate-50 transition-colors disabled:opacity-50 text-sm"
              >
                {resending ? 'Отправка…' : 'Отправить письмо повторно'}
              </button>
              <Link
                to="/login"
                className="block text-center text-sm text-brand hover:underline"
              >
                Перейти ко входу
              </Link>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                  Имя
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                  Пароль
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
                  Подтверждение пароля
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand text-white py-2 px-4 rounded hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Регистрация…' : 'Зарегистрироваться'}
              </button>
            </form>
          )}

          {!success ? (
            <p className="text-sm text-slate-600 text-center mt-6">
              Уже есть аккаунт?{' '}
              <Link to="/login" className="text-brand hover:underline">
                Войти
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
