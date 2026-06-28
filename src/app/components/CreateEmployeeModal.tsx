import { useCallback, useState } from 'react';
import { X } from 'lucide-react';
import type { UserRole } from '../types';
import { useEmployees } from '../store/EmployeesContext';
import { useApp } from '../store/AppContext';
import { usersApi } from '../services/api';
import { TemporaryPasswordField } from './TemporaryPasswordField';

type LookupState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'new' }
  | { status: 'existing'; name: string; pendingInviteId: string | null }
  | { status: 'member'; name: string }
  | { status: 'error'; message: string };

type SuccessState = {
  email: string;
  kind: 'new_user' | 'workspace_invite';
  inviteEmailSent?: boolean;
  initialPassword?: string | null;
  inviteUrl?: string | null;
};

interface CreateEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateEmployeeModal({ isOpen, onClose, onSuccess }: CreateEmployeeModalProps) {
  const { currentWorkspace } = useApp();
  const { departments, groups, createUser, inviteExistingUser } = useEmployees();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'member' as UserRole,
    departmentId: '',
    groupIds: [] as string[],
  });
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' });
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const workspaceDepartments = departments.filter((d) => d.workspaceId === currentWorkspace?.id);
  const workspaceGroups = groups.filter((g) => g.workspaceId === currentWorkspace?.id);
  const teamGroups = workspaceGroups.filter((g) => !g.departmentId);
  const directionGroups = workspaceGroups.filter(
    (g) => g.departmentId && (!formData.departmentId || g.departmentId === formData.departmentId),
  );

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      role: 'member',
      departmentId: '',
      groupIds: [],
    });
    setLookup({ status: 'idle' });
    setSuccess(null);
    setSubmitError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const checkEmail = useCallback(
    async (email: string) => {
      if (!email.trim() || !currentWorkspace) {
        setLookup({ status: 'idle' });
        return;
      }
      setLookup({ status: 'checking' });
      try {
        const result = await usersApi.lookupInWorkspace(currentWorkspace.id, email.trim());
        if (!result.exists) {
          setLookup({ status: 'new' });
          return;
        }
        if (result.alreadyMember) {
          setLookup({ status: 'member', name: result.name ?? email });
          return;
        }
        setLookup({
          status: 'existing',
          name: result.name ?? email,
          pendingInviteId: result.pendingInviteId ?? null,
        });
        if (result.name) {
          setFormData((prev) => ({ ...prev, name: result.name! }));
        }
      } catch (e: unknown) {
        setLookup({
          status: 'error',
          message: e instanceof Error ? e.message : 'Не удалось проверить email',
        });
      }
    },
    [currentWorkspace],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email.trim()) {
      alert('Укажите email');
      return;
    }

    if (!currentWorkspace) {
      setSubmitError('Не выбрано рабочее пространство');
      return;
    }

    if (lookup.status === 'member') {
      setSubmitError('Пользователь уже состоит в этом пространстве');
      return;
    }

    const isInvite = lookup.status === 'existing';
    if (!isInvite && !formData.name.trim()) {
      alert('Заполните обязательные поля');
      return;
    }

    setSubmitError(null);
    setSubmitting(true);
    try {
      if (isInvite) {
        const res = await inviteExistingUser({
          email: formData.email.trim(),
          role: formData.role,
          workspaceId: currentWorkspace.id,
          departmentId: formData.departmentId || undefined,
          groupIds: formData.groupIds,
        });
        setSuccess({
          email: formData.email.trim(),
          kind: 'workspace_invite',
          inviteEmailSent: res.emailSent,
        });
        onSuccess?.();
      } else {
        const res = await createUser({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          workspaceId: currentWorkspace.id,
          departmentId: formData.departmentId || undefined,
          groupIds: formData.groupIds,
        });
        setSuccess({
          email: res?.email ?? formData.email,
          kind: 'new_user',
          inviteEmailSent: !!res?.inviteSent,
          inviteUrl: res?.inviteUrl ?? null,
          initialPassword: res?.initialPassword ?? null,
        });
      }
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Не удалось выполнить операцию');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setFormData((prev) => ({
      ...prev,
      groupIds: prev.groupIds.includes(groupId)
        ? prev.groupIds.filter((id) => id !== groupId)
        : [...prev.groupIds, groupId],
    }));
  };

  if (!isOpen) return null;

  const isInviteFlow = lookup.status === 'existing';
  const showNameField =
    lookup.status === 'idle' || lookup.status === 'new' || lookup.status === 'checking';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900">
            {isInviteFlow ? 'Пригласить сотрудника' : 'Добавить сотрудника'}
          </h2>
          <button onClick={handleClose} className="p-1 hover:bg-slate-100 rounded transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {success.kind === 'workspace_invite' ? (
                <>
                  Приглашение в пространство отправлено на{' '}
                  <span className="font-medium">{success.email}</span>.
                  <p className="text-xs text-green-700 mt-2">
                    {success.inviteEmailSent
                      ? 'Письмо отправлено. Пользователь также увидит приглашение в уведомлениях.'
                      : 'Email не отправлялся — пользователь увидит приглашение в уведомлениях.'}
                  </p>
                </>
              ) : success.inviteEmailSent ? (
                <>
                  Приглашение отправлено на <span className="font-medium">{success.email}</span>.
                  <p className="text-xs text-green-700 mt-2">
                    Сотрудник получит ссылку для активации аккаунта и создания пароля.
                  </p>
                </>
              ) : success.initialPassword ? (
                <>
                  Сотрудник <span className="font-medium">{success.email}</span> добавлен.
                  <p className="text-xs text-green-700 mt-2">
                    Передайте временный пароль. При первом входе сотрудник задаст новый пароль.
                  </p>
                  <TemporaryPasswordField password={success.initialPassword} className="mt-2" />
                </>
              ) : (
                <>
                  Сотрудник <span className="font-medium">{success.email}</span> добавлен.
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-full px-4 py-2 bg-brand text-white rounded hover:bg-brand-primary-hover transition-colors"
            >
              Закрыть
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {submitError ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            ) : null}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    setLookup({ status: 'idle' });
                  }}
                  onBlur={() => void checkEmail(formData.email)}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="ivan@example.com"
                  required
                />
                {lookup.status === 'checking' ? (
                  <p className="text-xs text-slate-500 mt-1">Проверяем…</p>
                ) : null}
                {lookup.status === 'existing' ? (
                  <p className="text-xs text-brand mt-1">
                    Пользователь уже зарегистрирован: {lookup.name}. Будет отправлено приглашение
                    в пространство.
                    {lookup.pendingInviteId ? ' (обновим ожидающее)' : ''}
                  </p>
                ) : null}
                {lookup.status === 'member' ? (
                  <p className="text-xs text-amber-700 mt-1">
                    {lookup.name} уже состоит в этом пространстве.
                  </p>
                ) : null}
                {lookup.status === 'new' ? (
                  <p className="text-xs text-slate-500 mt-1">Новый пользователь — будет создан аккаунт.</p>
                ) : null}
                {lookup.status === 'error' ? (
                  <p className="text-xs text-red-600 mt-1">{lookup.message}</p>
                ) : null}
              </div>

              {showNameField ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Имя *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
                    placeholder="Иван Иванов"
                    required={!isInviteFlow}
                  />
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Роль *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="member">Сотрудник</option>
                  <option value="manager">Менеджер</option>
                  <option value="admin">Администратор</option>
                  <option value="guest">Гость</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Отдел</label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      departmentId: next,
                      groupIds: prev.groupIds.filter((gid) => {
                        const g = workspaceGroups.find((x) => x.id === gid);
                        if (!g?.departmentId) return true;
                        return g.departmentId === next;
                      }),
                    }));
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="">Не указано</option>
                  {workspaceDepartments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {teamGroups.length > 0 || directionGroups.length > 0 ? (
                <>
                  {teamGroups.length > 0 ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Группы</label>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {teamGroups.map((group) => (
                          <label
                            key={group.id}
                            className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={formData.groupIds.includes(group.id)}
                              onChange={() => toggleGroup(group.id)}
                              className="w-4 h-4 text-brand border-slate-300 rounded focus:ring-brand"
                            />
                            <span className="text-sm text-slate-700">{group.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {directionGroups.length > 0 ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Направления / продукты
                      </label>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {directionGroups.map((group) => (
                          <label
                            key={group.id}
                            className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={formData.groupIds.includes(group.id)}
                              onChange={() => toggleGroup(group.id)}
                              className="w-4 h-4 text-brand border-slate-300 rounded focus:ring-brand"
                            />
                            <span className="text-sm text-slate-700">{group.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={submitting || lookup.status === 'member'}
                className="shrink-0 whitespace-nowrap px-4 py-2 bg-brand text-white rounded hover:bg-brand-primary-hover transition-colors disabled:opacity-50"
              >
                {submitting
                  ? 'Отправка…'
                  : isInviteFlow
                    ? 'Отправить приглашение'
                    : 'Добавить'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
