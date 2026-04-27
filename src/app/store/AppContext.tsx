import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { User, Workspace } from '../types';
import { workspaces as defaultWorkspaces } from './mockData';
import { authApi, workspacesApi } from '../services/api';

interface AppContextType {
  currentUser: User | null;
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchWorkspace: (workspaceId: string) => void;
  /** Перезагрузить список с сервера; при переданном id выбрать это пространство */
  refreshWorkspaces: (selectWorkspaceId?: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

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

          let fetchedWorkspaces = await workspacesApi.getAll();
          if (fetchedWorkspaces.length === 0) {
            await workspacesApi.create({
              name: 'Моё рабочее пространство',
              description: 'Автоматически создано при первом входе',
            });
            fetchedWorkspaces = await workspacesApi.getAll();
          }

          setWorkspaces(fetchedWorkspaces);
          if (fetchedWorkspaces.length > 0) setCurrentWorkspace(fetchedWorkspaces[0]);
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

      let fetchedWorkspaces = await workspacesApi.getAll();
      if (fetchedWorkspaces.length === 0) {
        await workspacesApi.create({
          name: 'Моё рабочее пространство',
          description: 'Автоматически создано при первом входе',
        });
        fetchedWorkspaces = await workspacesApi.getAll();
      }

      setWorkspaces(fetchedWorkspaces);
      if (fetchedWorkspaces.length > 0) setCurrentWorkspace(fetchedWorkspaces[0]);
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
    if (workspace) {
      setCurrentWorkspace(workspace);
    }
  };

  const refreshWorkspaces = async (selectWorkspaceId?: string) => {
    const list = await workspacesApi.getAll();
    setWorkspaces(list);
    setCurrentWorkspace((prev) => {
      if (selectWorkspaceId) {
        const w = list.find((x) => x.id === selectWorkspaceId);
        if (w) return w;
      }
      if (prev) {
        const still = list.find((x) => x.id === prev.id);
        if (still) return still;
      }
      return list[0] ?? null;
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
