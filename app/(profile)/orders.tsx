import { useApi } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDate, formatMoney, getStatusColor } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Awaiting Payment",
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function OrdersScreen() {
  const api    = useApi();
  const insets = useSafeAreaInsets();

  const { data, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => { const { data } = await api.get("/orders"); return data.orders || []; },
    refetchInterval: 30_000,
  });

  const orders = data || [];

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F8" }}>
      <StatusBar style="dark" />
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={26} color="#1B2036" /></TouchableOpacity>
        <Text style={{ color: "#1B2036", fontSize: 20, fontWeight: "800" }}>My Orders</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#EC7C2C" size="large" /></View>
      ) : orders.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Ionicons name="receipt-outline" size={60} color="#E6E8EE" />
          <Text style={{ color: "#1B2036", fontSize: 18, fontWeight: "700", marginTop: 16 }}>No orders yet</Text>
          <Text style={{ color: "#8A90A0", textAlign: "center", marginTop: 8 }}>Your orders will appear here after checkout.</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)")} style={{ backgroundColor: "#2E3A74", borderRadius: 14, paddingVertical: 13, paddingHorizontal: 24, marginTop: 20 }}>
            <Text style={{ color: "#fff", fontWeight: "800" }}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          {orders.map((order: any) => {
            const statusColor = getStatusColor(order.status);
            const items = order.items || [];
            return (
              <View key={order.id} style={{ backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#E6E8EE" }}>
                {/* Header */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <View>
                    <Text style={{ color: "#6B7280", fontSize: 11, fontWeight: "600" }}>ORDER</Text>
                    <Text style={{ color: "#1B2036", fontWeight: "700", fontFamily: "monospace" }}>#{order.id.slice(-8).toUpperCase()}</Text>
                  </View>
                  <View style={{ backgroundColor: statusColor + "20", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: statusColor + "40" }}>
                    <Text style={{ color: statusColor, fontSize: 12, fontWeight: "700" }}>{STATUS_LABELS[order.status] || order.status}</Text>
                  </View>
                </View>

                {/* Items preview */}
                {items.slice(0, 2).map((item: any) => (
                  <View key={item.id} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ color: "#4A5163", fontSize: 13, flex: 1, marginRight: 8 }} numberOfLines={1}>{item.name} × {item.quantity}</Text>
                    <Text style={{ color: "#1B2036", fontSize: 13, fontWeight: "600" }}>{formatMoney(item.price * item.quantity)}</Text>
                  </View>
                ))}
                {items.length > 2 && <Text style={{ color: "#8A90A0", fontSize: 12, marginTop: 2 }}>+{items.length - 2} more items</Text>}

                {/* Footer */}
                <View style={{ borderTopWidth: 1, borderTopColor: "#E6E8EE", marginTop: 12, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={{ color: "#8A90A0", fontSize: 12 }}>{formatDate(order.created_at)}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: order.payment_status === "success" ? "#16A34A" : "#E0950B" }} />
                      <Text style={{ color: "#6B7280", fontSize: 12, textTransform: "capitalize" }}>{order.payment_status}</Text>
                    </View>
                  </View>
                  <Text style={{ color: "#EC7C2C", fontSize: 16, fontWeight: "900" }}>{formatMoney(order.total_price)}</Text>
                </View>

                {/* Action buttons: follow a delivery already requested, or request one */}
                {order.payment_status === "success" && (() => {
                  const hasRide = !!order.ride_id && !["cancelled", "no_driver"].includes(order.ride_status);
                  return (
                    <TouchableOpacity
                      onPress={() => hasRide
                        ? router.push({ pathname: "/ride/tracking", params: { rideId: order.ride_id } })
                        : router.push({ pathname: "/ride/request", params: { orderId: order.id } })}
                      style={{ backgroundColor: hasRide ? "#2E3A74" : "#EC7C2C15", borderRadius: 12, paddingVertical: 10, alignItems: "center", marginTop: 10, borderWidth: 1, borderColor: hasRide ? "#2E3A74" : "#EC7C2C30", flexDirection: "row", justifyContent: "center", gap: 8 }}>
                      <Ionicons name={hasRide ? "navigate" : "bicycle-outline"} size={16} color={hasRide ? "#FFFFFF" : "#EC7C2C"} />
                      <Text style={{ color: hasRide ? "#FFFFFF" : "#EC7C2C", fontWeight: "700", fontSize: 13 }}>
                        {!hasRide ? "Request Delivery" : order.ride_status === "delivered" ? "View Delivery" : "Track Delivery"}
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
