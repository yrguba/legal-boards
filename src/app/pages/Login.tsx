import { useState, FormEvent, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useApp } from '../store/AppContext';
import { Briefcase } from 'lucide-react';
import { ApiError, authApi } from '../services/api';
import { PasswordInput } from '../components/PasswordInput';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const { login, isAuthenticated } = useApp();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const from = location?.state?.from || '/';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  useEffect(() => {
    authApi
      .getRegistrationConfig()
      .then((cfg) => setRegistrationEnabled(cfg.enabled))
      .catch(() => setRegistrationEnabled(false));
  }, []);

  // Браузерное автозаполнение не всегда вызывает onChange у controlled inputs
  useEffect(() => {
    const syncAutofill = () => {
      const emailEl = emailRef.current;
      const passwordEl = passwordRef.current;
      if (emailEl?.value) setEmail(emailEl.value);
      if (passwordEl?.value) setPassword(passwordEl.value);
    };

    syncAutofill();
    const timer = window.setTimeout(syncAutofill, 100);
    const timer2 = window.setTimeout(syncAutofill, 500);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(timer2);
    };
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    setUnverifiedEmail(null);

    const formData = new FormData(e.currentTarget);
    const emailValue = String(formData.get('email') ?? emailRef.current?.value ?? email).trim();
    const passwordValue = String(formData.get('password') ?? passwordRef.current?.value ?? password).trim();

    try {
      const user = await login(emailValue, passwordValue);
      navigate(user.mustChangePassword ? '/change-password' : from);
    } catch (error) {
      console.error('Login failed:', error);
      if (error instanceof ApiError && error.code === 'CLIENT_USE_LEXPRO') {
        setError(error.message);
      } else if (error instanceof ApiError && error.code === 'EMAIL_NOT_VERIFIED') {
        setError('Подтвердите email перед входом');
        setUnverifiedEmail(emailValue);
      } else if (error instanceof ApiError && error.code === 'PASSWORD_INVITE_REQUIRED') {
        setError(error.message);
        setInfo('Проверьте почту — вам должно прийти письмо со ссылкой для активации аккаунта.');
      } else if (error instanceof ApiError && error.status === 401) {
        setError('Неверный email или пароль');
      } else if (error instanceof ApiError) {
        setError(error.message);
      } else {
        setError('Не удалось войти');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!unverifiedEmail) return;
    setResending(true);
    setError(null);
    try {
      const result = await authApi.resendVerification(unverifiedEmail);
      setInfo(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить письмо');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-brand rounded-lg flex items-center justify-center mb-3">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">Legal Boards</h1>
            <p className="text-sm text-slate-600 mt-1">Войдите в систему</p>
          </div>

          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {info ? (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              {info}
            </div>
          ) : null}

          {unverifiedEmail ? (
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={resending}
              className="mb-4 w-full border border-slate-200 text-slate-700 py-2 px-4 rounded hover:bg-slate-50 transition-colors disabled:opacity-50 text-sm"
            >
              {resending ? 'Отправка…' : 'Отправить письмо подтверждения повторно'}
            </button>
          ) : null}

          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="space-y-4"
            autoComplete="on"
          >
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@legalboards.com"
                required
                autoComplete="username"
                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                Пароль
              </label>
              <PasswordInput
                ref={passwordRef}
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand text-white py-2 px-4 rounded hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </form>

          {registrationEnabled ? (
            <p className="text-sm text-slate-600 text-center mt-6">
              Нет аккаунта?{' '}
              <Link to="/register" className="text-brand hover:underline">
                Зарегистрироваться
              </Link>
            </p>
          ) : (
            <p className="text-xs text-slate-500 text-center mt-6">
              Используйте ваши учетные данные
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
