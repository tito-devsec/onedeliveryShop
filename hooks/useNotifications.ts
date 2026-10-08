import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import axios from "axios";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { setRegisteredPushToken } from "@/lib/pushToken";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://api.onedelivery.co.tz/api";

// Shared with the driver app and the backend (pushes target this channel; it is
// also the app's default FCM channel). A channel's sound can't change after it is
// created on a phone, hence the new id for the OneDelivery chime.
const ANDROID_CHANNEL_ID = "onedelivery_alerts";

// Android 13+ only shows the permission prompt once at least one channel exists
async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Orders & deliveries",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#EC7C2C",
    sound: "onedelivery_notification.wav",
  });
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function getExpoPushToken(): Promise<string | null> {
  await ensureAndroidChannel();

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== "granted") return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

// Opens the screen a notification points to (same `data` payload as the in-app list)
function openTarget(data: Record<string, any> = {}) {
  if (data.screen === "track_order" && data.rideId) router.push({ pathname: "/ride/tracking", params: { rideId: data.rideId } });
  else if (data.screen === "chat" && data.conversationId) router.push(`/conversation/${data.conversationId}`);
  else if (data.screen === "order_detail") router.push("/(profile)/orders");
  else if (data.screen === "seller_dashboard") router.push("/business");
  else router.push("/notifications");
}

export function useNotifications() {
  const { user, getToken } = useAuth();
  const queryClient = useQueryClient();
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledResponseId = useRef<string | null>(null);

  // Create the channel at launch so pushes always ring with the OneDelivery sound
  useEffect(() => { ensureAndroidChannel().catch(() => {}); }, []);

  // Register this device with the backend for the signed-in user (runs again after every login)
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const token = await getExpoPushToken();
        const accessToken = await getToken();
        if (!token || !accessToken) return;
        // `app` lets the backend send customer updates here and driver updates to the driver app
        await axios.post(`${API_URL}/notifications/token`, { token, type: "expo", app: "shop", platform: Platform.OS }, {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        });
        setRegisteredPushToken(token);
      } catch (e: any) {
        console.warn("[Push] registration failed:", e?.message ?? e);
      }
    })();
  }, [user?.id, getToken]);

  // Refresh the in-app notification list as soon as a push arrives
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });
    return () => sub.remove();
  }, [queryClient]);

  // Tapping a notification (including one that launched the app) opens its screen
  useEffect(() => {
    if (!user?.id || !lastResponse) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = lastResponse.notification.request.identifier;
    if (handledResponseId.current === id) return;
    handledResponseId.current = id;
    openTarget(lastResponse.notification.request.content.data);
  }, [lastResponse, user?.id]);
}
