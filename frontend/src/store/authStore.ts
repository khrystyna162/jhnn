import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, Role } from '@/types';
import apiClient from '@/services/api';

function getUserRole(user: AuthUser | null): Role | null {
  if (!user) return null;
  const roleFromRoleId = (user as unknown as { roleId?: Role }).roleId;
  const roleFromRole = (user as unknown as { role?: Role }).role;
  return roleFromRoleId ?? roleFromRole ?? null;
}

function getRoleFromAccessToken(token: string | null): Role | null {
  if (!token) return null;

  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;

    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const decoded =
      typeof window !== 'undefined'
        ? window.atob(padded)
        : Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(decoded) as { role?: Role };

    return payload.role ?? null;
  } catch {
    return null;
  }
}

export interface AuthStore {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: Role | Role[]) => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      error: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.login({ username, password });
          const normalizedUser = {
            ...(response.user as unknown as Record<string, unknown>),
            roleId: (response.user as unknown as { roleId?: Role; role?: Role }).roleId
              ?? (response.user as unknown as { role?: Role }).role,
          } as AuthUser;

          // Sync tokens with API client immediately
          apiClient.setTokens(response.accessToken, response.refreshToken);

          set({
            user: normalizedUser,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Login failed';
          set({
            isLoading: false,
            error: message,
            user: null,
            accessToken: null,
            refreshToken: null,
          });
          throw error;
        }
      },

      logout: async () => {
        const state = get();
        if (state.refreshToken) {
          try {
            await apiClient.logout(state.refreshToken);
          } catch {}
        }
        get().clearAuth();
      },

      setUser: (user: AuthUser | null) => {
        set({ user });
      },

      setTokens: (accessToken: string, refreshToken: string) => {
        set({ accessToken, refreshToken });
        apiClient.setTokens(accessToken, refreshToken);
      },

      clearAuth: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          error: null,
          isLoading: false,
        });
        apiClient.clearTokens();
      },

      hasPermission: () => {
        return true;
      },

      hasRole: (role: Role | Role[]) => {
        const state = get();
        const currentRole = getUserRole(state.user) ?? getRoleFromAccessToken(state.accessToken);
        if (!currentRole) return false;
        if (Array.isArray(role)) {
          return role.includes(currentRole);
        }
        return currentRole === role;
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
