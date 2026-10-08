import { useApi } from "@/lib/api";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

/**
 * Transient screen: creates (or reuses) a conversation with the given
 * recipient, then replaces itself with the real conversation screen.
 * recipientId may be the literal "admin" — the backend resolves it to the
 * support (admin) account. Used by the product page's "chat" buttons.
 */
export default function NewConversationScreen() {
  const api = useApi();
  const { recipientId, productId, orderId, rideId } = useLocalSearchParams<{
    recipientId?: string; productId?: string; orderId?: string; rideId?: string;
  }>();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const { data } = await api.post("/chat/conversations", {
          recipientId: recipientId || "admin",
          orderId: orderId || undefined,
          rideId: rideId || undefined,
        });
        router.replace({
          pathname: "/conversation/[id]",
          params: { id: data.conversationId, productId: productId || "" },
        } as any);
      } catch (e: any) {
        router.back();
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center", gap: 14 }}>
      <StatusBar style="light" />
      <ActivityIndicator color="#F97316" size="large" />
      <Text style={{ color: "#94A3B8" }}>Connecting you to support…</Text>
    </View>
  );
}
