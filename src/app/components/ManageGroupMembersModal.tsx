import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Group } from '../types';
import { useEmployees } from '../store/EmployeesContext';

interface ManageGroupMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (groupId: string, memberIds: string[]) => void;
  group: Group | null;
}

export function ManageGroupMembersModal({
  isOpen,
  onClose,
  onSubmit,
  group,
}: ManageGroupMembersModalProps) {
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const { users } = useEmployees();

  useEffect(() => {
    if (group) {
      setSelectedMembers(group.memberIds);
    }
  }, [group]);

  if (!isOpen || !group) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(group.id, selectedMembers);
    onClose();
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Управление участниками</h2>
            <p className="text-sm text-slate-600 mt-1">{group.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="border border-slate-200 rounded">
            {users.map((user) => (
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
                <div className="w-8 h-8 rounded-full bg-brand-light flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-brand">{user.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900">{user.name}</div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                </div>
              </label>
            ))}
          </div>
          <div className="text-xs text-slate-500 mt-2">Выбрано: {selectedMembers.length}</div>

          <div className="flex items-center justify-end gap-2 pt-6 mt-6 border-t border-slate-200">
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
