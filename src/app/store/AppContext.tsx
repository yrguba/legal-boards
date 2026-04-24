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
