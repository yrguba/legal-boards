import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { User, UserRole } from '../types';
import { useApp } from '../store/AppContext';
import { useEmployees } from '../store/EmployeesContext';

interface EditEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userId: string, data: { role: UserRole; departmentId?: string; groupIds: string[] }) => void;
  employee: User | null;
}

export function EditEmployeeModal({ isOpen, onClose, onSubmit, employee }: EditEmployeeModalProps) {
  const { currentWorkspace } = useApp();
  const { departments, groups } = useEmployees();
  const [role, setRole] = useState<UserRole>('member');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const workspaceDepartments = departments.filter((d) => d.workspaceId === currentWorkspace?.id);
  const workspaceGroups = groups.filter((g) => g.workspaceId === currentWorkspace?.id);

  useEffect(() => {
    if (employee) {
      setRole(employee.role);
      setDepartmentId(employee.departmentId || '');
      setSelectedGroups(employee.groupIds || []);
    }
  }, [employee]);

  if (!isOpen || !employee) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(employee.id, {
      role,
      departmentId: departmentId || undefined,
      groupIds: selectedGroups,
    });
    onClose();
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroups((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Редактировать сотрудника</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-brand-light flex items-center justify-center">
                <span className="text-lg font-medium text-brand">
                  {employee.name.charAt(0)}
                </span>
              </div>
              <div>
                <div className="font-medium text-slate-900">{employee.name}</div>
                <div className="text-sm text-slate-500">{employee.email}</div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Роль</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="admin">Администратор</option>
              <option value="manager">Менеджер</option>
              <option value="member">Сотрудник</option>
              <option value="guest">Гость</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Отдел</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">Без отдела</option>
              {workspaceDepartments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Группы</label>
            <div className="border border-slate-200 rounded max-h-48 overflow-y-auto">
              {workspaceGroups.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">Нет доступных групп</div>
              ) : (
                workspaceGroups.map((group) => (
                  <label
                    key={group.id}
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(group.id)}
                      onChange={() => toggleGroup(group.id)}
                      className="w-4 h-4 text-brand"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">{group.name}</div>
                      {group.description && (
                        <div className="text-xs text-slate-500">{group.description}</div>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-colors"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
