import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Scale } from 'lucide-react';
import { ApiError } from '@/api/client';
import { useAuth } from '@/context/AuthContext';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clientKind, setClientKind] = useState<'individual' | 'company'>('individual');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await register({
        email: email.trim(),
        password,
        name: name.trim(),
        clientKind,
        companyName: clientKind === 'company' ? companyName.trim() : undefined,
      });
      navigate('/', { replace: true });
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 py-10 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-brand rounded-lg flex items-center justify-center mb-3">
              <Scale className="w-6 h-6 text-white" aria-hidden />
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">LEXPRO</h1>
            <p className="text-sm text-slate-600 mt-1">Регистрация клиента платформы</p>
          </div>

          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-2">Тип лица</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="clientKind"
                    checked={clientKind === 'individual'}
                    onChange={() => setClientKind('individual')}
                  />
                  <span className="text-sm text-slate-800">Частное лицо</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="clientKind"
                    checked={clientKind === 'company'}
                    onChange={() => setClientKind('company')}
                  />
                  <span className="text-sm text-slate-800">Компания</span>
                </label>
              </div>
            </div>

            {clientKind === 'company' ? (
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-slate-700 mb-1">
                  Название компании
                </label>
                <input
                  id="companyName"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  autoComplete="organization"
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                />
              </div>
            ) : null}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                ФИО / контактное лицо
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
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
                autoComplete="email"
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
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">Не менее 8 символов</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand text-white py-2 px-4 rounded hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Регистрация…' : 'Зарегистрироваться'}
            </button>
          </form>

          <p className="text-sm text-slate-600 text-center mt-6">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="text-brand font-medium hover:underline">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
