import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { timeAgo } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
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
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#E6E8EE", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>{m.sender_name?.[0]?.toUpperCase() || "?"}</Text>
          </View>
        )}
        <View style={{ maxWidth: "75%" }}>
          {!isMe && <Text style={{ color: "#8A90A0", fontSize: 11, marginBottom: 2 }}>{m.sender_name}</Text>}
          {m.image_url ? (
            <Image source={m.image_url} style={{ width: 200, height: 150, borderRadius: 16 }} contentFit="cover" />
          ) : (
            <View style={{ backgroundColor: isMe ? "#EC7C2C" : "#FFFFFF", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderBottomRightRadius: isMe ? 4 : 18, borderBottomLeftRadius: isMe ? 18 : 4 }}>
              <Text style={{ color: isMe ? "#fff" : "#1B2036", fontSize: 14, lineHeight: 20 }}>{m.body}</Text>
            </View>
          )}
          <Text style={{ color: "#A0A6B4", fontSize: 10, marginTop: 2, textAlign: isMe ? "right" : "left" }}>{timeAgo(m.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F8" }}>
      <StatusBar style="dark" />
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: "#F4F5F8", borderBottomWidth: 1, borderBottomColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#1B2036" />
        </TouchableOpacity>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#E6E8EE", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chatbubble" size={18} color="#6B7280" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#1B2036", fontWeight: "700", fontSize: 16 }}>Chat</Text>
          <Text style={{ color: "#8A90A0", fontSize: 12 }}>Tap to view details</Text>
        </View>
      </View>

      {/* Messages */}
      {/* Keeps the message box on top of the keyboard (its own bottom inset hides under it) */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={-insets.bottom}>
        {isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#EC7C2C" /></View>
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
                <Ionicons name="chatbubbles-outline" size={48} color="#E6E8EE" />
                <Text style={{ color: "#8A90A0", marginTop: 12 }}>No messages yet. Say hello!</Text>
              </View>
            }
          />
        )}

        {/* Input */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, paddingBottom: insets.bottom + 10, backgroundColor: "#F4F5F8", borderTopWidth: 1, borderTopColor: "#FFFFFF", gap: 10 }}>
          <TextInput
            value={msgText}
            onChangeText={setMsgText}
            placeholder="Type a message..."
            placeholderTextColor="#A0A6B4"
            multiline
            style={{ flex: 1, backgroundColor: "#FFFFFF", borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, color: "#1B2036", fontSize: 14, maxHeight: 100 }}
            onSubmitEditing={sendMsg}
          />
          <TouchableOpacity onPress={sendMsg} disabled={!msgText.trim() || sendMutation.isPending}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: msgText.trim() ? "#EC7C2C" : "#E6E8EE", alignItems: "center", justifyContent: "center" }}>
            {sendMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
