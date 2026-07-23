import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi, setSaToken, getSaToken, clearSaAuth, type SAUser } from './api';

interface AuthState {
  user: SAUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: getSaToken(),
    loading: true,
    isAuthenticated: false,
  });

  // Restore session on mount
  const restoreSession = useCallback(async () => {
    const token = getSaToken();
    if (!token) {
      setState(s => ({ ...s, loading: false }));
      return;
    }
    try {
      const user = await authApi.me();
      // Enforce: only platform admins can use this portal
      if (!user.isPlatformAdmin) throw new Error('Not a platform admin');
      const savedUser = localStorage.getItem('sa_user');
      setState({ user: savedUser ? JSON.parse(savedUser) : user, token, loading: false, isAuthenticated: true });
    } catch {
      clearSaAuth();
      setState({ user: null, token: null, loading: false, isAuthenticated: false });
    }
  }, []);

  useEffect(() => { restoreSession(); }, [restoreSession]);

  const login = async (username: string, password: string) => {
    const res = await authApi.login({ username, password });
    if (!res.user.isPlatformAdmin) {
      throw new Error('Access denied. This portal is for Platform Administrators only.');
    }
    setSaToken(res.token);
    localStorage.setItem('sa_user', JSON.stringify(res.user));
    setState({ user: res.user, token: res.token, loading: false, isAuthenticated: true });
  };

  const logout = () => {
    clearSaAuth();
    setState({ user: null, token: null, loading: false, isAuthenticated: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
