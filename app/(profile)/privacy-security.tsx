import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PrivacySecurityScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <StatusBar style="light" />
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#1E293B", flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={26} color="#F97316" /></TouchableOpacity>
        <Text style={{ color: "#F8FAFC", fontSize: 20, fontWeight: "800" }}>Privacy & Security</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {[
          { title: "Data We Collect", body: "We collect your name, email, phone number, delivery addresses, and order history to provide our services. We do not sell your personal data." },
          { title: "Location Data", body: "Location is only accessed when you use delivery features. We use it to auto-fill your address and show real-time driver tracking." },
          { title: "Push Notifications", body: "We send notifications for order updates, delivery status, and important messages. You can disable these in your device settings." },
          { title: "Payment Security", body: "All payments are processed by Snippe — a certified payment gateway. We never store your card or mobile money details." },
          { title: "Your Rights", body: "You can request deletion of your account and all associated data by contacting admin@onedelivery.co.tz." },
        ].map((section) => (
          <View key={section.title} style={{ backgroundColor: "#1E293B", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#334155" }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "800", fontSize: 15, marginBottom: 8 }}>{section.title}</Text>
            <Text style={{ color: "#94A3B8", fontSize: 13, lineHeight: 20 }}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
