import { useApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatMoney } from "@/lib/utils";

export default function PackagesScreen() {
  const api    = useApi();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const qc     = useQueryClient();
  const [selectedPkg, setSelectedPkg] = useState<any>(null);
  const [phone,        setPhone]       = useState(user?.phone || "");

  const { data: pkgsData, isLoading } = useQuery({
    queryKey: ["packages"],
    queryFn: async () => { const { data } = await api.get("/packages"); return data; },
  });

  const { data: subData } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => { const { data } = await api.get("/users/subscription"); return data; },
  });

  const buyMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/payment/package", { packageId: selectedPkg.id, payerPhone: phone });
      return data;
    },
    onSuccess: () => {
      Alert.alert("Payment Initiated! 🎉", "Check your phone for the payment prompt. Your plan will activate once confirmed.", [
        { text: "OK", onPress: () => { setSelectedPkg(null); qc.invalidateQueries({ queryKey: ["subscription"] }); } },
      ]);
    },
    onError: (err: any) => Alert.alert("Payment Failed", err?.response?.data?.error || err.message),
  });

  const packages = (pkgsData?.packages || []).filter((p: any) => p.type === user?.role || p.type === "customer");
  const currentSub = subData?.subscription;
  const daysLeft = currentSub?.expires_at ? Math.ceil((new Date(currentSub.expires_at).getTime() - Date.now()) / 86400000) : null;

  const COLORS = ["#3B82F6","#F97316","#8B5CF6"];

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <StatusBar style="light" />
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#1E293B", flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={26} color="#F97316" /></TouchableOpacity>
        <Text style={{ color: "#F8FAFC", fontSize: 20, fontWeight: "800" }}>Packages & Plans</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {/* Current plan */}
        {currentSub && (
          <View style={{ backgroundColor: "#1E293B", borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#22C55E40", flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Ionicons name="checkmark-circle" size={28} color="#22C55E" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "800" }}>Current Plan: {currentSub.package_id?.replace(/_/g," ").toUpperCase()}</Text>
              <Text style={{ color: daysLeft && daysLeft < 7 ? "#EF4444" : "#94A3B8", fontSize: 12, marginTop: 2 }}>
                {daysLeft !== null && daysLeft > 0 ? `${daysLeft} days remaining` : daysLeft === 0 ? "Expires today!" : "Expired"}
              </Text>
            </View>
          </View>
        )}

        {isLoading ? <ActivityIndicator color="#F97316" size="large" style={{ marginTop: 40 }} /> : (
          <View style={{ gap: 14 }}>
            {packages.map((pkg: any, idx: number) => {
              const features = Array.isArray(pkg.features) ? pkg.features : JSON.parse(pkg.features || "[]");
              const color    = COLORS[idx % COLORS.length];
              const isCurrent = currentSub?.package_id === pkg.id;
              return (
                <View key={pkg.id} style={{ backgroundColor: "#1E293B", borderRadius: 20, overflow: "hidden", borderWidth: 2, borderColor: isCurrent ? "#22C55E" : color + "40" }}>
                  {isCurrent && (
                    <View style={{ backgroundColor: "#22C55E", paddingVertical: 4, alignItems: "center" }}>
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>CURRENT PLAN</Text>
                    </View>
                  )}
                  <View style={{ padding: 20 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                      <View>
                        <Text style={{ color: color, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>
                          {pkg.type}
                        </Text>
                        <Text style={{ color: "#F8FAFC", fontSize: 22, fontWeight: "900" }}>{pkg.name}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        {pkg.is_free ? (
                          <Text style={{ color: "#22C55E", fontSize: 26, fontWeight: "900" }}>Free</Text>
                        ) : (
                          <>
                            <Text style={{ color: color, fontSize: 24, fontWeight: "900" }}>{formatMoney(pkg.price)}</Text>
                            <Text style={{ color: "#64748B", fontSize: 12 }}>/{pkg.duration_days} days</Text>
                          </>
                        )}
                      </View>
                    </View>

                    <View style={{ gap: 8, marginBottom: 16 }}>
                      {features.map((f: string, i: number) => (
                        <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                          <Ionicons name="checkmark-circle" size={16} color={color} style={{ marginTop: 1 }} />
                          <Text style={{ color: "#CBD5E1", fontSize: 13, flex: 1 }}>{f}</Text>
                        </View>
                      ))}
                    </View>

                    {!pkg.is_free && !isCurrent && (
                      <TouchableOpacity onPress={() => setSelectedPkg(pkg)}
                        style={{ backgroundColor: color, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
                        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Get {pkg.name}</Text>
                      </TouchableOpacity>
                    )}
                    {pkg.is_free && !currentSub && (
                      <View style={{ backgroundColor: "#22C55E20", borderRadius: 14, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#22C55E40" }}>
                        <Text style={{ color: "#22C55E", fontWeight: "700" }}>✓ Your current plan</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Purchase modal */}
      {selectedPkg && (
        <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#1E293B", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: insets.bottom + 24 }}>
            <Text style={{ color: "#F8FAFC", fontSize: 22, fontWeight: "900", marginBottom: 4 }}>{selectedPkg.name}</Text>
            <Text style={{ color: "#F97316", fontSize: 28, fontWeight: "900", marginBottom: 20 }}>{formatMoney(selectedPkg.price)}</Text>

            <Text style={{ color: "#94A3B8", fontSize: 12, fontWeight: "600", marginBottom: 8 }}>Mobile Money Number</Text>
            <View style={{ backgroundColor: "#0F172A", borderWidth: 1, borderColor: "#334155", borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
              <Text style={{ color: "#94A3B8", marginRight: 8 }}>🇹🇿</Text>
              <TextInput value={phone} onChangeText={setPhone} placeholder="0712 345 678" placeholderTextColor="#475569" keyboardType="phone-pad"
                style={{ flex: 1, color: "#F8FAFC", fontSize: 15, paddingVertical: 15 }} />
            </View>

            <View style={{ gap: 10 }}>
              <TouchableOpacity onPress={() => buyMutation.mutate()} disabled={buyMutation.isPending || !phone}
                style={{ backgroundColor: "#F97316", borderRadius: 14, paddingVertical: 17, alignItems: "center", opacity: !phone ? 0.5 : 1 }}>
                {buyMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Pay {formatMoney(selectedPkg.price)}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelectedPkg(null)} style={{ paddingVertical: 14, alignItems: "center" }}>
                <Text style={{ color: "#64748B", fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
