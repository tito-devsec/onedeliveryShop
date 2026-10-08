import { useApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { timeAgo } from "@/lib/utils";

const TYPE_ICONS: Record<string, { icon: any; color: string }> = {
  order_confirmed:   { icon: "checkmark-circle-outline", color: "#22C55E" },
  order_pending:     { icon: "time-outline",             color: "#F59E0B" },
  payment_failed:    { icon: "close-circle-outline",     color: "#EF4444" },
  ride_accepted:     { icon: "car-outline",              color: "#3B82F6" },
  ride_picked_up:    { icon: "cube-outline",             color: "#8B5CF6" },
  ride_on_the_way:   { icon: "navigate-outline",         color: "#F97316" },
  ride_delivered:    { icon: "gift-outline",             color: "#22C55E" },
  seller_approved:   { icon: "storefront-outline",       color: "#F97316" },
  driver_approved:   { icon: "bicycle-outline",          color: "#3B82F6" },
  package_activated: { icon: "award-outline",            color: "#F59E0B" },
  new_message:       { icon: "chatbubble-outline",       color: "#3B82F6" },
  general:           { icon: "notifications-outline",    color: "#94A3B8" },
};

export default function NotificationsScreen() {
  const api    = useApi();
  const insets = useSafeAreaInsets();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data } = await api.get("/notifications");
      return data.notifications || [];
    },
    refetchInterval: 30_000,
  });

  const notifications = data || [];

  const handleTap = (n: any) => {
    const d = n.data || {};
    if (d.screen === "order_detail" && d.orderId)    router.push(`/order/${d.orderId}` as any);
    else if (d.screen === "track_order" && d.rideId)  router.push({ pathname: "/ride/tracking", params: { rideId: d.rideId } });
    else if (d.screen === "chat" && d.conversationId) router.push(`/conversation/${d.conversationId}`);
    else if (d.screen === "seller_dashboard")          router.push("/business/index");
    else if (d.screen === "driver_home")               router.push("/(tabs)/profile");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <StatusBar style="light" />
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#1E293B", flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#F97316" />
        </TouchableOpacity>
        <Text style={{ color: "#F8FAFC", fontSize: 20, fontWeight: "800" }}>Notifications</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#F97316" size="large" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Ionicons name="notifications-off-outline" size={60} color="#334155" />
          <Text style={{ color: "#F8FAFC", fontSize: 18, fontWeight: "700", marginTop: 16 }}>No notifications yet</Text>
          <Text style={{ color: "#64748B", textAlign: "center", marginTop: 8 }}>You'll see order updates, delivery status, and messages here.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {notifications.map((n: any) => {
            const style = TYPE_ICONS[n.type] || TYPE_ICONS.general;
            return (
              <TouchableOpacity key={n.id} onPress={() => handleTap(n)} activeOpacity={0.75}
                style={{ paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1E293B", flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: n.is_read ? "transparent" : "#1E293B40" }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: style.color + "20", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Ionicons name={style.icon} size={22} color={style.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#F8FAFC", fontWeight: "700", fontSize: 14, marginBottom: 2 }}>{n.title}</Text>
                  <Text style={{ color: "#94A3B8", fontSize: 13, lineHeight: 18 }}>{n.body}</Text>
                  <Text style={{ color: "#475569", fontSize: 11, marginTop: 4 }}>{timeAgo(n.created_at)}</Text>
                </View>
                {!n.is_read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#F97316", marginTop: 6 }} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
