import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatMoney } from "@/lib/utils";

export default function OrderConfirmedScreen() {
  const { orderId, total } = useLocalSearchParams<{ orderId: string; total: string }>();
  const insets = useSafeAreaInsets();
  const [showDeliveryModal, setShowDeliveryModal] = useState(true);

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 28, paddingTop: insets.top + 40 }}>
        {/* Success icon */}
        <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: "#22C55E20", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#22C55E", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="checkmark" size={40} color="#fff" />
          </View>
        </View>

        <Text style={{ color: "#F8FAFC", fontSize: 28, fontWeight: "900", marginBottom: 8, textAlign: "center" }}>Order Placed!</Text>
        <Text style={{ color: "#22C55E", fontSize: 16, fontWeight: "700", marginBottom: 6 }}>{formatMoney(parseFloat(total || "0"))}</Text>
        <Text style={{ color: "#64748B", fontSize: 14, textAlign: "center", lineHeight: 22 }}>
          Payment initiated. Check your phone for the M-Pesa/Airtel prompt.
        </Text>

        <View style={{ backgroundColor: "#1E293B", borderRadius: 16, padding: 18, width: "100%", marginTop: 28, borderWidth: 1, borderColor: "#334155" }}>
          <Text style={{ color: "#94A3B8", fontSize: 12, marginBottom: 4 }}>Order ID</Text>
          <Text style={{ color: "#F8FAFC", fontWeight: "700", fontFamily: "monospace" }}>#{orderId?.slice(-8).toUpperCase()}</Text>
        </View>

        <View style={{ width: "100%", gap: 10, marginTop: 28 }}>
          <TouchableOpacity onPress={() => router.push("/(profile)/orders")}
            style={{ backgroundColor: "#F97316", borderRadius: 14, paddingVertical: 16, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>View My Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace("/(tabs)")}
            style={{ backgroundColor: "#1E293B", borderRadius: 14, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: "#334155" }}>
            <Text style={{ color: "#94A3B8", fontWeight: "700", fontSize: 15 }}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Delivery offer modal */}
      {showDeliveryModal && (
        <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#1E293B", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: insets.bottom + 24, width: "100%", borderWidth: 1, borderColor: "#334155" }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#F9731620", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Ionicons name="bicycle" size={26} color="#F97316" />
            </View>
            <Text style={{ color: "#F8FAFC", fontSize: 22, fontWeight: "900", marginBottom: 8 }}>Need Delivery? 🚀</Text>
            <Text style={{ color: "#64748B", fontSize: 14, lineHeight: 22, marginBottom: 24 }}>
              Get your order delivered right to your door. Choose a bodaboda, bajaj, pickup, or toyo and track your rider live on the map.
            </Text>
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowDeliveryModal(false);
                  router.push({ pathname: "/ride/request", params: { orderId } });
                }}
                style={{ backgroundColor: "#F97316", borderRadius: 14, paddingVertical: 17, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
                <Ionicons name="navigate" size={20} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Yes, Request Delivery</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDeliveryModal(false)}
                style={{ borderRadius: 14, paddingVertical: 15, alignItems: "center" }}>
                <Text style={{ color: "#64748B", fontWeight: "600", fontSize: 15 }}>No thanks, I'll pick up myself</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
