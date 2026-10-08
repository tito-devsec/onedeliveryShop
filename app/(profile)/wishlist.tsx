import { useApi } from "@/lib/api";
import useWishlist from "@/hooks/useWishlist";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatMoney } from "@/lib/utils";

export default function WishlistScreen() {
  const insets = useSafeAreaInsets();
  const { wishlist, isLoading, removeFromWishlist } = useWishlist();

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <StatusBar style="light" />
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#1E293B", flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={26} color="#F97316" /></TouchableOpacity>
        <Text style={{ color: "#F8FAFC", fontSize: 20, fontWeight: "800" }}>Wishlist ({wishlist.length})</Text>
      </View>
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#F97316" size="large" /></View>
      ) : wishlist.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Ionicons name="heart-outline" size={60} color="#334155" />
          <Text style={{ color: "#F8FAFC", fontSize: 18, fontWeight: "700", marginTop: 16 }}>No saved items</Text>
          <Text style={{ color: "#64748B", textAlign: "center", marginTop: 8 }}>Save products you love and find them here.</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)")} style={{ backgroundColor: "#F97316", borderRadius: 14, paddingVertical: 13, paddingHorizontal: 24, marginTop: 20 }}>
            <Text style={{ color: "#fff", fontWeight: "800" }}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {wishlist.map((item: any) => {
            const imgs = Array.isArray(item.images) ? item.images : (typeof item.images === "string" ? JSON.parse(item.images || "[]") : []);
            return (
              <TouchableOpacity key={item.id || item.product_id} onPress={() => router.push(`/product/${item.id || item.product_id}`)} activeOpacity={0.85}
                style={{ backgroundColor: "#1E293B", borderRadius: 16, padding: 14, marginBottom: 12, flexDirection: "row", gap: 14, borderWidth: 1, borderColor: "#334155" }}>
                <Image source={imgs[0] ? { uri: imgs[0] } : require("../../assets/images/onedelivery-logo.png")}
                  style={{ width: 80, height: 80, borderRadius: 12, backgroundColor: "#334155" }} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#F8FAFC", fontWeight: "700", fontSize: 14 }} numberOfLines={2}>{item.name}</Text>
                  <Text style={{ color: "#F97316", fontWeight: "800", fontSize: 15, marginTop: 4 }}>{formatMoney(item.price)}</Text>
                </View>
                <TouchableOpacity onPress={() => removeFromWishlist(item.id || item.product_id)} style={{ padding: 8 }}>
                  <Ionicons name="heart" size={22} color="#EF4444" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
