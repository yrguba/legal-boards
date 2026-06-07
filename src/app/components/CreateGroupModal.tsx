import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useEmployees } from '../store/EmployeesContext';
import type { Department, Group } from '../types';

interface CreateGroupModalProps {
  isOpen: boolean;
  editingGroup?: Group | null;
  defaultDepartmentId?: string;
  departments: Department[];
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    memberIds: string[];
    departmentId: string;
    leaderId: string | null;
  }) => void | Promise<void>;
}

export function CreateGroupModal({
  isOpen,
  editingGroup,
  defaultDepartmentId,
  departments,
  onClose,
  onSubmit,
}: CreateGroupModalProps) {
  const { users } = useEmployees();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [leaderId, setLeaderId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(editingGroup?.name ?? '');
    setDescription(editingGroup?.description ?? '');
    setDepartmentId(
      editingGroup?.departmentId ?? defaultDepartmentId ?? departments[0]?.id ?? '',
    );
    setSelectedMembers([...(editingGroup?.memberIds ?? [])]);
    setLeaderId(editingGroup?.leaderId ?? '');
  }, [
    isOpen,
    editingGroup?.id,
    editingGroup?.name,
    editingGroup?.description,
    editingGroup?.departmentId,
    editingGroup?.leaderId,
    editingGroup?.memberIds?.join(','),
    defaultDepartmentId,
    departments,
  ]);

  const eligibleUsers = useMemo(() => {
    if (!departmentId) return [];
    return users.filter((u) => u.departmentId === departmentId);
  }, [users, departmentId]);

  if (!isOpen) return null;

  const isEdit = Boolean(editingGroup?.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !departmentId || busy) return;
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        memberIds: selectedMembers,
        departmentId,
        leaderId: leaderId || null,
      });
    } finally {
      setBusy(false);
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            {isEdit ? 'Редактировать направление' : 'Создать направление / продукт'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Отдел *</label>
            <select
              value={departmentId}
              disabled={isEdit}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setSelectedMembers([]);
                setLeaderId('');
              }}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand text-sm disabled:bg-slate-100"
            >
              <option value="">Выберите отдел</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Название *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Направление или продукт"
              required
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание"
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Участники (только из выбранного отдела)
            </label>
            <div className="border border-slate-200 rounded max-h-64 overflow-y-auto">
              {eligibleUsers.length === 0 ? (
                <p className="p-3 text-sm text-slate-500">Нет сотрудников в этом отделе</p>
              ) : (
                eligibleUsers.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(user.id)}
                      onChange={() => toggleMember(user.id)}
                      className="w-4 h-4 text-brand"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1">Выбрано: {selectedMembers.length}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Руководитель направления
            </label>
            <select
              value={leaderId}
              onChange={(e) => setLeaderId(e.target.value)}
              disabled={!departmentId}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand text-sm disabled:bg-slate-100"
            >
              <option value="">Не назначен</option>
              {eligibleUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Руководитель видит конфиденциальные данные сотрудников направления.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={busy || !departmentId}
              className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-colors disabled:opacity-50"
            >
              {busy ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
