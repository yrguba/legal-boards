import { useMemo, useState } from 'react';
import { useApp } from '../store/AppContext';
import { useEmployees } from '../store/EmployeesContext';
import { Plus, Users as UsersIcon, Building, UserPlus, Edit, Settings } from 'lucide-react';
import { CreateDepartmentModal } from '../components/CreateDepartmentModal';
import { CreateGroupModal } from '../components/CreateGroupModal';
import { CreateEmployeeModal } from '../components/CreateEmployeeModal';
import { EditEmployeeModal } from '../components/EditEmployeeModal';
import { ManageDepartmentMembersModal } from '../components/ManageDepartmentMembersModal';
import { ManageGroupMembersModal } from '../components/ManageGroupMembersModal';
import type { User, UserRole, Department, Group } from '../types';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

type ViewMode = 'all' | 'departments' | 'groups';

function DraggableEmployee({ user, from }: { user: User; from: { kind: 'dept' | 'group' | 'none'; id?: string } }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useDraggable({
    id: user.id,
    data: { userId: user.id, from },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <div className="w-7 h-7 rounded-full bg-brand-light flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-medium text-brand">{user.name.charAt(0)}</span>
      </div>
      <div className="min-w-0">
        <div className="text-sm text-slate-900 truncate">{user.name}</div>
        <div className="text-xs text-slate-500 truncate">{user.email}</div>
      </div>
    </div>
  );
}

function DroppableBox({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`bg-white rounded-lg border p-5 transition-colors ${
        isOver ? 'border-brand ring-2 ring-brand/20' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="font-medium text-slate-900 truncate">{title}</h3>
          {subtitle && <p className="text-sm text-slate-600 mt-1">{subtitle}</p>}
        </div>
      </div>
      <div className="space-y-1 max-h-72 overflow-y-auto">{children}</div>
    </div>
  );
}

export function Employees() {
  const { currentWorkspace } = useApp();
  const { users, departments, groups, createDepartment, createGroup, updateUser, updateDepartmentMembers, updateGroupMembers } = useEmployees();
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isCreateEmployeeModalOpen, setIsCreateEmployeeModalOpen] = useState(false);
  const [isEditEmployeeModalOpen, setIsEditEmployeeModalOpen] = useState(false);
  const [isManageDepartmentMembersModalOpen, setIsManageDepartmentMembersModalOpen] = useState(false);
  const [isManageGroupMembersModalOpen, setIsManageGroupMembersModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [dndError, setDndError] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleCreateDepartment = async (data: { name: string; description: string }) => {
    if (!currentWorkspace) return;
    await createDepartment({ ...data, workspaceId: currentWorkspace.id });
    setIsDepartmentModalOpen(false);
  };

  const handleCreateGroup = async (data: { name: string; description: string; memberIds: string[] }) => {
    if (!currentWorkspace) return;
    await createGroup({ ...data, workspaceId: currentWorkspace.id });
    setIsGroupModalOpen(false);
  };

  const handleEditEmployee = async (userId: string, data: { role: UserRole; departmentId?: string; groupIds: string[] }) => {
    await updateUser(userId, data);
    setIsEditEmployeeModalOpen(false);
    setSelectedEmployee(null);
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

  const handleDragEnd = async (event: DragEndEvent) => {
    setDndError(null);
    const over = event.over;
    const active = event.active;
    if (!over) return;

    const userId = String(active.id);
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    const data: any = active.data?.current;
    const from = data?.from as { kind: 'dept' | 'group' | 'none'; id?: string } | undefined;
    const overId = String(over.id);

    try {
      if (overId.startsWith('dept:')) {
        const deptId = overId.replace('dept:', '');
        const nextDeptId = deptId === 'none' ? undefined : deptId;
        if (user.departmentId === nextDeptId) return;
        await updateUser(user.id, { departmentId: nextDeptId });
        return;
      }

      if (overId.startsWith('group:')) {
        const targetGroupId = overId.replace('group:', '');
        const currentIds = user.groupIds || [];
        const fromGroupId = from?.kind === 'group' ? from.id : undefined;

        let nextIds = currentIds;

        if (targetGroupId === 'none') {
          // Removing from the source group. If dragged from "no group", nothing to do.
          if (!fromGroupId) return;
          nextIds = currentIds.filter((id) => id !== fromGroupId);
        } else {
          // move if dragged from a group; otherwise just add
          nextIds = currentIds;
          if (!nextIds.includes(targetGroupId)) nextIds = [...nextIds, targetGroupId];
          if (fromGroupId && fromGroupId !== targetGroupId) {
            nextIds = nextIds.filter((id) => id !== fromGroupId);
          }
        }

        // No-op
        const a = [...currentIds].sort().join(',');
        const b = [...nextIds].sort().join(',');
        if (a === b) return;

        await updateUser(user.id, { groupIds: nextIds });
        return;
      }
    } catch (e: any) {
      setDndError(e?.message || 'Не удалось переместить сотрудника');
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
        <button
          onClick={() => setIsCreateEmployeeModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded hover:bg-brand-primary-hover transition-colors"
        >
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

      {dndError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {dndError}
        </div>
      )}

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
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <DroppableBox id="dept:none" title="Без отдела" subtitle="Перетащите сюда, чтобы убрать отдел">
                {users
                  .filter((u) => !u.departmentId)
                  .map((u) => (
                    <DraggableEmployee key={u.id} user={u} from={{ kind: 'dept', id: 'none' }} />
                  ))}
              </DroppableBox>

              {workspaceDepartments.map((dept) => (
                <div key={dept.id} className="relative">
                  <DroppableBox id={`dept:${dept.id}`} title={dept.name} subtitle={dept.description}>
                    {users
                      .filter((u) => u.departmentId === dept.id)
                      .map((u) => (
                        <DraggableEmployee key={u.id} user={u} from={{ kind: 'dept', id: dept.id }} />
                      ))}
                    {users.filter((u) => u.departmentId === dept.id).length === 0 && (
                      <div className="text-sm text-slate-400 py-6 text-center border border-dashed border-slate-200 rounded">
                        Перетащите сотрудника сюда
                      </div>
                    )}
                  </DroppableBox>
                  <button
                    onClick={() => openManageDepartmentMembers(dept)}
                    className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-brand hover:bg-brand-light rounded transition-colors"
                    title="Управление участниками"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </DndContext>
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
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <DroppableBox
                id="group:none"
                title="Без группы"
                subtitle="Перетаскивайте отсюда в группы или сюда из группы, чтобы убрать"
              >
                {users
                  .filter((u) => !u.groupIds || u.groupIds.length === 0)
                  .map((u) => (
                    <DraggableEmployee key={u.id} user={u} from={{ kind: 'none' }} />
                  ))}
                {users.filter((u) => !u.groupIds || u.groupIds.length === 0).length === 0 && (
                  <div className="text-sm text-slate-400 py-6 text-center border border-dashed border-slate-200 rounded">
                    Все сотрудники уже в группах
                  </div>
                )}
              </DroppableBox>

              {workspaceGroups.map((group) => (
                <div key={group.id} className="relative">
                  <DroppableBox id={`group:${group.id}`} title={group.name} subtitle={group.description}>
                    {users
                      .filter((u) => (u.groupIds || []).includes(group.id))
                      .map((u) => (
                        <DraggableEmployee key={u.id} user={u} from={{ kind: 'group', id: group.id }} />
                      ))}
                    {users.filter((u) => (u.groupIds || []).includes(group.id)).length === 0 && (
                      <div className="text-sm text-slate-400 py-6 text-center border border-dashed border-slate-200 rounded">
                        Перетащите сотрудника сюда
                      </div>
                    )}
                  </DroppableBox>
                  <button
                    onClick={() => openManageGroupMembers(group)}
                    className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                    title="Управление участниками"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </DndContext>
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

      <CreateEmployeeModal
        isOpen={isCreateEmployeeModalOpen}
        onClose={() => setIsCreateEmployeeModalOpen(false)}
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
