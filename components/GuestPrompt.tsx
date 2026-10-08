import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";
import { requireSignIn } from "@/lib/authGate";
import { C } from "@/lib/theme";

// Shown on account-only screens (cart, chat, profile) while browsing as a guest
export default function GuestPrompt({ icon, title, message }: { icon: keyof typeof Ionicons.glyphMap; title: string; message: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: C.card, alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
        <Ionicons name={icon} size={38} color={C.navy} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: "700", color: C.text, textAlign: "center" }}>{title}</Text>
      <Text style={{ fontSize: 14, color: C.textSecondary, textAlign: "center", marginTop: 8, lineHeight: 20 }}>{message}</Text>
      <TouchableOpacity onPress={() => requireSignIn()} activeOpacity={0.85}
        style={{ alignSelf: "stretch", marginTop: 26, backgroundColor: C.navy, borderRadius: 14, paddingVertical: 15, alignItems: "center" }}>
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Sign in</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => requireSignIn(undefined, "register")} activeOpacity={0.85}
        style={{ alignSelf: "stretch", marginTop: 12, borderWidth: 1.5, borderColor: C.navy, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
        <Text style={{ color: C.navy, fontWeight: "700", fontSize: 16 }}>Create account</Text>
      </TouchableOpacity>
    </View>
  );
}
