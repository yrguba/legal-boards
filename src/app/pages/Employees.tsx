import { useState } from 'react';
import { users, departments, groups } from '../store/mockData';
import { useApp } from '../store/AppContext';
import { Plus, Users as UsersIcon, Building, UserPlus, Edit, Settings } from 'lucide-react';
import { CreateDepartmentModal } from '../components/CreateDepartmentModal';
import { CreateGroupModal } from '../components/CreateGroupModal';
import { EditEmployeeModal } from '../components/EditEmployeeModal';
import { ManageDepartmentMembersModal } from '../components/ManageDepartmentMembersModal';
import { ManageGroupMembersModal } from '../components/ManageGroupMembersModal';
import type { User, UserRole, Department, Group } from '../types';

type ViewMode = 'all' | 'departments' | 'groups';

export function Employees() {
  const { currentWorkspace } = useApp();
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isEditEmployeeModalOpen, setIsEditEmployeeModalOpen] = useState(false);
  const [isManageDepartmentMembersModalOpen, setIsManageDepartmentMembersModalOpen] = useState(false);
  const [isManageGroupMembersModalOpen, setIsManageGroupMembersModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  const handleCreateDepartment = (data: { name: string; description: string }) => {
    console.log('Creating department:', data);
  };

  const handleCreateGroup = (data: { name: string; description: string; memberIds: string[] }) => {
    console.log('Creating group:', data);
  };

  const handleEditEmployee = (userId: string, data: { role: UserRole; departmentId?: string; groupIds: string[] }) => {
    console.log('Editing employee:', userId, data);
  };

  const openEditEmployee = (user: User) => {
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

  const handleManageDepartmentMembers = (departmentId: string, memberIds: string[]) => {
    console.log('Managing department members:', departmentId, memberIds);
  };

  const handleManageGroupMembers = (groupId: string, memberIds: string[]) => {
    console.log('Managing group members:', groupId, memberIds);
  };

  const workspaceDepartments = departments.filter(
    (d) => d.workspaceId === currentWorkspace?.id
  );
  const workspaceGroups = groups.filter((g) => g.workspaceId === currentWorkspace?.id);

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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Сотрудники</h1>
          <p className="text-sm text-slate-600 mt-1">
            Управление пользователями, отделами и группами
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-colors">
          <UserPlus className="w-4 h-4" />
          Добавить сотрудника
        </button>
      </div>

      <div className="flex gap-2 mb-6">
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
          Группы
        </button>
      </div>

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
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">
                  Действия
                </th>
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
                  <td className="px-6 py-4">
                    <button
                      onClick={() => openEditEmployee(user)}
                      className="p-1.5 text-slate-600 hover:text-brand hover:bg-brand-light rounded transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'departments' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-slate-900">Отделы</h2>
            <button
              onClick={() => setIsDepartmentModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-white text-slate-700 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Создать отдел
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaceDepartments.map((dept) => (
              <div
                key={dept.id}
                className="bg-white rounded-lg border border-slate-200 p-5 hover:border-brand hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-brand" />
                    <h3 className="font-medium text-slate-900">{dept.name}</h3>
                  </div>
                  <button
                    onClick={() => openManageDepartmentMembers(dept)}
                    className="p-1.5 text-slate-400 hover:text-brand hover:bg-brand-light rounded transition-colors"
                    title="Управление участниками"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
                {dept.description && (
                  <p className="text-sm text-slate-600 mb-3">{dept.description}</p>
                )}
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <UsersIcon className="w-4 h-4" />
                  <span>{getDepartmentMembers(dept.id)} сотрудников</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'groups' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-slate-900">Группы</h2>
            <button
              onClick={() => setIsGroupModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-white text-slate-700 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Создать группу
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaceGroups.map((group) => (
              <div
                key={group.id}
                className="bg-white rounded-lg border border-slate-200 p-5 hover:border-brand hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="w-5 h-5 text-green-600" />
                    <h3 className="font-medium text-slate-900">{group.name}</h3>
                  </div>
                  <button
                    onClick={() => openManageGroupMembers(group)}
                    className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                    title="Управление участниками"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
                {group.description && (
                  <p className="text-sm text-slate-600 mb-3">{group.description}</p>
                )}
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <UsersIcon className="w-4 h-4" />
                  <span>{getGroupMembers(group.id)} участников</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <CreateDepartmentModal
        isOpen={isDepartmentModalOpen}
        onClose={() => setIsDepartmentModalOpen(false)}
        onSubmit={handleCreateDepartment}
      />

      <CreateGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onSubmit={handleCreateGroup}
      />

      <EditEmployeeModal
        isOpen={isEditEmployeeModalOpen}
        onClose={() => {
          setIsEditEmployeeModalOpen(false);
          setSelectedEmployee(null);
        }}
        onSubmit={handleEditEmployee}
        employee={selectedEmployee}
      />

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
    </div>
  );
}
