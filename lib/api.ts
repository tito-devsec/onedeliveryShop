/**
 * OneDelivery — API Client v2
 * JWT-based, no Clerk. Tokens from SecureStore.
 * Auto-refresh on 401 with queue.
 */
import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";
import { useEffect, useRef } from "react";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://api.onedelivery.co.tz/api";

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
    "X-Client": "OneDelivery-Mobile/2.0",
  },
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (t: string) => void; reject: (e: any) => void }> = [];

function processQueue(error: any, token: string | null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (t) => { original.headers["Authorization"] = `Bearer ${t}`; resolve(api(original)); },
            reject,
          });
        });
      }
      isRefreshing = true;
      try {
        const refresh = await SecureStore.getItemAsync("od_refresh_token");
        if (!refresh) throw new Error("No refresh token");
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken: refresh }, { timeout: 8000 });
        await SecureStore.setItemAsync("od_access_token", data.accessToken);
        await SecureStore.setItemAsync("od_refresh_token", data.refreshToken);
        processQueue(null, data.accessToken);
        original.headers["Authorization"] = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (e) {
        processQueue(e, null);
        await SecureStore.deleteItemAsync("od_access_token").catch(() => {});
        await SecureStore.deleteItemAsync("od_refresh_token").catch(() => {});
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }
    if (!error.response) return Promise.reject(new Error("Network error. Check your connection."));
    if (error.response?.status === 429) return Promise.reject(new Error("Too many requests. Please wait."));
    return Promise.reject(error);
  }
);

export const useApi = (): AxiosInstance => {
  const interceptorRef = useRef<number | null>(null);

  useEffect(() => {
    if (interceptorRef.current !== null) {
      api.interceptors.request.eject(interceptorRef.current);
    }
    interceptorRef.current = api.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const token = await SecureStore.getItemAsync("od_access_token");
        if (token) config.headers["Authorization"] = `Bearer ${token}`;
        return config;
      },
      (err) => Promise.reject(err)
    );
    return () => {
      if (interceptorRef.current !== null) api.interceptors.request.eject(interceptorRef.current);
    };
  }, []);

  return api;
};

export default api;
