import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LEGAL_URLS, openLegal } from "@/lib/legal";
import { C } from "@/lib/theme";

const LINKS = [
  { icon: "document-text-outline", label: "Privacy policy", url: LEGAL_URLS.privacy, color: C.navy },
  { icon: "reader-outline", label: "Terms of service", url: LEGAL_URLS.terms, color: C.navy },
  { icon: "trash-outline", label: "Delete my account", url: LEGAL_URLS.deleteAccount, color: C.red },
] as const;

const SECTIONS = [
  { title: "Data we collect", body: "Your name, email, phone number, delivery addresses and order history, so we can deliver your orders. We do not sell your personal data." },
  { title: "Location", body: "Used only for delivery features: to fill in your address and to show your driver's live position during a delivery." },
  { title: "Notifications", body: "Order updates, delivery status and messages. You can turn notifications off in your phone's settings." },
  { title: "Payments", body: "Payments are processed by our payment partner Snippe. We never see or store your card or mobile money PIN." },
  { title: "Your rights", body: "You can ask for a copy of your data, correct it, or delete your account at any time — use \"Delete my account\" above." },
];

export default function PrivacySecurityScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 20, backgroundColor: C.card, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><Ionicons name="arrow-back" size={24} color={C.text} /></TouchableOpacity>
        <Text style={{ color: C.text, fontSize: 19, fontWeight: "700" }}>Privacy & Security</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
        <View style={{ backgroundColor: C.card, borderRadius: 16, marginBottom: 16 }}>
          {LINKS.map((l, i) => (
            <TouchableOpacity key={l.label} onPress={() => openLegal(l.url)} activeOpacity={0.7}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: i < LINKS.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
              <Ionicons name={l.icon} size={20} color={l.color} />
              <Text style={{ flex: 1, color: l.color === C.red ? C.red : C.text, fontWeight: "600", fontSize: 15 }}>{l.label}</Text>
              <Ionicons name="open-outline" size={16} color={C.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
        {SECTIONS.map((s) => (
          <View key={s.title} style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: 15, marginBottom: 6 }}>{s.title}</Text>
            <Text style={{ color: C.textSecondary, fontSize: 13, lineHeight: 20 }}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
