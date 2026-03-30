/**
 * Hook de autenticación con Context compartido.
 *
 * Usa un React Context para que TODOS los componentes que llamen a useAuth()
 * compartan la misma instancia de user / isLoading / logout, etc.
 * Así, cuando un componente llama a logout(), el RootLayout también detecta
 * user === null y ejecuta la redirección a /login.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { AuthService } from '../services/auth.service';
import { ReportsService } from '../services/reports.service';
import type { JwtUser, LoginPayload, RegisterPayload, Rol } from '../types';

// ─── Tipos ──────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: JwtUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

// ─── Context ────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<JwtUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    let mounted = true;
    AuthService.getMe()
      .then((u) => { if (mounted) setUser(u); })
      .catch(() => { if (mounted) setUser(null); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    await AuthService.login(payload);
    const me = await AuthService.getMe();
    setUser(me);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    await AuthService.register(payload);
    const me = await AuthService.getMe();
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    await AuthService.logout();
    ReportsService.invalidateCache();
    setUser(null);
    routerRef.current.replace('/login');
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    login,
    register,
    logout,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
}

// ─── Hook público ───────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de un <AuthProvider>');
  }
  return ctx;
}

// Helper para verificar el rol del usuario actual
export function hasRole(user: JwtUser | null, ...roles: Rol[]): boolean {
  if (!user) return false;
  return roles.includes(user.rol);
}
