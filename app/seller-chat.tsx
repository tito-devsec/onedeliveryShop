import { useApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { timeAgo } from "@/lib/utils";

export default function SellerChatScreen() {
  const api    = useApi();
  const insets = useSafeAreaInsets();

  const { data: convsData, isLoading } = useQuery({
    queryKey: ["seller-conversations"],
    queryFn: async () => { const { data } = await api.get("/chat/conversations"); return data; },
    refetchInterval: 10_000,
  });

  const conversations = convsData?.conversations || [];

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <StatusBar style="light" />
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#1E293B", flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={26} color="#F97316" /></TouchableOpacity>
        <Text style={{ color: "#F8FAFC", fontSize: 20, fontWeight: "800" }}>Customer Messages</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#F97316" size="large" /></View>
      ) : conversations.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chatbubbles-outline" size={60} color="#334155" />
          <Text style={{ color: "#F8FAFC", fontSize: 18, fontWeight: "700", marginTop: 16 }}>No messages yet</Text>
          <Text style={{ color: "#64748B", textAlign: "center", marginTop: 8 }}>Customers will contact you here about your products.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {conversations.map((conv: any) => (
            <TouchableOpacity key={conv.id} onPress={() => router.push(`/conversation/${conv.id}`)} activeOpacity={0.75}
              style={{ paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1E293B", flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="chatbubble-outline" size={22} color="#F97316" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: "#F8FAFC", fontWeight: "700", fontSize: 15 }} numberOfLines={1}>{conv.participants || "Customer"}</Text>
                  <Text style={{ color: "#475569", fontSize: 11 }}>{timeAgo(conv.updated_at)}</Text>
                </View>
                <Text style={{ color: "#64748B", fontSize: 13, marginTop: 2 }} numberOfLines={1}>{conv.last_message || "No messages"}</Text>
              </View>
              {conv.unread_count > 0 && (
                <View style={{ backgroundColor: "#F97316", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, marginLeft: 8 }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{conv.unread_count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
