import { useApi } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatMoney, formatDate } from "@/lib/utils";

export default function SellerAnalyticsScreen() {
  const api    = useApi();
  const insets = useSafeAreaInsets();

  const { data: dashData, isLoading } = useQuery({
    queryKey: ["seller-dashboard"],
    queryFn: async () => { const { data } = await api.get("/seller/dashboard"); return data; },
  });

  const { data: ordersData } = useQuery({
    queryKey: ["seller-orders-analytics"],
    queryFn: async () => { const { data } = await api.get("/orders/seller/mine"); return data; },
  });

  const { data: subData } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => { const { data } = await api.get("/users/subscription"); return data; },
  });

  const dash    = dashData || {};
  const orders  = ordersData?.orders || [];
  const sub     = subData?.subscription;
  const daysLeft = sub?.expires_at ? Math.ceil((new Date(sub.expires_at).getTime() - Date.now()) / 86400000) : null;
  const hasPaidPlan = sub && !["seller_free"].includes(sub.package_id);

  const revenueByDay: Record<string, number> = {};
  orders.forEach((o: any) => {
    const day = formatDate(o.created_at);
    revenueByDay[day] = (revenueByDay[day] || 0) + parseFloat(o.total_price || 0);
  });
  const revenueEntries = Object.entries(revenueByDay).slice(-7);
  const maxRevenue = Math.max(...revenueEntries.map(([, v]) => v), 1);

  const deliveredOrders  = orders.filter((o: any) => o.status === "delivered").length;
  const pendingOrders    = orders.filter((o: any) => ["pending","processing"].includes(o.status)).length;
  const cancelledOrders  = orders.filter((o: any) => o.status === "cancelled").length;

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F8" }}>
      <StatusBar style="dark" />
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={26} color="#1B2036" /></TouchableOpacity>
        <Text style={{ color: "#1B2036", fontSize: 20, fontWeight: "800" }}>Analytics</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#EC7C2C" size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          {/* Plan banner */}
          {sub && (
            <View style={{ backgroundColor: hasPaidPlan ? "#EC7C2C15" : "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: hasPaidPlan ? "#EC7C2C40" : "#E6E8EE", flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Ionicons name="award-outline" size={28} color={hasPaidPlan ? "#EC7C2C" : "#8A90A0"} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#1B2036", fontWeight: "800" }}>{sub.package_id?.replace(/_/g," ").toUpperCase()} Plan</Text>
                <Text style={{ color: daysLeft && daysLeft < 7 ? "#DC2626" : "#6B7280", fontSize: 12, marginTop: 2 }}>
                  {daysLeft !== null && daysLeft > 0 ? `${daysLeft} days remaining` : "Expired or inactive"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => router.push("/packages")} style={{ backgroundColor: "#EC7C2C", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Upgrade</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Key metrics */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Total Revenue",   value: formatMoney(dash.totalRevenue || 0),  color: "#EC7C2C", icon: "cash-outline" },
              { label: "Balance",         value: formatMoney(dash.balance || 0),        color: "#16A34A", icon: "wallet-outline" },
              { label: "Total Orders",    value: String(orders.length),                 color: "#2563EB", icon: "receipt-outline" },
              { label: "Pending Orders",  value: String(pendingOrders),                 color: "#E0950B", icon: "time-outline" },
              { label: "Delivered",       value: String(deliveredOrders),               color: "#16A34A", icon: "checkmark-circle-outline" },
              { label: "Cancelled",       value: String(cancelledOrders),               color: "#DC2626", icon: "close-circle-outline" },
            ].map((stat) => (
              <View key={stat.label} style={{ width: "47%", backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#E6E8EE" }}>
                <Ionicons name={stat.icon as any} size={20} color={stat.color} />
                <Text style={{ color: stat.color, fontSize: 20, fontWeight: "900", marginTop: 6 }}>{stat.value}</Text>
                <Text style={{ color: "#8A90A0", fontSize: 11, marginTop: 2 }}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Revenue chart (simple bars) */}
          {revenueEntries.length > 0 && (
            <View style={{ backgroundColor: "#FFFFFF", borderRadius: 18, padding: 18, marginBottom: 20 }}>
              <Text style={{ color: "#1B2036", fontSize: 16, fontWeight: "800", marginBottom: 16 }}>Revenue (Last 7 days)</Text>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 100 }}>
                {revenueEntries.map(([day, val]) => (
                  <View key={day} style={{ flex: 1, alignItems: "center" }}>
                    <View style={{ width: "80%", backgroundColor: "#EC7C2C", borderRadius: 4, height: Math.max((val / maxRevenue) * 80, 4) }} />
                    <Text style={{ color: "#8A90A0", fontSize: 8, marginTop: 4 }} numberOfLines={1}>{day.split(" ")[0]}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Featured impressions (if paid plan) */}
          {hasPaidPlan && (
            <View style={{ backgroundColor: "#FFFFFF", borderRadius: 18, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: "#EC7C2C30" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Ionicons name="eye-outline" size={20} color="#EC7C2C" />
                <Text style={{ color: "#1B2036", fontSize: 16, fontWeight: "800" }}>Featured Impressions</Text>
              </View>
              <Text style={{ color: "#EC7C2C", fontSize: 28, fontWeight: "900" }}>—</Text>
              <Text style={{ color: "#8A90A0", fontSize: 13, marginTop: 4 }}>
                Impression analytics for featured products are tracked by the platform. Contact admin for detailed reports.
              </Text>
            </View>
          )}

          {/* Pending products */}
          {dash.pendingProducts > 0 && (
            <View style={{ backgroundColor: "#E0950B15", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E0950B40", flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Ionicons name="time-outline" size={22} color="#E0950B" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#1B2036", fontWeight: "700" }}>{dash.pendingProducts} product{dash.pendingProducts > 1 ? "s" : ""} awaiting review</Text>
                <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>Admin will review and approve your listings.</Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
