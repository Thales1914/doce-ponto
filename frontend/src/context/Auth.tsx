import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, SESSION_KEY, SESSION_EXPIRED } from '../lib/api';
import type { Admin } from '../types';
function readToken() {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}
type Auth = {
  token: string | null;
  admin: Admin | null;
  loading: boolean;
  error: unknown;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  retry: () => void;
};
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(readToken);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* sessão em memória */
    }
    setToken(null);
    setAdmin(null);
    setError(null);
    setLoading(false);
  }, []);
  useEffect(() => {
    const expired = (event: Event) => {
      if ((event as CustomEvent).detail === token) logout();
    };
    window.addEventListener(SESSION_EXPIRED, expired);
    return () => window.removeEventListener(SESSION_EXPIRED, expired);
  }, [token, logout]);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api<Admin>('/auth/me', { token, signal: controller.signal })
      .then((user) => {
        if (!controller.signal.aborted) {
          setAdmin(user);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [token, revision]);
  const login = async (email: string, senha: string) => {
    const result = await api<{ token: string; admin: Admin }>('/auth/login', {
      method: 'POST',
      body: { email, senha },
    });
    try {
      sessionStorage.setItem(SESSION_KEY, result.token);
    } catch {
      /* continua em memória se armazenamento estiver bloqueado */
    }
    setAdmin(result.admin);
    setError(null);
    setToken(result.token);
    setLoading(true);
    setRevision((v) => v + 1);
  };
  return (
    <Context.Provider
      value={{
        token,
        admin,
        loading,
        error,
        login,
        logout,
        retry: () => setRevision((v) => v + 1),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider ausente');
  return value;
}
