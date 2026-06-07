import { useCallback, useEffect, useMemo, useState } from 'react';
import { Filter, FileText } from 'lucide-react';
import type { Department, Group, User } from '../types';
import { usersApi } from '../services/api';
import { profileValue } from '../utils/employeeProfileForm';

type CatalogFilters = {
  q: string;
  departmentId: string;
  groupId: string;
  contractorStatus: string;
  expiringWithinDays: string;
};

const emptyFilters: CatalogFilters = {
  q: '',
  departmentId: '',
  groupId: '',
  contractorStatus: '',
  expiringWithinDays: '',
};

type Props = {
  workspaceId: string;
  departments: Department[];
  groups: Group[];
  canManage: boolean;
  onOpenProfile: (user: User) => void;
};

export function EmployeeCatalogPanel({
  workspaceId,
  departments,
  groups,
  canManage,
  onOpenProfile,
}: Props) {
  const [filters, setFilters] = useState<CatalogFilters>(emptyFilters);
  const [applied, setApplied] = useState<CatalogFilters>(emptyFilters);
  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupsInDept = useMemo(() => {
    if (!applied.departmentId) return groups;
    return groups.filter((g) => g.departmentId === applied.departmentId);
  }, [groups, applied.departmentId]);

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setError(null);
    try {
      const data = await usersApi.getCatalog(workspaceId, {
        q: applied.q || undefined,
        departmentId: applied.departmentId || undefined,
        groupId: applied.groupId || undefined,
        contractorStatus: applied.contractorStatus || undefined,
        expiringWithinDays: applied.expiringWithinDays || undefined,
      });
      setRows(data as User[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить каталог');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, applied, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canManage) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        Каталог договоров доступен администраторам и руководителям.
      </div>
    );
  }

  const deptName = (id?: string) =>
    id ? departments.find((d) => d.id === id)?.name ?? '—' : '—';

  const groupNames = (user: User) => {
    if (!user.groupIds?.length) return '—';
    return user.groupIds
      .map((gid) => groups.find((g) => g.id === gid)?.name)
      .filter(Boolean)
      .join(', ');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-800">
          <Filter className="size-4" aria-hidden />
          Фильтры
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input
            type="search"
            placeholder="Поиск: ФИО, email, № договора…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={filters.departmentId}
            onChange={(e) =>
              setFilters((f) => ({ ...f, departmentId: e.target.value, groupId: '' }))
            }
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Все отделы</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            value={filters.groupId}
            onChange={(e) => setFilters((f) => ({ ...f, groupId: e.target.value }))}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Все направления</option>
            {groupsInDept.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select
            value={filters.contractorStatus}
            onChange={(e) => setFilters((f) => ({ ...f, contractorStatus: e.target.value }))}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Любой статус</option>
            <option value="Самозанятый">Самозанятый</option>
            <option value="ФЛ">ФЛ</option>
            <option value="ЮЛ">ЮЛ</option>
          </select>
          <select
            value={filters.expiringWithinDays}
            onChange={(e) => setFilters((f) => ({ ...f, expiringWithinDays: e.target.value }))}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Срок действия</option>
            <option value="7">Истекает за 7 дней</option>
            <option value="30">Истекает за 30 дней</option>
            <option value="90">Истекает за 90 дней</option>
          </select>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setApplied({ ...filters })}
            className="rounded bg-brand px-3 py-2 text-sm text-white hover:bg-brand-hover"
          >
            Применить
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters(emptyFilters);
              setApplied(emptyFilters);
            }}
            className="rounded border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Сбросить
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
              <th className="px-4 py-3 font-medium">ФИО</th>
              <th className="px-4 py-3 font-medium">№ договора</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Отдел</th>
              <th className="px-4 py-3 font-medium">Направление</th>
              <th className="px-4 py-3 font-medium">Роль</th>
              <th className="px-4 py-3 font-medium">Срок до</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Загрузка…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Нет сотрудников по фильтрам
                </td>
              </tr>
            ) : (
              rows.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {profileValue(user.profileFields, 'fullName') || user.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {profileValue(user.profileFields, 'contractNumber') || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {profileValue(user.profileFields, 'contractorStatus') || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{deptName(user.departmentId)}</td>
                  <td className="px-4 py-3 text-slate-600">{groupNames(user)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {profileValue(user.profileFields, 'jobTitle') || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {profileValue(user.profileFields, 'contractEndDate') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOpenProfile(user)}
                      className="inline-flex items-center gap-1 text-brand hover:underline"
                    >
                      <FileText className="size-4" aria-hidden />
                      Карточка
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
