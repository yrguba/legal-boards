import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Briefcase } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { authApi, ApiError } from '../services/api';

export function ChangePassword() {
  const { currentUser, setCurrentUser, refreshWorkspaces } = useApp();
  const navigate = useNavigate();
  const forced = !!currentUser?.mustChangePassword;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Новый пароль должен быть не короче 6 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.changePassword({
        currentPassword: currentPassword.trim() || undefined,
        newPassword,
      });
      setCurrentUser(result.user);
      if (forced) {
        await refreshWorkspaces();
      }
      navigate(forced ? '/' : '/settings', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сменить пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-slate-200 p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-brand rounded-lg flex items-center justify-center mb-3">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            {forced ? 'Смена пароля' : 'Новый пароль'}
          </h1>
          <p className="text-sm text-slate-600 mt-1 text-center">
            {forced
              ? 'При первом входе задайте свой пароль вместо временного от администратора.'
              : 'Введите текущий пароль и новый.'}
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {forced ? 'Временный пароль' : 'Текущий пароль'}
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required={!forced}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Новый пароль</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Повторите пароль</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand text-white py-2 px-4 rounded hover:bg-brand-hover transition-colors disabled:opacity-50"
          >
            {loading ? 'Сохранение…' : 'Сохранить пароль'}
          </button>
        </form>
      </div>
    </div>
  );
}
