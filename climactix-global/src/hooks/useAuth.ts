"use client";

import { useCallback, useEffect } from "react";
import { useAuthStore } from "@/store";
import type { LoginCredentials, RegisterPayload } from "@/types/auth";

export function useAuth() {
  const { user, token, isAuthenticated, isLoading, error, setUser, setToken, setLoading, setError, logout: storeLogout } = useAuthStore();

  const fetchCurrentUser = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setToken(data.token ?? null);
      } else {
        setUser(null);
        setToken(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setUser, setToken]);

  useEffect(() => {
    fetchCurrentUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(credentials),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setUser(data.user);
          setToken(data.token ?? null);
          return { success: true };
        } else {
          setError(data.error ?? "Login failed");
          return { success: false, error: data.error };
        }
      } catch {
        const msg = "Network error — please try again";
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setUser, setToken]
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setUser(data.user);
          setToken(data.token ?? null);
          return { success: true };
        } else {
          setError(data.error ?? "Registration failed");
          return { success: false, error: data.error };
        }
      } catch {
        const msg = "Network error — please try again";
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setUser, setToken]
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      storeLogout();
    }
  }, [storeLogout]);

  const hasPermission = useCallback(
    (permission: string) => user?.permissions?.includes(permission as never) ?? false,
    [user]
  );

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    hasPermission,
    refresh: fetchCurrentUser,
  };
}
