import { createContext, useContext, useState, ReactNode } from 'react';
import type { User, Workspace } from '../types';
import { currentUser as defaultUser, workspaces as defaultWorkspaces } from './mockData';

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
  const [workspaces] = useState<Workspace[]>(defaultWorkspaces);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);

  const login = async (email: string, password: string) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    setCurrentUser(defaultUser);
    setCurrentWorkspace(workspaces[0]);
    setIsAuthenticated(true);
  };

  const logout = () => {
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
