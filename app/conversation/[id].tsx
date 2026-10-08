import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { timeAgo } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { View, Text, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const api = useApi();
  const qc  = useQueryClient();
  const insets = useSafeAreaInsets();
  const [msgText, setMsgText]  = useState("");
  const flatListRef = useRef<FlatList>(null);

  const { data: msgsData, isLoading } = useQuery({
    queryKey: ["messages", id],
    queryFn: async () => {
      const { data } = await api.get(`/chat/conversations/${id}/messages?limit=100`);
      return data.messages || [];
    },
    enabled: !!id,
    refetchInterval: 6_000,
  });

  const messages = msgsData || [];

  // Socket.io join
  useEffect(() => {
    if (!id) return;
    let socket: any;
    getSocket().then((s) => {
      socket = s;
      s.emit("chat:join", { conversationId: id });
      s.on("new_message", (msg: any) => {
        if (msg.conversation_id === id) qc.invalidateQueries({ queryKey: ["messages", id] });
      });
    });
    return () => { if (socket) { socket.emit("chat:leave", { conversationId: id }); socket.off("new_message"); } };
  }, [id]);

  useEffect(() => {
    if (messages.length > 0) setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/chat/conversations/${id}/messages`, { body: msgText });
      return data;
    },
    onSuccess: () => {
      setMsgText("");
      qc.invalidateQueries({ queryKey: ["messages", id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const sendMsg = () => {
    if (!msgText.trim() || sendMutation.isPending) return;
    sendMutation.mutate();
  };

  const renderMessage = ({ item: m }: { item: any }) => {
    const isMe = m.sender_id === user?.id;
    return (
      <View style={{ flexDirection: isMe ? "row-reverse" : "row", marginBottom: 12, paddingHorizontal: 16, alignItems: "flex-end", gap: 8 }}>
        {!isMe && (
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#334155", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>{m.sender_name?.[0]?.toUpperCase() || "?"}</Text>
          </View>
        )}
        <View style={{ maxWidth: "75%" }}>
          {!isMe && <Text style={{ color: "#64748B", fontSize: 11, marginBottom: 2 }}>{m.sender_name}</Text>}
          {m.image_url ? (
            <Image source={m.image_url} style={{ width: 200, height: 150, borderRadius: 16 }} contentFit="cover" />
          ) : (
            <View style={{ backgroundColor: isMe ? "#F97316" : "#1E293B", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderBottomRightRadius: isMe ? 4 : 18, borderBottomLeftRadius: isMe ? 18 : 4 }}>
              <Text style={{ color: isMe ? "#fff" : "#F1F5F9", fontSize: 14, lineHeight: 20 }}>{m.body}</Text>
            </View>
          )}
          <Text style={{ color: "#475569", fontSize: 10, marginTop: 2, textAlign: isMe ? "right" : "left" }}>{timeAgo(m.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <StatusBar style="light" />
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: "#0F172A", borderBottomWidth: 1, borderBottomColor: "#1E293B", flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#F97316" />
        </TouchableOpacity>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#334155", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chatbubble" size={18} color="#94A3B8" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "700", fontSize: 16 }}>Chat</Text>
          <Text style={{ color: "#64748B", fontSize: 12 }}>Tap to view details</Text>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top + 60}>
        {isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#F97316" /></View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 60 }}>
                <Ionicons name="chatbubbles-outline" size={48} color="#334155" />
                <Text style={{ color: "#64748B", marginTop: 12 }}>No messages yet. Say hello!</Text>
              </View>
            }
          />
        )}

        {/* Input */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, paddingBottom: insets.bottom + 10, backgroundColor: "#0F172A", borderTopWidth: 1, borderTopColor: "#1E293B", gap: 10 }}>
          <TextInput
            value={msgText}
            onChangeText={setMsgText}
            placeholder="Type a message..."
            placeholderTextColor="#475569"
            multiline
            style={{ flex: 1, backgroundColor: "#1E293B", borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, color: "#F1F5F9", fontSize: 14, maxHeight: 100 }}
            onSubmitEditing={sendMsg}
          />
          <TouchableOpacity onPress={sendMsg} disabled={!msgText.trim() || sendMutation.isPending}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: msgText.trim() ? "#F97316" : "#334155", alignItems: "center", justifyContent: "center" }}>
            {sendMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
