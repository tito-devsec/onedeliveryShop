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
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <StatusBar style="light" />
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#1E293B", flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={26} color="#F97316" /></TouchableOpacity>
        <Text style={{ color: "#F8FAFC", fontSize: 20, fontWeight: "800" }}>My Orders</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#F97316" size="large" /></View>
      ) : orders.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Ionicons name="receipt-outline" size={60} color="#334155" />
          <Text style={{ color: "#F8FAFC", fontSize: 18, fontWeight: "700", marginTop: 16 }}>No orders yet</Text>
          <Text style={{ color: "#64748B", textAlign: "center", marginTop: 8 }}>Your orders will appear here after checkout.</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)")} style={{ backgroundColor: "#F97316", borderRadius: 14, paddingVertical: 13, paddingHorizontal: 24, marginTop: 20 }}>
            <Text style={{ color: "#fff", fontWeight: "800" }}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          {orders.map((order: any) => {
            const statusColor = getStatusColor(order.status);
            const items = order.items || [];
            return (
              <View key={order.id} style={{ backgroundColor: "#1E293B", borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#334155" }}>
                {/* Header */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <View>
                    <Text style={{ color: "#94A3B8", fontSize: 11, fontWeight: "600" }}>ORDER</Text>
                    <Text style={{ color: "#F8FAFC", fontWeight: "700", fontFamily: "monospace" }}>#{order.id.slice(-8).toUpperCase()}</Text>
                  </View>
                  <View style={{ backgroundColor: statusColor + "20", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: statusColor + "40" }}>
                    <Text style={{ color: statusColor, fontSize: 12, fontWeight: "700" }}>{STATUS_LABELS[order.status] || order.status}</Text>
                  </View>
                </View>

                {/* Items preview */}
                {items.slice(0, 2).map((item: any) => (
                  <View key={item.id} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ color: "#CBD5E1", fontSize: 13, flex: 1, marginRight: 8 }} numberOfLines={1}>{item.name} × {item.quantity}</Text>
                    <Text style={{ color: "#F8FAFC", fontSize: 13, fontWeight: "600" }}>{formatMoney(item.price * item.quantity)}</Text>
                  </View>
                ))}
                {items.length > 2 && <Text style={{ color: "#64748B", fontSize: 12, marginTop: 2 }}>+{items.length - 2} more items</Text>}

                {/* Footer */}
                <View style={{ borderTopWidth: 1, borderTopColor: "#334155", marginTop: 12, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={{ color: "#64748B", fontSize: 12 }}>{formatDate(order.created_at)}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: order.payment_status === "success" ? "#22C55E" : "#F59E0B" }} />
                      <Text style={{ color: "#94A3B8", fontSize: 12, textTransform: "capitalize" }}>{order.payment_status}</Text>
                    </View>
                  </View>
                  <Text style={{ color: "#F97316", fontSize: 16, fontWeight: "900" }}>{formatMoney(order.total_price)}</Text>
                </View>

                {/* Action buttons */}
                {order.payment_status === "success" && (
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: "/ride/request", params: { orderId: order.id } })}
                    style={{ backgroundColor: "#F9731615", borderRadius: 12, paddingVertical: 10, alignItems: "center", marginTop: 10, borderWidth: 1, borderColor: "#F9731630", flexDirection: "row", justifyContent: "center", gap: 8 }}>
                    <Ionicons name="bicycle-outline" size={16} color="#F97316" />
                    <Text style={{ color: "#F97316", fontWeight: "700", fontSize: 13 }}>Request Delivery</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
