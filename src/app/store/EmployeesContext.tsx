import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { User, Department, Group, UserRole } from '../types';
import {
  users as initialUsers,
  departments as initialDepartments,
  groups as initialGroups
} from './mockData';
import { usersApi, departmentsApi, groupsApi } from '../services/api';
import { useApp } from './AppContext';

interface EmployeesContextType {
  users: User[];
  departments: Department[];
  groups: Group[];
  loading: boolean;
  error: string | null;
  createDepartment: (data: { name: string; description: string; workspaceId: string }) => Promise<void>;
  createGroup: (data: { name: string; description: string; memberIds: string[]; workspaceId: string }) => Promise<void>;
  createUser: (data: { email: string; name: string; role: UserRole; departmentId?: string; groupIds?: string[] }) => Promise<void>;
  updateUser: (userId: string, data: { name?: string; role?: UserRole; departmentId?: string; groupIds?: string[] }) => Promise<void>;
  updateDepartmentMembers: (departmentId: string, memberIds: string[]) => Promise<void>;
  updateGroupMembers: (groupId: string, memberIds: string[]) => Promise<void>;
  refreshData: () => Promise<void>;
}

const EmployeesContext = createContext<EmployeesContextType | undefined>(undefined);

export function EmployeesProvider({ children }: { children: ReactNode }) {
  const { currentWorkspace, isAuthenticated } = useApp();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshData = async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const [fetchedUsers, fetchedDepartments, fetchedGroups] = await Promise.all([
        usersApi.getAll().catch(() => initialUsers),
        currentWorkspace ? departmentsApi.getByWorkspace(currentWorkspace.id).catch(() => initialDepartments) : Promise.resolve(initialDepartments),
        currentWorkspace ? groupsApi.getByWorkspace(currentWorkspace.id).catch(() => initialGroups) : Promise.resolve(initialGroups),
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
    try {
      const newDepartment = await departmentsApi.create(data);
      setDepartments([...departments, newDepartment]);
    } catch (err: any) {
      console.error('Failed to create department:', err);
      // Fallback to local state for demo
      const newDepartment: Department = {
        id: `dept-${Date.now()}`,
        name: data.name,
        description: data.description,
        workspaceId: data.workspaceId,
      };
      setDepartments([...departments, newDepartment]);
    }
  };

  const createGroup = async (data: { name: string; description: string; memberIds: string[]; workspaceId: string }) => {
    try {
      const newGroup = await groupsApi.create(data);
      setGroups([...groups, newGroup]);
    } catch (err: any) {
      console.error('Failed to create group:', err);
      // Fallback to local state
      const newGroup: Group = {
        id: `group-${Date.now()}`,
        name: data.name,
        description: data.description,
        workspaceId: data.workspaceId,
        memberIds: data.memberIds,
      };
      setGroups([...groups, newGroup]);
    }
  };

  const createUser = async (data: { email: string; name: string; role: UserRole; departmentId?: string; groupIds?: string[] }) => {
    // Note: User creation should typically go through registration
    // This is a simplified version for demo
    const newUser: User = {
      id: `user-${Date.now()}`,
      email: data.email,
      name: data.name,
      role: data.role,
      departmentId: data.departmentId,
      groupIds: data.groupIds,
    };
    setUsers([...users, newUser]);
  };

  const updateUser = async (userId: string, data: { name?: string; role?: UserRole; departmentId?: string; groupIds?: string[] }) => {
    try {
      const updatedUser = await usersApi.update(userId, data);
      setUsers(users.map(user =>
        user.id === userId ? updatedUser : user
      ));
    } catch (err: any) {
      console.error('Failed to update user:', err);
      // Fallback to local state
      setUsers(users.map(user =>
        user.id === userId
          ? { ...user, ...data }
          : user
      ));
    }
  };

  const updateDepartmentMembers = async (departmentId: string, memberIds: string[]) => {
    try {
      await departmentsApi.updateMembers(departmentId, memberIds);
      await refreshData();
    } catch (err: any) {
      console.error('Failed to update department members:', err);
      // Fallback to local state
      setUsers(users.map(user =>
        user.departmentId === departmentId
          ? { ...user, departmentId: undefined }
          : user
      ));

      setUsers(users.map(user =>
        memberIds.includes(user.id)
          ? { ...user, departmentId }
          : user
      ));
    }
  };

  const updateGroupMembers = async (groupId: string, memberIds: string[]) => {
    try {
      await groupsApi.updateMembers(groupId, memberIds);
      await refreshData();
    } catch (err: any) {
      console.error('Failed to update group members:', err);
      // Fallback to local state
      setGroups(groups.map(group =>
        group.id === groupId
          ? { ...group, memberIds }
          : group
      ));

      setUsers(users.map(user => {
        const currentGroupIds = user.groupIds || [];
        const isInNewMembers = memberIds.includes(user.id);
        const hasThisGroup = currentGroupIds.includes(groupId);

        if (isInNewMembers && !hasThisGroup) {
          return { ...user, groupIds: [...currentGroupIds, groupId] };
        } else if (!isInNewMembers && hasThisGroup) {
          return { ...user, groupIds: currentGroupIds.filter(id => id !== groupId) };
        }
        return user;
      }));
    }
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
        createGroup,
        createUser,
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
