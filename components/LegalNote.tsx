import { Text } from "react-native";
import { LEGAL_URLS, openLegal } from "@/lib/legal";
import { C } from "@/lib/theme";

// "By continuing you agree…" line under the sign-in / sign-up buttons
export default function LegalNote() {
  const link = { color: C.navy, fontWeight: "600" as const };
  return (
    <Text style={{ color: C.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 18 }}>
      By continuing, you agree to our{" "}
      <Text style={link} onPress={() => openLegal(LEGAL_URLS.terms)}>Terms of Service</Text> and{" "}
      <Text style={link} onPress={() => openLegal(LEGAL_URLS.privacy)}>Privacy Policy</Text>.
    </Text>
  );
}
