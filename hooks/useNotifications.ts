import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import axios from "axios";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://api.onedelivery.co.tz/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function useNotifications() {
  useEffect(() => {
    let sub1: any, sub2: any;
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") return;

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "your-project-id",
      }).catch(() => null);

      if (token) {
        const accessToken = await SecureStore.getItemAsync("od_access_token").catch(() => null);
        if (accessToken) {
          axios.post(`${API_URL}/notifications/token`, { token: token.data, type: "expo" }, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }).catch(() => {});
        }
      }
    })();

    sub1 = Notifications.addNotificationReceivedListener((n) => {
      console.log("[Notification received]", n.request.content.title);
    });

    sub2 = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as any;
      console.log("[Notification tapped]", data);
    });

    return () => {
      sub1?.remove();
      sub2?.remove();
    };
  }, []);
}
