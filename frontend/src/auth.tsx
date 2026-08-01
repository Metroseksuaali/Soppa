import { createContext, useContext, useState, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, User } from './api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);

  const { isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        const res = await api.get<{ user: User }>('/auth/me');
        setUser(res.user);
        return res.user;
      } catch {
        setUser(null);
        return null;
      }
    },
    retry: false,
    staleTime: Infinity,
  });

  async function login(username: string, password: string) {
    const res = await api.post<{ user: User }>('/auth/login', { username, password });
    setUser(res.user);
  }

  async function logout() {
    await api.post('/auth/logout');
    setUser(null);
    qc.clear();
  }

  return (
    <AuthContext.Provider value={{ user, loading: isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth ilman AuthProvideria');
  return ctx;
}
