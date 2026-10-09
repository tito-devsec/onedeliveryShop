/**
 * OneDelivery — Socket.io Client
 * One shared connection for real-time features (live delivery tracking, chat)
 */
import { io, Socket } from "socket.io-client";
import * as SecureStore from "expo-secure-store";

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || "https://api.onedelivery.co.tz";

type Handler = (...args: any[]) => void;

let socket: Socket | null = null;
// Listeners added with subscribe() survive the socket being replaced
const handlers = new Map<string, Set<Handler>>();

export async function getSocket(): Promise<Socket> {
  // Reuse a socket that is connected or still (re)connecting
  if (socket && (socket.connected || socket.active)) return socket;
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  const s = io(SOCKET_URL, {
    // Read the token on every (re)connect so a refreshed token is used
    auth: (cb) => {
      SecureStore.getItemAsync("od_access_token")
        .then((token) => cb({ token }))
        .catch(() => cb({}));
    },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  });
  socket = s;
  for (const [event, set] of handlers) for (const fn of set) s.on(event, fn);

  s.on("connect", () => console.log("[Socket] Connected:", s.id));
  s.on("disconnect", (reason) => console.log("[Socket] Disconnected:", reason));
  s.on("connect_error", (err) => console.warn("[Socket] Error:", err.message));

  return s;
}

// Listen to a server event on the current and any future socket; returns an unsubscribe
export function subscribe(event: string, fn: Handler): () => void {
  let set = handlers.get(event);
  if (!set) handlers.set(event, (set = new Set()));
  set.add(fn);
  socket?.on(event, fn);
  getSocket().catch(() => {});
  return () => {
    set!.delete(fn);
    socket?.off(event, fn);
  };
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function getSocketInstance() {
  return socket;
}
