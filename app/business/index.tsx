import { useApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatMoney, timeAgo, getStatusColor } from "@/lib/utils";
import LocationPickerModal from "@/components/LocationPickerModal";

const ORANGE = "#EC7C2C";
const BLUE   = "#2563EB";
const NAVY   = "#F4F5F8";
const CARD   = "#FFFFFF";
const BORDER = "#E6E8EE";

type Tab = "home" | "analytics" | "upload" | "wallet";

const ORDER_LABELS: Record<string, string> = {
  awaiting_payment: "Awaiting Payment", pending: "Pending", processing: "Processing",
  shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled",
};

export default function SellerDashboardScreen() {
  const api    = useApi();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const qc     = useQueryClient();
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab: Tab = (["home","analytics","upload","wallet"].includes(params.tab || "") ? params.tab : "home") as Tab;
  const [tab, setTab] = useState<Tab>(initialTab);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ["seller-dashboard"],
    queryFn: async () => { const { data } = await api.get("/seller/dashboard"); return data; },
  });
  const { data: ordersData } = useQuery({
    queryKey: ["seller-orders"],
    queryFn: async () => { const { data } = await api.get("/orders/seller/mine"); return data; },
  });
  const { data: productsData } = useQuery({
    queryKey: ["seller-products"],
    queryFn: async () => { const { data } = await api.get("/products/seller/mine"); return data; },
  });
  const { data: catsData } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => { const { data } = await api.get("/products/categories"); return data; },
    staleTime: 5 * 60_000,
  });
  const { data: wdData } = useQuery({
    queryKey: ["seller-withdrawals"],
    queryFn: async () => { const { data } = await api.get("/payment/withdrawals/my"); return data; },
    enabled: tab === "wallet" || tab === "home",
  });
  const { data: subData } = useQuery({
    queryKey: ["seller-subscription"],
    queryFn: async () => { const { data } = await api.get("/users/subscription"); return data; },
  });

  const dash     = dashData || {};
  const orders   = ordersData?.orders || [];
  const products = productsData?.products || [];
  const cats     = catsData?.categories || [];
  const withdrawals = wdData?.withdrawals || [];
  const sub      = subData?.subscription;

  const balance      = parseFloat(dash.balance || 0);
  const totalRevenue = parseFloat(dash.totalRevenue || 0);
  const totalOrders  = dash.totalOrders || 0;
  const pendingOrders= dash.pendingOrders || 0;
  const deliveredCount = orders.filter((o: any) => o.status === "delivered").length;
  const successRate  = orders.length ? Math.round((deliveredCount / orders.length) * 1000) / 10 : 100;

  // Today's sales
  const todaySales = useMemo(() => {
    const today = new Date().toDateString();
    return orders
      .filter((o: any) => new Date(o.created_at).toDateString() === today && o.payment_status === "success")
      .reduce((s: number, o: any) => s + parseFloat(o.total_price || 0), 0);
  }, [orders]);
  const dailyTarget = 100000;
  const targetPct = Math.min(100, Math.round((todaySales / dailyTarget) * 100));

  return (
    <View style={{ flex: 1, backgroundColor: NAVY }}>
      <StatusBar style="dark" />
      {/* Top bar */}
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: CARD }}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={ORANGE} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#1B2036", fontSize: 18, fontWeight: "800" }}>Seller Dashboard</Text>
          <Text style={{ color: "#8A90A0", fontSize: 12 }}>{user?.name}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/seller-chat")} style={{ backgroundColor: CARD, borderRadius: 12, padding: 9 }}>
          <Ionicons name="chatbubbles-outline" size={20} color={ORANGE} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {tab === "home" && <ShopLocationCard api={api} />}
          {tab === "home" && (
            <HomeTab
              balance={balance} totalRevenue={totalRevenue} todaySales={todaySales}
              targetPct={targetPct} pendingOrders={pendingOrders} successRate={successRate}
              orders={orders} withdrawals={withdrawals} dashLoading={dashLoading}
              onUpload={() => setTab("upload")} onWithdraw={() => setTab("wallet")}
            />
          )}
          {tab === "analytics" && (
            <AnalyticsTab orders={orders} products={products} totalRevenue={totalRevenue} totalOrders={totalOrders} sub={sub} />
          )}
          {tab === "upload" && (
            <UploadTab api={api} cats={cats} onDone={() => { qc.invalidateQueries({ queryKey: ["seller-products"] }); setTab("home"); }} />
          )}
          {tab === "wallet" && (
            <WalletTab api={api} balance={balance} totalSales={parseFloat(dash.totalSales || 0)} withdrawals={withdrawals}
              onDone={() => { qc.invalidateQueries({ queryKey: ["seller-dashboard"] }); qc.invalidateQueries({ queryKey: ["seller-withdrawals"] }); }} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom tab bar */}
      <View style={{ flexDirection: "row", backgroundColor: NAVY, borderTopWidth: 1, borderTopColor: CARD, paddingTop: 8, paddingBottom: insets.bottom + 8, paddingHorizontal: 8 }}>
        {([
          { key: "home",      icon: "grid",        label: "Home" },
          { key: "analytics", icon: "bar-chart",   label: "Analytics" },
          { key: "upload",    icon: "cloud-upload",label: "Upload" },
          { key: "wallet",    icon: "wallet",      label: "Wallet" },
        ] as { key: Tab; icon: any; label: string }[]).map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={{ flex: 1, alignItems: "center", gap: 3 }}>
              <View style={{ backgroundColor: active ? ORANGE + "22" : "transparent", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 5 }}>
                <Ionicons name={(active ? t.icon : t.icon + "-outline") as any} size={22} color={active ? ORANGE : "#8A90A0"} />
              </View>
              <Text style={{ color: active ? ORANGE : "#8A90A0", fontSize: 11, fontWeight: active ? "800" : "600" }}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
function HomeTab({ balance, totalRevenue, todaySales, targetPct, pendingOrders, successRate, orders, withdrawals, dashLoading, onUpload, onWithdraw }: any) {
  const activity = useMemo(() => {
    const items: any[] = [];
    orders.slice(0, 4).forEach((o: any) => items.push({
      id: "o" + o.id, icon: "cube-outline", color: BLUE,
      title: `Order #${o.id.slice(-6).toUpperCase()}`, time: o.created_at,
      amount: "+" + formatMoney(o.total_price), tag: (ORDER_LABELS[o.status] || o.status).toUpperCase(), tagColor: getStatusColor(o.status),
    }));
    withdrawals.slice(0, 2).forEach((w: any) => items.push({
      id: "w" + w.id, icon: "arrow-up-circle-outline", color: "#E0950B",
      title: "Withdrawal", time: w.created_at, amount: "-" + formatMoney(w.amount),
      tag: w.status.toUpperCase(), tagColor: w.status === "completed" ? "#16A34A" : "#E0950B",
    }));
    return items.sort((a, b) => +new Date(b.time) - +new Date(a.time)).slice(0, 5);
  }, [orders, withdrawals]);

  return (
    <>
      {/* Total Earnings */}
      <View style={{ backgroundColor: BLUE, borderRadius: 20, padding: 20, marginBottom: 16 }}>
        <Text style={{ color: "#DBEAFE", fontSize: 13, fontWeight: "600" }}>Total Earnings</Text>
        <Text style={{ color: "#fff", fontSize: 34, fontWeight: "900", marginTop: 4 }}>{dashLoading ? "…" : formatMoney(totalRevenue)}</Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          <TouchableOpacity onPress={onUpload} style={{ flex: 1, backgroundColor: "#fff", borderRadius: 12, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Ionicons name="cloud-upload-outline" size={18} color={BLUE} />
            <Text style={{ color: BLUE, fontWeight: "800", fontSize: 13 }}>Upload Product</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onWithdraw} style={{ flex: 1, backgroundColor: "#1D4ED8", borderRadius: 12, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Ionicons name="cash-outline" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>Withdraw</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Today's Sales */}
      <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: BORDER }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: "#6B7280", fontSize: 13 }}>Today's Sales</Text>
          <Text style={{ color: "#16A34A", fontSize: 12, fontWeight: "700" }}>↗ {targetPct}%</Text>
        </View>
        <Text style={{ color: "#1B2036", fontSize: 26, fontWeight: "900", marginTop: 4 }}>{formatMoney(todaySales)}</Text>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: "#F4F5F8", marginTop: 12, overflow: "hidden" }}>
          <View style={{ width: `${targetPct}%`, height: "100%", backgroundColor: "#14B8A6", borderRadius: 4 }} />
        </View>
        <Text style={{ color: "#8A90A0", fontSize: 11, marginTop: 8 }}>{targetPct}% of daily target reached</Text>
      </View>

      {/* Pending / Success */}
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 18 }}>
        <View style={{ flex: 1, backgroundColor: CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER }}>
          <Text style={{ color: "#6B7280", fontSize: 12 }}>Pending</Text>
          <Text style={{ color: "#E0950B", fontSize: 26, fontWeight: "900", marginTop: 6 }}>{pendingOrders}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER }}>
          <Text style={{ color: "#6B7280", fontSize: 12 }}>Success</Text>
          <Text style={{ color: "#16A34A", fontSize: 26, fontWeight: "900", marginTop: 6 }}>{successRate}%</Text>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Text style={{ color: "#1B2036", fontSize: 17, fontWeight: "800" }}>Recent Activity</Text>
      </View>
      {activity.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 30 }}>
          <Ionicons name="pulse-outline" size={40} color="#E6E8EE" />
          <Text style={{ color: "#8A90A0", marginTop: 10 }}>No activity yet</Text>
        </View>
      ) : activity.map((a) => (
        <View key={a.id} style={{ backgroundColor: CARD, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: BORDER }}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: a.color + "22", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={a.icon} size={20} color={a.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#1B2036", fontWeight: "700", fontSize: 14 }}>{a.title}</Text>
            <Text style={{ color: "#8A90A0", fontSize: 11, marginTop: 2 }}>{timeAgo(a.time)}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: a.amount.startsWith("-") ? "#DC2626" : "#16A34A", fontWeight: "800", fontSize: 13 }}>{a.amount}</Text>
            <View style={{ backgroundColor: a.tagColor + "22", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1, marginTop: 3 }}>
              <Text style={{ color: a.tagColor, fontSize: 9, fontWeight: "800" }}>{a.tag}</Text>
            </View>
          </View>
        </View>
      ))}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
function AnalyticsTab({ orders, products, totalRevenue, totalOrders, sub }: any) {
  const [range, setRange] = useState<"Week" | "Month" | "Year">("Week");

  const series = useMemo(() => {
    const days = range === "Week" ? 7 : range === "Month" ? 30 : 12;
    const buckets: { label: string; value: number }[] = [];
    const now = new Date();
    if (range === "Year") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const val = orders.filter((o: any) => { const od = new Date(o.created_at); return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear(); })
          .reduce((s: number, o: any) => s + parseFloat(o.total_price || 0), 0);
        buckets.push({ label: d.toLocaleString("en", { month: "short" }), value: val });
      }
    } else {
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now); d.setDate(now.getDate() - i);
        const val = orders.filter((o: any) => new Date(o.created_at).toDateString() === d.toDateString())
          .reduce((s: number, o: any) => s + parseFloat(o.total_price || 0), 0);
        buckets.push({ label: `${d.getDate()}`, value: val });
      }
    }
    return buckets;
  }, [orders, range]);

  const maxVal = Math.max(1, ...series.map((s) => s.value));
  const conversion = orders.length ? Math.min(100, Math.round((orders.filter((o:any)=>o.payment_status==="success").length / Math.max(1, orders.length)) * 1000) / 10) : 0;
  const topProducts = [...products].sort((a: any, b: any) => (b.total_reviews||0) - (a.total_reviews||0)).slice(0, 3);

  return (
    <>
      {/* Range tabs */}
      <View style={{ flexDirection: "row", backgroundColor: CARD, borderRadius: 12, padding: 4, marginBottom: 16 }}>
        {(["Week", "Month", "Year"] as const).map((r) => (
          <TouchableOpacity key={r} onPress={() => setRange(r)} style={{ flex: 1, paddingVertical: 9, borderRadius: 9, backgroundColor: range === r ? ORANGE : "transparent", alignItems: "center" }}>
            <Text style={{ color: range === r ? "#fff" : "#6B7280", fontWeight: "700", fontSize: 13 }}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stat tiles */}
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 14 }}>
        <View style={{ flex: 1, backgroundColor: CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER }}>
          <Text style={{ color: "#6B7280", fontSize: 12 }}>Total Orders</Text>
          <Text style={{ color: "#1B2036", fontSize: 22, fontWeight: "900", marginTop: 6 }}>{totalOrders}</Text>
          <Text style={{ color: "#16A34A", fontSize: 11, marginTop: 2 }}>↗ live</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER }}>
          <Text style={{ color: "#6B7280", fontSize: 12 }}>Conversion</Text>
          <Text style={{ color: "#1B2036", fontSize: 22, fontWeight: "900", marginTop: 6 }}>{conversion}%</Text>
          <Text style={{ color: "#16A34A", fontSize: 11, marginTop: 2 }}>paid orders</Text>
        </View>
      </View>

      {/* Revenue Growth chart */}
      <View style={{ backgroundColor: CARD, borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: BORDER }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: "#6B7280", fontSize: 13 }}>Revenue Growth</Text>
          <View style={{ backgroundColor: "#F4F5F8", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: "#8A90A0", fontSize: 10, fontWeight: "700" }}>LAST {range === "Year" ? "12 MO" : range === "Month" ? "30 DAYS" : "7 DAYS"}</Text>
          </View>
        </View>
        <Text style={{ color: ORANGE, fontSize: 26, fontWeight: "900", marginTop: 6, marginBottom: 16 }}>{formatMoney(totalRevenue)}</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", height: 120, gap: 4 }}>
          {series.map((s, i) => (
            <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
              <View style={{ width: "70%", height: `${Math.max(3, (s.value / maxVal) * 100)}%`, backgroundColor: s.value > 0 ? ORANGE : "#E6E8EE", borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
          <Text style={{ color: "#A0A6B4", fontSize: 10 }}>{series[0]?.label}</Text>
          <Text style={{ color: "#A0A6B4", fontSize: 10 }}>{series[Math.floor(series.length / 2)]?.label}</Text>
          <Text style={{ color: "#A0A6B4", fontSize: 10 }}>{series[series.length - 1]?.label}</Text>
        </View>
      </View>

      {/* Top Performing */}
      <View style={{ backgroundColor: CARD, borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: BORDER }}>
        <Text style={{ color: "#1B2036", fontSize: 15, fontWeight: "800", marginBottom: 14 }}>Top Performing Products</Text>
        {topProducts.length === 0 ? (
          <Text style={{ color: "#8A90A0", fontSize: 13 }}>No products yet — add some in the Upload tab.</Text>
        ) : topProducts.map((p: any) => (
          <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 9, backgroundColor: ORANGE + "22", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="cube" size={18} color={ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#1B2036", fontWeight: "700", fontSize: 14 }} numberOfLines={1}>{p.name}</Text>
              <Text style={{ color: "#8A90A0", fontSize: 11 }}>{p.total_reviews || 0} reviews · ★ {parseFloat(p.avg_rating || 0).toFixed(1)}</Text>
            </View>
            <Text style={{ color: ORANGE, fontWeight: "800", fontSize: 13 }}>{formatMoney(p.price)}</Text>
          </View>
        ))}
      </View>

      {/* Insights */}
      <Text style={{ color: "#8A90A0", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 8 }}>INSIGHTS & ALERTS</Text>
      <View style={{ backgroundColor: "#2E3A74", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#2E3A74" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Ionicons name="sparkles" size={16} color={BLUE} />
          <Text style={{ color: BLUE, fontWeight: "800", fontSize: 14 }}>Optimization Tip</Text>
        </View>
        <Text style={{ color: "#6B7280", fontSize: 13, lineHeight: 19 }}>
          {sub && sub.package_id !== "seller_free"
            ? "You're on a paid plan — your products get featured priority. Keep stock updated to maximise conversion."
            : "Upgrade your plan to get featured placement and reach more customers. Tap Packages in your profile."}
        </Text>
      </View>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
function UploadTab({ api, cats, onDone }: any) {
  const [images, setImages] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [showCats, setShowCats] = useState(false);

  const submit = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("description", description.trim());
      fd.append("price", price);
      if (stock) fd.append("stock", stock);
      if (categoryId) fd.append("category_id", categoryId);
      images.forEach((uri, i) => fd.append("images", { uri, name: `product_${i}.jpg`, type: "image/jpeg" } as any));
      const { data } = await api.post("/products", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 });
      return data;
    },
    onSuccess: () => {
      Alert.alert("Submitted ✓", "Your product was sent for review and will go live once approved.");
      setImages([]); setName(""); setDescription(""); setPrice(""); setStock(""); setCategoryId("");
      onDone();
    },
    onError: (e: any) => Alert.alert("Failed", e?.response?.data?.error || e.message),
  });

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission required", "Grant photo access to upload product images."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.8, selectionLimit: 6 });
    if (!result.canceled) setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 6));
  };

  const selectedCat = cats.find((c: any) => c.id === categoryId);
  const canSubmit = name.trim() && price.trim() && !submit.isPending;

  const inputStyle = { backgroundColor: NAVY, borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: "#1B2036", fontSize: 15 } as const;

  return (
    <>
      <Text style={{ color: "#1B2036", fontSize: 22, fontWeight: "900" }}>Upload Product</Text>
      <Text style={{ color: "#8A90A0", fontSize: 13, marginTop: 2, marginBottom: 18 }}>Add new inventory items to your storefront.</Text>

      {/* Drop zone */}
      <TouchableOpacity onPress={pickImages} activeOpacity={0.8}
        style={{ borderWidth: 2, borderColor: BORDER, borderStyle: "dashed", borderRadius: 16, paddingVertical: 30, alignItems: "center", marginBottom: 14 }}>
        <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: CARD, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
          <Ionicons name="camera-outline" size={26} color={ORANGE} />
        </View>
        <Text style={{ color: "#1B2036", fontWeight: "700", fontSize: 14 }}>Tap to select images</Text>
        <Text style={{ color: ORANGE, fontSize: 12, marginTop: 4 }}>High resolution PNG, JPG · up to 6</Text>
      </TouchableOpacity>

      {images.length > 0 && (
        <>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: "#6B7280", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 }}>GALLERY</Text>
            <Text style={{ color: ORANGE, fontSize: 11, fontWeight: "700" }}>{6 - images.length} slots left</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 10 }}>
            {images.map((uri, i) => (
              <View key={i} style={{ width: 96 }}>
                <Image source={{ uri }} style={{ width: 96, height: 96, borderRadius: 12, backgroundColor: CARD }} contentFit="cover" />
                <TouchableOpacity onPress={() => setImages((p) => p.filter((_, idx) => idx !== i))}
                  style={{ position: "absolute", top: -6, right: -6, backgroundColor: "#DC2626", borderRadius: 11, width: 22, height: 22, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {/* Form */}
      <Text style={{ color: "#6B7280", fontSize: 13, fontWeight: "700", marginBottom: 6 }}>Product Name *</Text>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. Premium Leather Satchel" placeholderTextColor="#A0A6B4" style={[inputStyle, { marginBottom: 14 }]} />

      <Text style={{ color: "#6B7280", fontSize: 13, fontWeight: "700", marginBottom: 6 }}>Description</Text>
      <TextInput value={description} onChangeText={setDescription} placeholder="Describe the item features and specifications…" placeholderTextColor="#A0A6B4"
        multiline numberOfLines={4} style={[inputStyle, { marginBottom: 14, height: 96, textAlignVertical: "top" }]} />

      <View style={{ flexDirection: "row", gap: 12, marginBottom: 14 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#6B7280", fontSize: 13, fontWeight: "700", marginBottom: 6 }}>Price (TZS) *</Text>
          <TextInput value={price} onChangeText={setPrice} placeholder="0" placeholderTextColor="#A0A6B4" keyboardType="numeric" style={inputStyle} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#6B7280", fontSize: 13, fontWeight: "700", marginBottom: 6 }}>Stock</Text>
          <TextInput value={stock} onChangeText={setStock} placeholder="0" placeholderTextColor="#A0A6B4" keyboardType="numeric" style={inputStyle} />
        </View>
      </View>

      <Text style={{ color: "#6B7280", fontSize: 13, fontWeight: "700", marginBottom: 6 }}>Category</Text>
      <TouchableOpacity onPress={() => setShowCats((s) => !s)} style={[inputStyle, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: showCats ? 0 : 18 }]}>
        <Text style={{ color: selectedCat ? "#1B2036" : "#A0A6B4", fontSize: 15 }}>{selectedCat?.name || "Select category"}</Text>
        <Ionicons name={showCats ? "chevron-up" : "chevron-down"} size={18} color="#8A90A0" />
      </TouchableOpacity>
      {showCats && (
        <View style={{ backgroundColor: NAVY, borderWidth: 1, borderColor: BORDER, borderRadius: 12, marginTop: 6, marginBottom: 18, overflow: "hidden" }}>
          {cats.map((c: any) => (
            <TouchableOpacity key={c.id} onPress={() => { setCategoryId(c.id); setShowCats(false); }}
              style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: CARD, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name={(c.icon || "grid-outline") as any} size={16} color={c.color || "#6B7280"} />
              <Text style={{ color: "#1B2036", fontSize: 14 }}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity onPress={() => submit.mutate()} disabled={!canSubmit}
        style={{ backgroundColor: BLUE, borderRadius: 14, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, opacity: canSubmit ? 1 : 0.5 }}>
        {submit.isPending ? <ActivityIndicator color="#fff" /> : <><Ionicons name="paper-plane-outline" size={18} color="#fff" /><Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Submit Product Listing</Text></>}
      </TouchableOpacity>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
function WalletTab({ api, balance, totalSales, withdrawals, onDone }: any) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"mobile_money" | "bank">("mobile_money");
  const [mobile, setMobile] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      const body: any = { amount: parseFloat(amount), method };
      if (method === "mobile_money") { body.mobileNumber = mobile; body.accountName = accountName; }
      else { body.accountNumber = accountNumber; body.accountName = accountName; body.bankName = bankName; }
      const { data } = await api.post("/payment/withdraw", body);
      return data;
    },
    onSuccess: (d: any) => {
      Alert.alert("Withdrawal Requested ✓", d?.message || "Your withdrawal is being processed.");
      setAmount(""); setMobile(""); setAccountNumber("");
      onDone();
    },
    onError: (e: any) => Alert.alert("Failed", e?.response?.data?.error || e.message),
  });

  const quick = [50000, 100000, 200000];
  const valid = parseFloat(amount) >= 1000 && (method === "mobile_money" ? mobile.trim().length >= 9 : (accountNumber.trim() && bankName.trim()));
  const inputStyle = { backgroundColor: NAVY, borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: "#1B2036", fontSize: 15 } as const;

  return (
    <>
      {/* Balance */}
      <View style={{ backgroundColor: BLUE, borderRadius: 20, padding: 20, marginBottom: 16 }}>
        <Text style={{ color: "#DBEAFE", fontSize: 13, fontWeight: "600" }}>Available Balance</Text>
        <Text style={{ color: "#fff", fontSize: 32, fontWeight: "900", marginTop: 4 }}>{formatMoney(balance)}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
          <Ionicons name="information-circle-outline" size={14} color="#DBEAFE" />
          <Text style={{ color: "#DBEAFE", fontSize: 12 }}>Total sales: {formatMoney(totalSales)}</Text>
        </View>
      </View>

      {/* Amount */}
      <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: BORDER }}>
        <Text style={{ color: "#6B7280", fontSize: 13, fontWeight: "700", marginBottom: 8 }}>Withdrawal Amount</Text>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: NAVY, borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14 }}>
          <Text style={{ color: "#8A90A0", fontSize: 16, fontWeight: "700" }}>TZS</Text>
          <TextInput value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor="#A0A6B4" keyboardType="numeric"
            style={{ flex: 1, color: "#1B2036", fontSize: 20, fontWeight: "800", paddingVertical: 12, marginLeft: 8 }} />
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          {quick.map((q) => (
            <TouchableOpacity key={q} onPress={() => setAmount(String(q))}
              style={{ flex: 1, backgroundColor: NAVY, borderWidth: 1, borderColor: amount === String(q) ? ORANGE : BORDER, borderRadius: 10, paddingVertical: 10, alignItems: "center" }}>
              <Text style={{ color: amount === String(q) ? ORANGE : "#6B7280", fontWeight: "700", fontSize: 13 }}>{(q / 1000)}k</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Method */}
      <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: BORDER }}>
        <Text style={{ color: "#6B7280", fontSize: 13, fontWeight: "700", marginBottom: 10 }}>Withdraw to</Text>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
          {([["mobile_money", "phone-portrait-outline", "Mobile Money"], ["bank", "business-outline", "Bank"]] as const).map(([m, ic, label]) => (
            <TouchableOpacity key={m} onPress={() => setMethod(m as any)}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: method === m ? ORANGE : BORDER, backgroundColor: method === m ? ORANGE + "15" : NAVY }}>
              <Ionicons name={ic as any} size={18} color={method === m ? ORANGE : "#8A90A0"} />
              <Text style={{ color: method === m ? ORANGE : "#6B7280", fontWeight: "700", fontSize: 13 }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {method === "mobile_money" ? (
          <>
            <TextInput value={mobile} onChangeText={setMobile} placeholder="Mobile money number (07XX XXX XXX)" placeholderTextColor="#A0A6B4" keyboardType="phone-pad" style={[inputStyle, { marginBottom: 10 }]} />
            <TextInput value={accountName} onChangeText={setAccountName} placeholder="Account holder name" placeholderTextColor="#A0A6B4" style={inputStyle} />
          </>
        ) : (
          <>
            <TextInput value={bankName} onChangeText={setBankName} placeholder="Bank name (e.g. CRDB, NMB)" placeholderTextColor="#A0A6B4" style={[inputStyle, { marginBottom: 10 }]} />
            <TextInput value={accountNumber} onChangeText={setAccountNumber} placeholder="Account number" placeholderTextColor="#A0A6B4" keyboardType="numeric" style={[inputStyle, { marginBottom: 10 }]} />
            <TextInput value={accountName} onChangeText={setAccountName} placeholder="Account holder name" placeholderTextColor="#A0A6B4" style={inputStyle} />
          </>
        )}
      </View>

      <TouchableOpacity onPress={() => submit.mutate()} disabled={!valid || submit.isPending}
        style={{ backgroundColor: BLUE, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginBottom: 8, opacity: valid && !submit.isPending ? 1 : 0.5 }}>
        {submit.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Confirm Withdrawal</Text>}
      </TouchableOpacity>
      <Text style={{ color: "#8A90A0", fontSize: 11, textAlign: "center", marginBottom: 20 }}>Minimum TZS 1,000 · Mobile money arrives within minutes.</Text>

      {/* Recent withdrawals */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Text style={{ color: "#1B2036", fontSize: 16, fontWeight: "800" }}>Recent Withdrawals</Text>
      </View>
      {withdrawals.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <Ionicons name="receipt-outline" size={36} color="#E6E8EE" />
          <Text style={{ color: "#8A90A0", marginTop: 8, fontSize: 13 }}>No withdrawals yet</Text>
        </View>
      ) : withdrawals.map((w: any) => (
        <View key={w.id} style={{ backgroundColor: CARD, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: BORDER }}>
          <View style={{ width: 38, height: 38, borderRadius: 9, backgroundColor: "#F4F5F8", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={w.method === "bank" ? "business-outline" : "phone-portrait-outline"} size={18} color="#6B7280" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#1B2036", fontWeight: "700", fontSize: 14 }}>{w.bank_name || "Mobile Money"}</Text>
            <Text style={{ color: "#8A90A0", fontSize: 11, marginTop: 2 }}>{timeAgo(w.created_at)}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: "#DC2626", fontWeight: "800", fontSize: 13 }}>-{formatMoney(w.amount)}</Text>
            <Text style={{ color: w.status === "completed" ? "#16A34A" : w.status === "failed" ? "#DC2626" : "#E0950B", fontSize: 10, fontWeight: "700", marginTop: 2, textTransform: "capitalize" }}>{w.status}</Text>
          </View>
        </View>
      ))}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Where drivers collect this shop's orders. Without it, customers can't get delivery.
function ShopLocationCard({ api }: any) {
  const qc = useQueryClient();
  const [picking, setPicking] = useState(false);
  const { data } = useQuery({
    queryKey: ["seller-profile"],
    queryFn: async () => { const { data } = await api.get("/seller/profile"); return data.profile; },
  });
  const save = useMutation({
    mutationFn: async (p: { latitude: number; longitude: number; address: string }) => {
      await api.put("/seller/profile", { shop_lat: p.latitude, shop_lng: p.longitude, shop_address: p.address });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["seller-profile"] }); Alert.alert("Saved", "Drivers will now come to this location to collect your orders."); },
    onError: (e: any) => Alert.alert("Could not save", e?.response?.data?.error || e.message),
  });
  if (!data) return null;
  const hasLocation = data.shop_lat != null && data.shop_lng != null;
  const point = hasLocation ? { latitude: Number(data.shop_lat), longitude: Number(data.shop_lng) } : null;

  return (
    <View style={{ backgroundColor: hasLocation ? CARD : "#FFF7ED", borderRadius: 18, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: hasLocation ? BORDER : ORANGE + "60" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: ORANGE + "20", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={hasLocation ? "storefront" : "alert-circle"} size={20} color={ORANGE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#1B2036", fontWeight: "800", fontSize: 15 }}>{hasLocation ? "Shop pickup location" : "Add your shop location"}</Text>
          <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }} numberOfLines={2}>
            {hasLocation ? data.shop_address || `${point!.latitude.toFixed(5)}, ${point!.longitude.toFixed(5)}` : "Drivers need it to collect orders. Customers can't request delivery until it's set."}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setPicking(true)} disabled={save.isPending}
          style={{ backgroundColor: hasLocation ? "#F4F5F8" : ORANGE, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 }}>
          {save.isPending
            ? <ActivityIndicator size="small" color={hasLocation ? ORANGE : "#fff"} />
            : <Text style={{ color: hasLocation ? ORANGE : "#fff", fontWeight: "800", fontSize: 13 }}>{hasLocation ? "Change" : "Set"}</Text>}
        </TouchableOpacity>
      </View>
      <LocationPickerModal
        visible={picking}
        title="Where is your shop?"
        hint="Stand at the shop and tap the target button, or move the map so the pin is on the entrance."
        initial={point}
        confirmLabel="Save shop location"
        onClose={() => setPicking(false)}
        onConfirm={(p) => { setPicking(false); save.mutate(p); }}
      />
    </View>
  );
}
