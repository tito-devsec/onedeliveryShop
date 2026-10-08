/**
 * OneDelivery — JWT Auth Context (replaces Clerk)
 * Tokens stored in expo-secure-store (hardware-backed)
 * Auto-refresh on 401, role-based access
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import * as SecureStore from "expo-secure-store";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { getRegisteredPushToken, setRegisteredPushToken } from "@/lib/pushToken";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://api.onedelivery.co.tz/api";

const KEYS = {
  ACCESS:  "od_access_token",
  REFRESH: "od_refresh_token",
  USER:    "od_user_data",
};

export type UserRole = "customer" | "seller" | "driver" | "admin";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  profile_image?: string;
  // Seller extras (populated on load)
  seller_approved?: boolean;
  seller_plan?: string;
  seller_balance?: number;
  // Driver extras
  driver_approved?: boolean;
  driver_online?: boolean;
}

interface AuthState {
  user: AppUser | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  accessToken: string | null;
}

interface AuthContextType extends AuthState {
  signIn:  (email: string, password: string) => Promise<void>;
  signUp:  (name: string, email: string, password: string, phone?: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoaded: false,
    isSignedIn: false,
    accessToken: null,
  });
  const refreshTimerRef = useRef<any>(null);
  const queryClient = useQueryClient();

  // ── Boot: restore session ───────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [token, refresh, userData] = await Promise.all([
          SecureStore.getItemAsync(KEYS.ACCESS),
          SecureStore.getItemAsync(KEYS.REFRESH),
          SecureStore.getItemAsync(KEYS.USER),
        ]);
        if (!token || !refresh) { setState((s) => ({ ...s, isLoaded: true })); return; }
        // Try to verify token by fetching profile
        try {
          const { data } = await axios.get(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 8000,
          });
          const user = data.user as AppUser;
          await saveSession(token, refresh, user);
          setState({ user, isLoaded: true, isSignedIn: true, accessToken: token });
          scheduleRefresh();
        } catch (e: any) {
          if (e?.response?.status === 401 && refresh) {
            // Try refresh
            try {
              const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken: refresh }, { timeout: 8000 });
              await saveSession(data.accessToken, data.refreshToken, userData ? JSON.parse(userData) : null);
              // Now fetch user
              const { data: meData } = await axios.get(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${data.accessToken}` },
                timeout: 8000,
              });
              setState({ user: meData.user, isLoaded: true, isSignedIn: true, accessToken: data.accessToken });
              scheduleRefresh();
            } catch {
              await clearSession();
              setState({ user: null, isLoaded: true, isSignedIn: false, accessToken: null });
            }
          } else {
            await clearSession();
            setState({ user: null, isLoaded: true, isSignedIn: false, accessToken: null });
          }
        }
      } catch {
        setState((s) => ({ ...s, isLoaded: true }));
      }
    })();
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, []);

  const scheduleRefresh = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    // Refresh token 5 min before 7-day expiry → every 6 days
    refreshTimerRef.current = setTimeout(silentRefresh, 6 * 24 * 60 * 60 * 1000);
  };

  const silentRefresh = async () => {
    try {
      const refresh = await SecureStore.getItemAsync(KEYS.REFRESH);
      if (!refresh) return;
      const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken: refresh }, { timeout: 8000 });
      await SecureStore.setItemAsync(KEYS.ACCESS, data.accessToken);
      await SecureStore.setItemAsync(KEYS.REFRESH, data.refreshToken);
      setState((s) => ({ ...s, accessToken: data.accessToken }));
      scheduleRefresh();
    } catch { /* Token expired — user must login again */ }
  };

  const saveSession = async (access: string, refresh: string, user: AppUser | null) => {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.ACCESS, access),
      SecureStore.setItemAsync(KEYS.REFRESH, refresh),
      user ? SecureStore.setItemAsync(KEYS.USER, JSON.stringify(user)) : Promise.resolve(),
    ]);
  };

  const clearSession = async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.ACCESS).catch(() => {}),
      SecureStore.deleteItemAsync(KEYS.REFRESH).catch(() => {}),
      SecureStore.deleteItemAsync(KEYS.USER).catch(() => {}),
    ]);
  };

  const signIn = useCallback(async (email: string, password: string) => {
    const { data } = await axios.post(`${API_URL}/auth/login`, { email: email.trim(), password }, { timeout: 15000 });
    await saveSession(data.accessToken, data.refreshToken, data.user);
    setState({ user: data.user, isLoaded: true, isSignedIn: true, accessToken: data.accessToken });
    scheduleRefresh();
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string, phone?: string) => {
    const { data } = await axios.post(`${API_URL}/auth/register`, { name: name.trim(), email: email.trim(), password, phone: phone || "" }, { timeout: 15000 });
    await saveSession(data.accessToken, data.refreshToken, data.user);
    setState({ user: data.user, isLoaded: true, isSignedIn: true, accessToken: data.accessToken });
    scheduleRefresh();
  }, []);

  // Google sign-in and sign-up: the backend verifies the Google ID token and
  // creates the account on first use
  const signInWithGoogle = useCallback(async (idToken: string) => {
    const { data } = await axios.post(`${API_URL}/auth/google`, { idToken }, { timeout: 15000 });
    await saveSession(data.accessToken, data.refreshToken, data.user);
    setState({ user: data.user, isLoaded: true, isSignedIn: true, accessToken: data.accessToken });
    scheduleRefresh();
  }, []);

  const signOut = useCallback(async () => {
    try {
      const refresh = await SecureStore.getItemAsync(KEYS.REFRESH);
      const token   = await SecureStore.getItemAsync(KEYS.ACCESS);
      if (token) {
        // Stop this phone getting the account's notifications
        const pushToken = getRegisteredPushToken();
        if (pushToken) {
          await axios.delete(`${API_URL}/notifications/token`, {
            data: { token: pushToken }, headers: { Authorization: `Bearer ${token}` }, timeout: 5000,
          }).catch(() => {});
        }
        await axios.post(`${API_URL}/auth/logout`, { refreshToken: refresh }, {
          headers: { Authorization: `Bearer ${token}` }, timeout: 5000,
        }).catch(() => {});
      }
    } finally {
      await clearSession();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      queryClient.clear(); // drop the previous account's cart, orders, etc.
      setRegisteredPushToken(null);
      setState({ user: null, isLoaded: true, isSignedIn: false, accessToken: null });
    }
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync(KEYS.ACCESS);
      if (!token) return;
      const { data } = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }, timeout: 8000,
      });
      const user = data.user as AppUser;
      await SecureStore.setItemAsync(KEYS.USER, JSON.stringify(user));
      setState((s) => ({ ...s, user }));
    } catch {}
  }, []);

  const getToken = useCallback(async (): Promise<string | null> => {
    return SecureStore.getItemAsync(KEYS.ACCESS);
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUp, signInWithGoogle, signOut, refreshUser, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

// Helpers that mirror Clerk's API for easy migration
export function useUser() {
  const { user } = useAuth();
  return {
    user: user ? {
      id:         user.id,
      firstName:  user.name?.split(" ")[0] || "",
      lastName:   user.name?.split(" ").slice(1).join(" ") || "",
      fullName:   user.name,
      primaryEmailAddress: { emailAddress: user.email },
      imageUrl:   user.profile_image || "",
    } : null,
    isLoaded: true,
  };
}
