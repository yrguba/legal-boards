import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { User, Workspace } from '../types';
import { workspaces as defaultWorkspaces } from './mockData';
import { authApi, workspacesApi } from '../services/api';

interface AppContextType {
  currentUser: User | null;
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  switchWorkspace: (workspaceId: string) => void;
  setCurrentUser: (user: User | null) => void;
  /** Перезагрузить список с сервера; при переданном id выбрать это пространство */
  refreshWorkspaces: (selectWorkspaceId?: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const WORKSPACE_STORAGE_PREFIX = 'legal_boards_workspace_';

function readStoredWorkspaceId(userId: string): string | null {
  try {
    return localStorage.getItem(`${WORKSPACE_STORAGE_PREFIX}${userId}`);
  } catch {
    return null;
  }
}

function writeStoredWorkspaceId(userId: string, workspaceId: string): void {
  try {
    localStorage.setItem(`${WORKSPACE_STORAGE_PREFIX}${userId}`, workspaceId);
  } catch {
    /* ignore quota / private mode */
  }
}

function resolveWorkspaceSelection(
  list: Workspace[],
  userId: string,
  options?: { selectId?: string; prevId?: string | null },
): Workspace | null {
  if (list.length === 0) return null;

  const { selectId, prevId } = options ?? {};
  if (selectId) {
    const selected = list.find((w) => w.id === selectId);
    if (selected) return selected;
  }

  const storedId = readStoredWorkspaceId(userId);
  if (storedId) {
    const stored = list.find((w) => w.id === storedId);
    if (stored) return stored;
  }

  if (prevId) {
    const prev = list.find((w) => w.id === prevId);
    if (prev) return prev;
  }

  return list[0];
}

function persistWorkspaceSelection(userId: string, workspace: Workspace | null) {
  if (workspace) writeStoredWorkspaceId(userId, workspace.id);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>(defaultWorkspaces);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const { user } = await authApi.verify();
          setCurrentUser(user);
          setIsAuthenticated(true);

          if (!user.mustChangePassword) {
            let fetchedWorkspaces = await workspacesApi.getAll();
            if (fetchedWorkspaces.length === 0) {
              await workspacesApi.create({
                name: 'Моё рабочее пространство',
                description: 'Автоматически создано при первом входе',
              });
              fetchedWorkspaces = await workspacesApi.getAll();
            }

            setWorkspaces(fetchedWorkspaces);
            if (fetchedWorkspaces.length > 0) {
              const selected = resolveWorkspaceSelection(fetchedWorkspaces, user.id);
              setCurrentWorkspace(selected);
              persistWorkspaceSelection(user.id, selected);
            }
          }
        } catch (err) {
          console.error('Auth verification failed:', err);
          localStorage.removeItem('auth_token');
        }
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { user } = await authApi.login(email, password);
      setCurrentUser(user);
      setIsAuthenticated(true);

      if (!user.mustChangePassword) {
        let fetchedWorkspaces = await workspacesApi.getAll();
        if (fetchedWorkspaces.length === 0) {
          await workspacesApi.create({
            name: 'Моё рабочее пространство',
            description: 'Автоматически создано при первом входе',
          });
          fetchedWorkspaces = await workspacesApi.getAll();
        }

        setWorkspaces(fetchedWorkspaces);
        if (fetchedWorkspaces.length > 0) {
          const selected = resolveWorkspaceSelection(fetchedWorkspaces, user.id);
          setCurrentWorkspace(selected);
          persistWorkspaceSelection(user.id, selected);
        }
      }

      return user as User;
    } catch (err: any) {
      console.error('Login failed:', err);
      throw err;
    }
  };

  const logout = () => {
    authApi.logout();
    setCurrentUser(null);
    setCurrentWorkspace(null);
    setIsAuthenticated(false);
  };

  const switchWorkspace = (workspaceId: string) => {
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (workspace && currentUser) {
      setCurrentWorkspace(workspace);
      persistWorkspaceSelection(currentUser.id, workspace);
    }
  };

  const refreshWorkspaces = async (selectWorkspaceId?: string) => {
    const list = await workspacesApi.getAll();
    setWorkspaces(list);
    if (!currentUser) {
      setCurrentWorkspace(list[0] ?? null);
      return;
    }
    setCurrentWorkspace((prev) => {
      const next = resolveWorkspaceSelection(list, currentUser.id, {
        selectId: selectWorkspaceId,
        prevId: prev?.id,
      });
      persistWorkspaceSelection(currentUser.id, next);
      return next;
    });
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        currentWorkspace,
        workspaces,
        isAuthenticated,
        login,
        logout,
        switchWorkspace,
        setCurrentUser,
        refreshWorkspaces,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
