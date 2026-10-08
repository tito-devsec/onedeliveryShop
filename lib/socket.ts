/**
 * OneDelivery — Socket.io Client
 * Singleton pattern for real-time features
 */
import { io, Socket } from "socket.io-client";
import * as SecureStore from "expo-secure-store";

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || "https://api.onedelivery.co.tz";

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await SecureStore.getItemAsync("od_access_token");

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
  });

  socket.on("connect", () => console.log("[Socket] Connected:", socket?.id));
  socket.on("disconnect", (reason) => console.log("[Socket] Disconnected:", reason));
  socket.on("connect_error", (err) => console.warn("[Socket] Error:", err.message));

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocketInstance() {
  return socket;
}
