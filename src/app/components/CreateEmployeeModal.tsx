import { useState } from 'react';
import { X } from 'lucide-react';
import type { UserRole } from '../types';
import { useEmployees } from '../store/EmployeesContext';
import { useApp } from '../store/AppContext';

interface CreateEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateEmployeeModal({ isOpen, onClose }: CreateEmployeeModalProps) {
  const { currentWorkspace } = useApp();
  const { departments, groups, createUser } = useEmployees();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'member' as UserRole,
    departmentId: '',
    groupIds: [] as string[],
  });
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const workspaceDepartments = departments.filter(d => d.workspaceId === currentWorkspace?.id);
  const workspaceGroups = groups.filter(g => g.workspaceId === currentWorkspace?.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim()) {
      alert('Заполните обязательные поля');
      return;
    }

    if (!currentWorkspace) {
      setSubmitError('Не выбрано рабочее пространство');
      return;
    }

    setSubmitError(null);
    try {
      const res = await createUser({
        name: formData.name,
        email: formData.email,
        role: formData.role,
        workspaceId: currentWorkspace.id,
        departmentId: formData.departmentId || undefined,
        groupIds: formData.groupIds,
      });

      setCreatedPassword(res?.initialPassword || null);
      setFormData({
        name: '',
        email: '',
        role: 'member',
        departmentId: '',
        groupIds: [],
      });
    } catch (e: any) {
      setSubmitError(e?.message || 'Не удалось добавить сотрудника');
    }
  };

  const toggleGroup = (groupId: string) => {
    setFormData(prev => ({
      ...prev,
      groupIds: prev.groupIds.includes(groupId)
        ? prev.groupIds.filter(id => id !== groupId)
        : [...prev.groupIds, groupId],
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Добавить сотрудника</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {submitError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          {createdPassword && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Пароль для входа: <span className="font-medium">{createdPassword}</span>
              <div className="text-xs text-slate-500 mt-1">
                Сохраните пароль и передайте сотруднику. Он отображается только один раз.
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Имя *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="Иван Иванов"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="ivan@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Роль *
              </label>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Отдел
              </label>
              <select
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
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

            {workspaceGroups.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Группы
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {workspaceGroups.map((group) => (
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
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-brand text-white rounded hover:bg-brand-primary-hover transition-colors"
            >
              Добавить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
