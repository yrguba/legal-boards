import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { User, Department, Group, UserRole } from '../types';
import { users as initialUsers } from './mockData';
import { usersApi, departmentsApi, groupsApi, workspacesApi } from '../services/api';
import { useApp } from './AppContext';

interface EmployeesContextType {
  users: User[];
  departments: Department[];
  groups: Group[];
  loading: boolean;
  error: string | null;
  createDepartment: (data: { name: string; description: string; workspaceId: string }) => Promise<void>;
  updateDepartment: (
    id: string,
    data: { name?: string; description?: string },
  ) => Promise<void>;
  deleteDepartment: (id: string) => Promise<void>;
  createGroup: (data: {
    name: string;
    description: string;
    memberIds: string[];
    workspaceId: string;
    departmentId: string;
    leaderId?: string | null;
  }) => Promise<void>;
  updateGroup: (
    id: string,
    data: { name?: string; description?: string; leaderId?: string | null },
  ) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  createUser: (data: { email: string; name: string; role: UserRole; workspaceId: string; departmentId?: string; groupIds?: string[]; password?: string }) => Promise<{ email?: string; inviteSent?: boolean; inviteUrl?: string; initialPassword?: string } | void>;
  inviteExistingUser: (data: { email: string; role: UserRole; workspaceId: string; departmentId?: string; groupIds?: string[] }) => Promise<{ emailSent: boolean }>;
  updateUser: (userId: string, data: { name?: string; role?: UserRole; departmentId?: string; groupIds?: string[] }) => Promise<void>;
  updateDepartmentMembers: (departmentId: string, memberIds: string[]) => Promise<void>;
  updateGroupMembers: (groupId: string, memberIds: string[]) => Promise<void>;
  refreshData: () => Promise<void>;
}

const EmployeesContext = createContext<EmployeesContextType | undefined>(undefined);

export function EmployeesProvider({ children }: { children: ReactNode }) {
  const { currentWorkspace, isAuthenticated } = useApp();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshData = async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const [fetchedUsers, fetchedDepartments, fetchedGroups] = await Promise.all([
        currentWorkspace ? usersApi.getByWorkspace(currentWorkspace.id) : Promise.resolve([]),
        currentWorkspace ? departmentsApi.getByWorkspace(currentWorkspace.id) : Promise.resolve([]),
        currentWorkspace ? groupsApi.getByWorkspace(currentWorkspace.id) : Promise.resolve([]),
      ]);

      setUsers(fetchedUsers);
      setDepartments(fetchedDepartments);
      setGroups(fetchedGroups);
    } catch (err: any) {
      console.error('Failed to refresh data:', err);
      setError(err.message || 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [currentWorkspace?.id, isAuthenticated]);

  const createDepartment = async (data: { name: string; description: string; workspaceId: string }) => {
    const newDepartment = await departmentsApi.create(data);
    setDepartments([...departments, newDepartment]);
  };

  const updateDepartment = async (id: string, data: { name?: string; description?: string }) => {
    await departmentsApi.update(id, data);
    await refreshData();
  };

  const deleteDepartment = async (id: string) => {
    await departmentsApi.delete(id);
    await refreshData();
  };

  const createGroup = async (data: {
    name: string;
    description: string;
    memberIds: string[];
    workspaceId: string;
    departmentId: string;
    leaderId?: string | null;
  }) => {
    const newGroup = await groupsApi.create(data);
    await refreshData();
    void newGroup;
  };

  const updateGroup = async (
    id: string,
    data: { name?: string; description?: string; leaderId?: string | null },
  ) => {
    await groupsApi.update(id, data);
    await refreshData();
  };

  const deleteGroup = async (id: string) => {
    await groupsApi.delete(id);
    await refreshData();
  };

  const createUser = async (data: { email: string; name: string; role: UserRole; workspaceId: string; departmentId?: string; groupIds?: string[]; password?: string }) => {
    const created = await usersApi.create(data);
    await refreshData();
    return {
      email: created?.email as string | undefined,
      inviteSent: !!created?.inviteSent,
      inviteUrl: created?.inviteUrl as string | undefined,
      initialPassword:
        typeof created?.initialPassword === 'string' ? created.initialPassword : undefined,
    };
  };

  const inviteExistingUser = async (data: {
    email: string;
    role: UserRole;
    workspaceId: string;
    departmentId?: string;
    groupIds?: string[];
  }) => {
    const res = await workspacesApi.createInvite(data.workspaceId, {
      email: data.email,
      role: data.role,
      departmentId: data.departmentId,
      groupIds: data.groupIds,
    });
    await refreshData();
    return { emailSent: !!res.emailSent };
  };

  const updateUser = async (userId: string, data: { name?: string; role?: UserRole; departmentId?: string; groupIds?: string[] }) => {
    if (!currentWorkspace?.id) {
      throw new Error('Пространство не выбрано');
    }
    try {
      const updatedUser = await usersApi.update(userId, {
        ...data,
        workspaceId: currentWorkspace.id,
      });
      setUsers(users.map(user =>
        user.id === userId ? updatedUser : user
      ));
    } catch (err: any) {
      console.error('Failed to update user:', err);
      throw err;
    }
  };

  const updateDepartmentMembers = async (departmentId: string, memberIds: string[]) => {
    await departmentsApi.updateMembers(departmentId, memberIds);
    await refreshData();
  };

  const updateGroupMembers = async (groupId: string, memberIds: string[]) => {
    await groupsApi.updateMembers(groupId, memberIds);
    await refreshData();
  };

  return (
    <EmployeesContext.Provider
      value={{
        users,
        departments,
        groups,
        loading,
        error,
        createDepartment,
        updateDepartment,
        deleteDepartment,
        createGroup,
        updateGroup,
        deleteGroup,
        createUser,
        inviteExistingUser,
        updateUser,
        updateDepartmentMembers,
        updateGroupMembers,
        refreshData,
      }}
    >
      {children}
    </EmployeesContext.Provider>
  );
}

export function useEmployees() {
  const context = useContext(EmployeesContext);
  if (context === undefined) {
    throw new Error('useEmployees must be used within an EmployeesProvider');
  }
  return context;
}
