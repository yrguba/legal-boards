import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Briefcase, CheckCircle, XCircle } from 'lucide-react';
import { ApiError, invitesApi } from '../services/api';
import { useApp } from '../store/AppContext';

type InviteDetails = {
  id: string;
  workspaceId: string;
  role: string;
  workspace?: { id: string; name: string };
  invitedBy?: { name: string };
};

export function WorkspaceInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const { refreshWorkspaces, switchWorkspace, isAuthenticated } = useApp();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error' | 'auth'>('loading');
  const [message, setMessage] = useState('');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setStatus('auth');
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        if (token) {
          const data = await invitesApi.getByToken(token);
          if (cancelled) return;
          setInvite(data);
          setStatus('ready');
          return;
        }

        const pending = await invitesApi.getMine('pending');
        if (cancelled) return;
        if (pending.length === 0) {
          setStatus('error');
          setMessage('Нет активных приглашений');
          return;
        }
        setInvite(pending[0]);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage(err instanceof ApiError ? err.message : 'Не удалось загрузить приглашение');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [token, isAuthenticated]);

  const handleAccept = async () => {
    if (!invite) return;
    setActing(true);
    try {
      const result = await invitesApi.accept(invite.id);
      await refreshWorkspaces();
      switchWorkspace(result.workspaceId);
      setStatus('success');
      setMessage(`Вы присоединились к «${result.workspaceName}»`);
      setTimeout(() => navigate('/'), 1200);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Не удалось принять приглашение');
      setStatus('error');
    } finally {
      setActing(false);
    }
  };

  const handleDecline = async () => {
    if (!invite) return;
    setActing(true);
    try {
      await invitesApi.decline(invite.id);
      setStatus('success');
      setMessage('Приглашение отклонено');
      setTimeout(() => navigate('/workspaces'), 1200);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Не удалось отклонить приглашение');
      setStatus('error');
    } finally {
      setActing(false);
    }
  };

  if (status === 'auth') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center max-w-md w-full">
          <p className="text-sm text-slate-600 mb-4">Войдите, чтобы принять приглашение</p>
          <Link
            to="/login"
            state={{
              from: `/workspace-invite${token ? `?token=${encodeURIComponent(token)}` : ''}`,
            }}
            className="inline-block px-4 py-2 bg-brand text-white rounded hover:bg-brand-primary-hover"
          >
            Войти
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 bg-brand rounded-lg flex items-center justify-center mb-3">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900">Приглашение в пространство</h1>
          </div>

          {status === 'loading' && <p className="text-sm text-slate-500 text-center">Загрузка…</p>}

          {status === 'ready' && invite && (
            <div className="space-y-4">
              <p className="text-sm text-slate-700 text-center">
                {invite.invitedBy?.name ?? 'Администратор'} приглашает вас в{' '}
                <strong>{invite.workspace?.name ?? 'пространство'}</strong>
              </p>
              <p className="text-xs text-slate-500 text-center">Роль: {invite.role}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={acting}
                  onClick={() => void handleDecline()}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Отклонить
                </button>
                <button
                  type="button"
                  disabled={acting}
                  onClick={() => void handleAccept()}
                  className="flex-1 px-4 py-2 bg-brand text-white rounded hover:bg-brand-primary-hover disabled:opacity-50"
                >
                  {acting ? '…' : 'Принять'}
                </button>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-3 text-center">
              <CheckCircle className="w-10 h-10 text-green-600 mx-auto" />
              <p className="text-sm text-green-800">{message}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4 text-center">
              <XCircle className="w-10 h-10 text-red-500 mx-auto" />
              <p className="text-sm text-red-700">{message}</p>
              <Link to="/" className="inline-block text-sm text-brand hover:underline">
                На главную
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
