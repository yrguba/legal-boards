import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi, type LexUser } from '@/api/client';

export type LexRegisterPayload = {
  email: string;
  password: string;
  name: string;
  clientKind: 'individual' | 'company';
  companyName?: string;
};

type AuthContextValue = {
  user: LexUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: LexRegisterPayload) => Promise<void>;
  updateProfile: (payload: {
    phone?: string;
    contactNotes?: string;
    name?: string;
    companyName?: string;
  }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LexUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setReady(true);
      return;
    }
    authApi
      .verify()
      .then((d) => {
        if (!cancelled) setUser(d.user);
      })
      .catch(() => {
        if (!cancelled) {
          authApi.logout();
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    setUser(data.user);
  }, []);

  const register = useCallback(async (payload: LexRegisterPayload) => {
    const data = await authApi.lexRegister(payload);
    setUser(data.user);
  }, []);

  const updateProfile = useCallback(
    async (payload: {
      phone?: string;
      contactNotes?: string;
      name?: string;
      companyName?: string;
    }) => {
      const { user: u } = await authApi.updateProfile(payload);
      setUser(u);
    },
    [],
  );

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, register, updateProfile, logout }),
    [user, ready, login, register, updateProfile, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
