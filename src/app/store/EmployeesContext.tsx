import { createContext, useContext, useState, ReactNode } from 'react';
import type { User, Department, Group, UserRole } from '../types';
import {
  users as initialUsers,
  departments as initialDepartments,
  groups as initialGroups
} from './mockData';

interface EmployeesContextType {
  users: User[];
  departments: Department[];
  groups: Group[];
  createDepartment: (data: { name: string; description: string; workspaceId: string }) => void;
  createGroup: (data: { name: string; description: string; memberIds: string[]; workspaceId: string }) => void;
  createUser: (data: { email: string; name: string; role: UserRole; departmentId?: string; groupIds?: string[] }) => void;
  updateUser: (userId: string, data: { name?: string; role?: UserRole; departmentId?: string; groupIds?: string[] }) => void;
  updateDepartmentMembers: (departmentId: string, memberIds: string[]) => void;
  updateGroupMembers: (groupId: string, memberIds: string[]) => void;
}

const EmployeesContext = createContext<EmployeesContextType | undefined>(undefined);

export function EmployeesProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [groups, setGroups] = useState<Group[]>(initialGroups);

  const createDepartment = (data: { name: string; description: string; workspaceId: string }) => {
    const newDepartment: Department = {
      id: `dept-${Date.now()}`,
      name: data.name,
      description: data.description,
      workspaceId: data.workspaceId,
    };
    setDepartments([...departments, newDepartment]);
  };

  const createGroup = (data: { name: string; description: string; memberIds: string[]; workspaceId: string }) => {
    const newGroup: Group = {
      id: `group-${Date.now()}`,
      name: data.name,
      description: data.description,
      workspaceId: data.workspaceId,
      memberIds: data.memberIds,
    };
    setGroups([...groups, newGroup]);
  };

  const createUser = (data: { email: string; name: string; role: UserRole; departmentId?: string; groupIds?: string[] }) => {
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

  const updateUser = (userId: string, data: { name?: string; role?: UserRole; departmentId?: string; groupIds?: string[] }) => {
    setUsers(users.map(user =>
      user.id === userId
        ? { ...user, ...data }
        : user
    ));
  };

  const updateDepartmentMembers = (departmentId: string, memberIds: string[]) => {
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
  };

  const updateGroupMembers = (groupId: string, memberIds: string[]) => {
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
  };

  return (
    <EmployeesContext.Provider
      value={{
        users,
        departments,
        groups,
        createDepartment,
        createGroup,
        createUser,
        updateUser,
        updateDepartmentMembers,
        updateGroupMembers,
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
