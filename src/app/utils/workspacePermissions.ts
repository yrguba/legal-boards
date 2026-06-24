import { useMemo } from 'react';
import type { UserRole, Workspace } from '../types';
import { useApp } from '../store/AppContext';

export function getWorkspaceRole(workspace: Workspace | null | undefined): UserRole | null {
  if (!workspace) return null;
  if (workspace.isOwner) return 'admin';
  return workspace.myRole ?? null;
}

/** Владелец, администратор или менеджер пространства. */
export function canManageWorkspace(workspace: Workspace | null | undefined): boolean {
  const role = getWorkspaceRole(workspace);
  return role === 'admin' || role === 'manager';
}

/** Владелец или администратор пространства (не менеджер). */
export function isWorkspaceAdmin(workspace: Workspace | null | undefined): boolean {
  return getWorkspaceRole(workspace) === 'admin';
}

/** Права в текущем выбранном пространстве (не глобальная User.role из JWT). */
export function useWorkspacePermissions() {
  const { currentWorkspace } = useApp();
  return useMemo(
    () => ({
      workspaceRole: getWorkspaceRole(currentWorkspace),
      canManageWorkspace: canManageWorkspace(currentWorkspace),
      isWorkspaceAdmin: isWorkspaceAdmin(currentWorkspace),
    }),
    [currentWorkspace],
  );
}
