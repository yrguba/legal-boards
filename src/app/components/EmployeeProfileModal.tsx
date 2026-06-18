import { useEffect, useMemo, useState } from 'react';
import { X, Lock } from 'lucide-react';
import type { EmployeeProfileField, User } from '../types';
import { usersApi, workspacesApi } from '../services/api';
import { buildProfileFormState, renderProfileFieldInput } from '../utils/employeeProfileForm';
import { useApp } from '../store/AppContext';
import { useEmployees } from '../store/EmployeesContext';

type Props = {
  isOpen: boolean;
  workspaceId: string;
  employee: User | null;
  onClose: () => void;
  onSaved: () => void;
};

const SECTION_ORDER = [
  'Личные данные',
  'Статус и работа',
  'Данные договора',
  'Банковские данные',
];

function addOneYear(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const d = new Date(`${iso}T00:00:00`);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export function EmployeeProfileModal({
  isOpen,
  workspaceId,
  employee,
  onClose,
  onSaved,
}: Props) {
  const { currentUser } = useApp();
  const { groups } = useEmployees();
  const [schema, setSchema] = useState<EmployeeProfileField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canViewConfidential = useMemo(() => {
    if (!currentUser || !employee) return false;
    if (currentUser.id === employee.id) return true;
    if (currentUser.role === 'admin') return true;
    const empGroups = employee.groupIds ?? [];
    return groups.some((g) => g.leaderId === currentUser.id && empGroups.includes(g.id));
  }, [currentUser, employee, groups]);

  useEffect(() => {
    if (!isOpen || !employee || !workspaceId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [fields, full] = await Promise.all([
          workspacesApi.getEmployeeProfileFields(workspaceId),
          usersApi.getById(employee.id),
        ]);
        if (cancelled) return;
        setSchema(fields as EmployeeProfileField[]);
        setValues(
          buildProfileFormState(fields as EmployeeProfileField[], full.profileFields ?? {}),
        );
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Не удалось загрузить профиль');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, employee?.id, workspaceId]);

  const sections = useMemo(() => {
    const visible = schema.filter((f) => (f.confidential ? canViewConfidential : true));
    const map = new Map<string, EmployeeProfileField[]>();
    for (const f of visible) {
      const sec = f.section || 'Профиль';
      const list = map.get(sec) ?? [];
      list.push(f);
      map.set(sec, list);
    }
    const order = (sec: string) => {
      const i = SECTION_ORDER.indexOf(sec);
      return i === -1 ? SECTION_ORDER.length : i;
    };
    return [...map.entries()].sort((a, b) => order(a[0]) - order(b[0]));
  }, [schema, canViewConfidential]);

  const hasHiddenConfidential = useMemo(
    () => !canViewConfidential && schema.some((f) => f.confidential),
    [canViewConfidential, schema],
  );

  if (!isOpen || !employee) return null;

  const handleChange = (key: string, value: string) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      // По умолчанию срок действия договора — год от даты начала
      if (key === 'contractStartDate' && value && !prev.contractEndDate) {
        const end = addOneYear(value);
        if (end) next.contractEndDate = end;
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v.trim() !== ''),
      );
      await usersApi.updateProfile(employee.id, workspaceId, payload);
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Карточка сотрудника</h2>
            <p className="text-sm text-slate-500 mt-0.5">{employee.name}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <p className="text-sm text-slate-500">Загрузка…</p>
          ) : (
            <>
              {sections.map(([section, fields]) => {
                const sectionConfidential = fields.some((f) => f.confidential);
                return (
                  <div key={section}>
                    <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
                      {section}
                      {sectionConfidential ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-normal text-amber-600"
                          title="Конфиденциально: видно сотруднику, руководителю направления и администратору"
                        >
                          <Lock className="w-3 h-3" />
                          конфиденциально
                        </span>
                      ) : null}
                    </h3>
                    <div className="space-y-3">
                      {fields.map((field) => (
                        <div key={field.id}>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            {field.name}
                            {field.required ? ' *' : ''}
                          </label>
                          {renderProfileFieldInput(field, values[field.key] ?? '', handleChange)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {hasHiddenConfidential ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Личные и банковские данные скрыты: доступны сотруднику, руководителю направления и администратору.
                </div>
              ) : null}
            </>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover disabled:opacity-50"
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
