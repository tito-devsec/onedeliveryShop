import GuestPrompt from "@/components/GuestPrompt";
import SafeScreen from "@/components/SafeScreen";
import { useApi } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, FlatList, TextInput, Alert } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { timeAgo } from "@/lib/utils";

function ChatScreen() {
  const api = useApi();
  const qc  = useQueryClient();
  const { user } = useAuth();
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchUser, setSearchUser] = useState("");

  const { data: convsData, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => { const { data } = await api.get("/chat/conversations"); return data; },
    refetchInterval: 8_000,
  });

  const { data: unreadData } = useQuery({
    queryKey: ["chat-unread"],
    queryFn: async () => { const { data } = await api.get("/chat/unread"); return data; },
    refetchInterval: 15_000,
  });

  const startChatMutation = useMutation({
    mutationFn: async (recipientId: string) => {
      const { data } = await api.post("/chat/conversations", { recipientId });
      return data;
    },
    onSuccess: (data) => {
      setShowNewChat(false);
      qc.invalidateQueries({ queryKey: ["conversations"] });
      router.push(`/conversation/${data.conversationId}`);
    },
    onError: (err: any) => {
      Alert.alert("Could not start chat", err?.response?.data?.error || err.message || "Try again.");
    },
  });

  const conversations = convsData?.conversations || [];
  const totalUnread = unreadData?.unread || 0;

  const TYPE_COLORS: Record<string, string> = {
    user_seller:   "#EC7C2C",
    user_admin:    "#7C3AED",
    seller_admin:  "#2563EB",
    user_driver:   "#16A34A",
    seller_driver: "#14B8A6",
  };

  return (
    <SafeScreen>
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: "#1B2036", fontSize: 22, fontWeight: "800" }}>Messages</Text>
            {totalUnread > 0 && (
              <View style={{ backgroundColor: "#EC7C2C", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{totalUnread}</Text>
              </View>
            )}
          </View>
          <Text style={{ color: "#8A90A0", fontSize: 13, marginTop: 2 }}>Chat with sellers, drivers & support</Text>
        </View>
        <TouchableOpacity onPress={() => {
          // Start chat with admin
          startChatMutation.mutate("admin");
        }} style={{ backgroundColor: "#FFFFFF", borderRadius: 13, padding: 11 }}>
          <Ionicons name="headset-outline" size={22} color="#EC7C2C" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#EC7C2C" /></View>
      ) : conversations.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Ionicons name="chatbubbles-outline" size={60} color="#E6E8EE" />
          <Text style={{ color: "#1B2036", fontSize: 18, fontWeight: "700", marginTop: 16 }}>No conversations yet</Text>
          <Text style={{ color: "#8A90A0", textAlign: "center", marginTop: 8 }}>Contact support or start chatting with a seller after placing an order.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {conversations.map((conv: any) => (
            <TouchableOpacity key={conv.id} onPress={() => router.push(`/conversation/${conv.id}`)}
              style={{ paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#FFFFFF", flexDirection: "row", alignItems: "center" }}
              activeOpacity={0.75}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: TYPE_COLORS[conv.type] + "20" || "#E6E8EE", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="chatbubble-outline" size={22} color={TYPE_COLORS[conv.type] || "#6B7280"} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: "#1B2036", fontWeight: "700", fontSize: 15 }} numberOfLines={1}>{conv.participants || "Conversation"}</Text>
                  <Text style={{ color: "#A0A6B4", fontSize: 11 }}>{timeAgo(conv.updated_at)}</Text>
                </View>
                <Text style={{ color: "#8A90A0", fontSize: 13, marginTop: 2 }} numberOfLines={1}>{conv.last_message || "No messages yet"}</Text>
              </View>
              {conv.unread_count > 0 && (
                <View style={{ backgroundColor: "#EC7C2C", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, marginLeft: 8 }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{conv.unread_count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeScreen>
  );
}

// Guests can browse the shop; this tab needs an account
export default function ChatTab() {
  const { user } = useAuth();
  if (!user) return (
    <SafeScreen>
      <GuestPrompt icon="chatbubbles-outline" title="Chat with OneDelivery" message="Sign in to message our support team about orders and deliveries." />
    </SafeScreen>
  );
  return <ChatScreen />;
}
