import React, { useMemo, useState } from 'react';
import { useApp } from '../store/AppContext';
import { useEmployees } from '../store/EmployeesContext';
import { Plus, UserPlus, Edit, Settings, Trash2, X, KeyRound } from 'lucide-react';
import { CreateDepartmentModal } from '../components/CreateDepartmentModal';
import { CreateGroupModal } from '../components/CreateGroupModal';
import { CreateEmployeeModal } from '../components/CreateEmployeeModal';
import { EditEmployeeModal } from '../components/EditEmployeeModal';
import { EmployeeCatalogPanel } from '../components/EmployeeCatalogPanel';
import { EmployeeProfileModal } from '../components/EmployeeProfileModal';
import { ResetPasswordModal } from '../components/ResetPasswordModal';
import { ManageDepartmentMembersModal } from '../components/ManageDepartmentMembersModal';
import { ManageGroupMembersModal } from '../components/ManageGroupMembersModal';
import type { User, UserRole, Department, Group } from '../types';

type ViewMode = 'all' | 'catalog' | 'departments' | 'groups';

function MemberRow({ user, onRemove }: { user: User; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50">
      <div className="w-7 h-7 rounded-full bg-brand-light flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-medium text-brand">{user.name.charAt(0)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-slate-900 truncate">{user.name}</div>
        <div className="text-xs text-slate-500 truncate">{user.email}</div>
      </div>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Убрать"
        >
          <X className="w-4 h-4" />
        </button>
      ) : null}
    </div>
  );
}

export function Employees() {
  const { currentWorkspace, currentUser } = useApp();
  const {
    users,
    departments,
    groups,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    createGroup,
    updateGroup,
    deleteGroup,
    updateUser,
    updateDepartmentMembers,
    updateGroupMembers,
    refreshData,
  } = useEmployees();
  const canManageOrg = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const isAdmin = currentUser?.role === 'admin';
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [profileEmployee, setProfileEmployee] = useState<User | null>(null);
  const [createGroupDeptId, setCreateGroupDeptId] = useState<string>('');
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [departmentEditing, setDepartmentEditing] = useState<Department | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupEditing, setGroupEditing] = useState<Group | null>(null);
  const [isCreateEmployeeModalOpen, setIsCreateEmployeeModalOpen] = useState(false);
  const [isEditEmployeeModalOpen, setIsEditEmployeeModalOpen] = useState(false);
  const [isManageDepartmentMembersModalOpen, setIsManageDepartmentMembersModalOpen] = useState(false);
  const [isManageGroupMembersModalOpen, setIsManageGroupMembersModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [activeDeptId, setActiveDeptId] = useState<string>('');
  const [resetPasswordEmployee, setResetPasswordEmployee] = useState<User | null>(null);

  const handleSaveDepartment = async (data: { name: string; description: string }) => {
    if (!currentWorkspace) return;
    try {
      if (departmentEditing) {
        await updateDepartment(departmentEditing.id, data);
      } else {
        await createDepartment({ ...data, workspaceId: currentWorkspace.id });
      }
      setIsDepartmentModalOpen(false);
      setDepartmentEditing(null);
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : 'Не удалось сохранить отдел');
    }
  };

  const confirmDeleteDepartment = async (dept: Department) => {
    if (
      !window.confirm(
        `Удалить отдел «${dept.name}»? Сотрудники будут переведены в «Без отдела».`,
      )
    ) {
      return;
    }
    try {
      await deleteDepartment(dept.id);
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : 'Не удалось удалить отдел');
    }
  };

  const handleSaveGroup = async (data: {
    name: string;
    description: string;
    memberIds: string[];
    departmentId: string;
    leaderId: string | null;
  }) => {
    if (!currentWorkspace) return;
    try {
      if (groupEditing) {
        await updateGroup(groupEditing.id, {
          name: data.name,
          description: data.description,
          leaderId: data.leaderId,
        });
        await updateGroupMembers(groupEditing.id, data.memberIds);
      } else {
        await createGroup({
          name: data.name,
          description: data.description,
          memberIds: data.memberIds,
          workspaceId: currentWorkspace.id,
          departmentId: data.departmentId,
          leaderId: data.leaderId,
        });
      }
      setIsGroupModalOpen(false);
      setGroupEditing(null);
      setCreateGroupDeptId('');
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : 'Не удалось сохранить группу');
    }
  };

  const confirmDeleteGroup = async (group: Group) => {
    if (
      !window.confirm(
        `Удалить группу «${group.name}»? Участников нужно будет заново добавить в другие группы.`,
      )
    ) {
      return;
    }
    try {
      await deleteGroup(group.id);
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : 'Не удалось удалить группу');
    }
  };

  const handleEditEmployee = async (userId: string, data: { role: UserRole; departmentId?: string; groupIds: string[] }) => {
    await updateUser(userId, data);
    setIsEditEmployeeModalOpen(false);
    setSelectedEmployee(null);
  };

  const openEditEmployee = (user: User) => {
    if (!canManageOrg) return;
    setSelectedEmployee(user);
    setIsEditEmployeeModalOpen(true);
  };

  const openManageDepartmentMembers = (department: Department) => {
    setSelectedDepartment(department);
    setIsManageDepartmentMembersModalOpen(true);
  };

  const openManageGroupMembers = (group: Group) => {
    setSelectedGroup(group);
    setIsManageGroupMembersModalOpen(true);
  };

  const handleManageDepartmentMembers = async (departmentId: string, memberIds: string[]) => {
    await updateDepartmentMembers(departmentId, memberIds);
    setIsManageDepartmentMembersModalOpen(false);
    setSelectedDepartment(null);
  };

  const handleManageGroupMembers = async (groupId: string, memberIds: string[]) => {
    await updateGroupMembers(groupId, memberIds);
    setIsManageGroupMembersModalOpen(false);
    setSelectedGroup(null);
  };

  const workspaceDepartments = departments.filter(
    (d) => d.workspaceId === currentWorkspace?.id
  );
  const workspaceGroups = groups.filter((g) => g.workspaceId === currentWorkspace?.id);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const departmentById = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);

  const currentDept =
    workspaceDepartments.find((d) => d.id === activeDeptId) ?? workspaceDepartments[0] ?? null;
  const currentDeptMembers = currentDept
    ? users.filter((u) => u.departmentId === currentDept.id)
    : [];
  const currentDeptGroups = currentDept
    ? workspaceGroups.filter((g) => g.departmentId === currentDept.id)
    : [];

  const getUserDepartment = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    return user?.departmentId
      ? departments.find((d) => d.id === user.departmentId)?.name
      : 'Не указано';
  };

  const getUserGroups = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user?.groupIds || user.groupIds.length === 0) return 'Нет групп';
    return user.groupIds
      .map((gid) => groups.find((g) => g.id === gid)?.name)
      .filter(Boolean)
      .join(', ');
  };

  const getRoleName = (role: string) => {
    const roleNames: Record<string, string> = {
      admin: 'Администратор',
      manager: 'Менеджер',
      member: 'Сотрудник',
      guest: 'Гость',
    };
    return roleNames[role] || role;
  };

  const getGroupMembers = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    return group?.memberIds.length || 0;
  };

  const getDepartmentMembers = (deptId: string) => {
    return users.filter((u) => u.departmentId === deptId).length;
  };

  const removeFromDepartment = async (user: User) => {
    if (!window.confirm(`Убрать «${user.name}» из отдела?`)) return;
    try {
      await updateUser(user.id, { departmentId: undefined });
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : 'Не удалось убрать сотрудника из отдела');
    }
  };

  const removeFromGroup = async (user: User, groupId: string) => {
    if (!window.confirm(`Убрать «${user.name}» из направления?`)) return;
    try {
      const nextIds = (user.groupIds || []).filter((id) => id !== groupId);
      await updateUser(user.id, { groupIds: nextIds });
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : 'Не удалось убрать сотрудника из направления');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Сотрудники</h1>
          <p className="text-sm text-slate-600 mt-1">
            Управление пользователями, отделами и группами
          </p>
        </div>
        {canManageOrg ? (
          <button
            onClick={() => setIsCreateEmployeeModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded hover:bg-brand-primary-hover transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Добавить сотрудника
          </button>
        ) : null}
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setViewMode('catalog')}
          className={`px-4 py-2 text-sm rounded transition-colors ${
            viewMode === 'catalog'
              ? 'bg-brand-light text-brand'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Каталог договоров
        </button>
        <button
          onClick={() => setViewMode('all')}
          className={`px-4 py-2 text-sm rounded transition-colors ${
            viewMode === 'all'
              ? 'bg-brand-light text-brand'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Все сотрудники
        </button>
        <button
          onClick={() => setViewMode('departments')}
          className={`px-4 py-2 text-sm rounded transition-colors ${
            viewMode === 'departments'
              ? 'bg-brand-light text-brand'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Отделы
        </button>
        <button
          onClick={() => setViewMode('groups')}
          className={`px-4 py-2 text-sm rounded transition-colors ${
            viewMode === 'groups'
              ? 'bg-brand-light text-brand'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Направления
        </button>
      </div>

      {viewMode === 'catalog' && currentWorkspace ? (
        <EmployeeCatalogPanel
          workspaceId={currentWorkspace.id}
          departments={workspaceDepartments}
          groups={workspaceGroups}
          canManage={canManageOrg}
          onOpenProfile={(user) => setProfileEmployee(user)}
        />
      ) : null}

      {viewMode === 'all' && (
        <div className="bg-white rounded-lg border border-slate-200">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">
                  Сотрудник
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">
                  Email
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">
                  Роль
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">
                  Отдел
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">
                  Группы
                </th>
                {canManageOrg ? (
                  <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">
                    Действия
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-medium text-brand">
                          {user.name.charAt(0)}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-slate-900">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{user.email}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{getRoleName(user.role)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{getUserDepartment(user.id)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{getUserGroups(user.id)}</span>
                  </td>
                  {canManageOrg ? (
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setProfileEmployee(user)}
                          className="p-1.5 text-slate-600 hover:text-brand hover:bg-brand-light rounded transition-colors"
                          title="Карточка"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditEmployee(user)}
                          className="p-1.5 text-slate-600 hover:text-brand hover:bg-brand-light rounded transition-colors"
                          title="Оргструктура"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        {isAdmin && user.id !== currentUser?.id ? (
                          <button
                            type="button"
                            onClick={() => setResetPasswordEmployee(user)}
                            className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                            title="Сбросить пароль"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'departments' && (
        <div>
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-medium text-slate-900">Отдел</h2>
              {workspaceDepartments.length > 0 ? (
                <select
                  value={currentDept?.id ?? ''}
                  onChange={(e) => setActiveDeptId(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand min-w-[200px]"
                >
                  {workspaceDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            {canManageOrg ? (
              <button
                type="button"
                onClick={() => {
                  setDepartmentEditing(null);
                  setIsDepartmentModalOpen(true);
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-white text-slate-700 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Создать отдел
              </button>
            ) : null}
          </div>

          {!currentDept ? (
            <div className="bg-white rounded-lg border border-slate-200 p-10 text-center text-sm text-slate-500">
              Отделы ещё не созданы
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-lg border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-medium text-slate-900 truncate">{currentDept.name}</h3>
                    {currentDept.description ? (
                      <p className="text-sm text-slate-600 mt-1">{currentDept.description}</p>
                    ) : null}
                  </div>
                  {canManageOrg ? (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setDepartmentEditing(currentDept);
                          setIsDepartmentModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-brand hover:bg-brand-light rounded transition-colors"
                        title="Редактировать отдел"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void confirmDeleteDepartment(currentDept)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Удалить отдел"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <div className="bg-white rounded-lg border border-slate-200 p-5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h4 className="text-sm font-medium text-slate-700">
                      Сотрудники отдела
                      <span className="ml-1 text-slate-400">({currentDeptMembers.length})</span>
                    </h4>
                    {canManageOrg ? (
                      <button
                        type="button"
                        onClick={() => openManageDepartmentMembers(currentDept)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-brand hover:bg-brand-light rounded transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Добавить в отдел
                      </button>
                    ) : null}
                  </div>
                  <div className="space-y-1 max-h-[28rem] overflow-y-auto">
                    {currentDeptMembers.length === 0 ? (
                      <div className="text-sm text-slate-400 py-6 text-center border border-dashed border-slate-200 rounded">
                        В отделе пока нет сотрудников
                      </div>
                    ) : (
                      currentDeptMembers.map((u) => (
                        <MemberRow
                          key={u.id}
                          user={u}
                          onRemove={canManageOrg ? () => void removeFromDepartment(u) : undefined}
                        />
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium text-slate-700">Направления / продукты</h4>
                    {canManageOrg ? (
                      <button
                        type="button"
                        onClick={() => {
                          setGroupEditing(null);
                          setCreateGroupDeptId(currentDept.id);
                          setIsGroupModalOpen(true);
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-brand hover:bg-brand-light rounded transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Добавить направление
                      </button>
                    ) : null}
                  </div>
                  {currentDeptGroups.length === 0 ? (
                    <p className="text-sm text-slate-400 py-2 text-center">Нет направлений в этом отделе</p>
                  ) : (
                    <div className="space-y-3">
                      {currentDeptGroups.map((group) => {
                      const members = users.filter((u) => (u.groupIds || []).includes(group.id));
                      return (
                        <div key={group.id} className="bg-white rounded-lg border border-slate-200 p-4">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="min-w-0">
                              <h5 className="font-medium text-slate-900 truncate">{group.name}</h5>
                              {group.description ? (
                                <p className="text-xs text-slate-500 mt-0.5">{group.description}</p>
                              ) : null}
                              <p className="text-xs text-slate-600 mt-0.5">
                                Руководитель:{' '}
                                <span className={group.leader ? 'font-medium text-slate-800' : 'text-slate-400'}>
                                  {group.leader?.name ?? 'не назначен'}
                                </span>
                              </p>
                            </div>
                            {canManageOrg ? (
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => openManageGroupMembers(group)}
                                  className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                  title="Добавить в направление"
                                >
                                  <UserPlus className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setGroupEditing(group);
                                    setCreateGroupDeptId(currentDept.id);
                                    setIsGroupModalOpen(true);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-brand hover:bg-brand-light rounded transition-colors"
                                  title="Редактировать направление"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void confirmDeleteGroup(group)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Удалить направление"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ) : null}
                          </div>
                          <div className="space-y-1 max-h-60 overflow-y-auto">
                            {members.length === 0 ? (
                              <div className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded">
                                Нет участников
                              </div>
                            ) : (
                              members.map((u) => (
                                <MemberRow
                                  key={u.id}
                                  user={u}
                                  onRemove={canManageOrg ? () => void removeFromGroup(u, group.id) : undefined}
                                />
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === 'groups' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-medium text-slate-900">Направления / продукты</h2>
              <p className="text-sm text-slate-600 mt-1">Сгруппировано по отделам</p>
            </div>
          </div>
          <div className="space-y-8">
            {workspaceDepartments.map((dept) => {
              const deptGroups = workspaceGroups.filter((g) => g.departmentId === dept.id);
              return (
                <div key={dept.id}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-base font-medium text-slate-900">{dept.name}</h3>
                    {canManageOrg ? (
                      <button
                        type="button"
                        onClick={() => {
                          setGroupEditing(null);
                          setCreateGroupDeptId(dept.id);
                          setIsGroupModalOpen(true);
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-brand hover:bg-brand-light rounded transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Добавить направление
                      </button>
                    ) : null}
                  </div>
                  {deptGroups.length === 0 ? (
                    <p className="text-sm text-slate-400 py-2">Нет направлений в этом отделе</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {deptGroups.map((group) => {
                        const members = users.filter((u) => (u.groupIds || []).includes(group.id));
                        return (
                          <div key={group.id} className="bg-white rounded-lg border border-slate-200 p-4">
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="min-w-0">
                                <h5 className="font-medium text-slate-900 truncate">{group.name}</h5>
                                {group.description ? (
                                  <p className="text-xs text-slate-500 mt-0.5">{group.description}</p>
                                ) : null}
                                <p className="text-xs text-slate-600 mt-0.5">
                                  Руководитель:{' '}
                                  <span className={group.leader ? 'font-medium text-slate-800' : 'text-slate-400'}>
                                    {group.leader?.name ?? 'не назначен'}
                                  </span>
                                </p>
                              </div>
                              {canManageOrg ? (
                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => openManageGroupMembers(group)}
                                    className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                    title="Добавить в направление"
                                  >
                                    <UserPlus className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setGroupEditing(group);
                                      setCreateGroupDeptId(dept.id);
                                      setIsGroupModalOpen(true);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-brand hover:bg-brand-light rounded transition-colors"
                                    title="Редактировать направление"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void confirmDeleteGroup(group)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Удалить направление"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : null}
                            </div>
                            <div className="space-y-1 max-h-60 overflow-y-auto">
                              {members.length === 0 ? (
                                <div className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded">
                                  Нет участников
                                </div>
                              ) : (
                                members.map((u) => (
                                  <MemberRow
                                    key={u.id}
                                    user={u}
                                    onRemove={canManageOrg ? () => void removeFromGroup(u, group.id) : undefined}
                                  />
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {workspaceDepartments.length === 0 ? (
              <div className="bg-white rounded-lg border border-slate-200 p-10 text-center text-sm text-slate-500">
                Сначала создайте отдел
              </div>
            ) : null}
          </div>
        </div>
      )}

      <CreateDepartmentModal
        isOpen={isDepartmentModalOpen}
        editingDepartment={departmentEditing}
        onClose={() => {
          setIsDepartmentModalOpen(false);
          setDepartmentEditing(null);
        }}
        onSubmit={handleSaveDepartment}
      />

      <CreateGroupModal
        isOpen={isGroupModalOpen}
        editingGroup={groupEditing}
        departments={workspaceDepartments}
        defaultDepartmentId={createGroupDeptId}
        onClose={() => {
          setIsGroupModalOpen(false);
          setGroupEditing(null);
          setCreateGroupDeptId('');
        }}
        onSubmit={handleSaveGroup}
      />

      {canManageOrg ? (
        <CreateEmployeeModal
          isOpen={isCreateEmployeeModalOpen}
          onClose={() => setIsCreateEmployeeModalOpen(false)}
        />
      ) : null}

      <ResetPasswordModal
        open={!!resetPasswordEmployee}
        employee={resetPasswordEmployee}
        onClose={() => setResetPasswordEmployee(null)}
      />

      {canManageOrg ? (
        <EditEmployeeModal
          isOpen={isEditEmployeeModalOpen}
          onClose={() => {
            setIsEditEmployeeModalOpen(false);
            setSelectedEmployee(null);
          }}
          onSubmit={handleEditEmployee}
          employee={selectedEmployee}
        />
      ) : null}

      {canManageOrg ? (
        <>
          <ManageDepartmentMembersModal
            isOpen={isManageDepartmentMembersModalOpen}
            onClose={() => {
              setIsManageDepartmentMembersModalOpen(false);
              setSelectedDepartment(null);
            }}
            onSubmit={handleManageDepartmentMembers}
            department={selectedDepartment}
          />

          <ManageGroupMembersModal
            isOpen={isManageGroupMembersModalOpen}
            onClose={() => {
              setIsManageGroupMembersModalOpen(false);
              setSelectedGroup(null);
            }}
            onSubmit={handleManageGroupMembers}
            group={selectedGroup}
          />
        </>
      ) : null}

      {currentWorkspace ? (
        <EmployeeProfileModal
          isOpen={profileEmployee != null}
          workspaceId={currentWorkspace.id}
          employee={profileEmployee}
          onClose={() => setProfileEmployee(null)}
          onSaved={() => void refreshData()}
        />
      ) : null}
    </div>
  );
}
