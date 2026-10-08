import { Ionicons } from "@expo/vector-icons";
import { TextInput, TextInputProps, TouchableOpacity, View } from "react-native";
import { C } from "@/lib/theme";

// Flat input used on the sign-in and sign-up screens
export default function AuthField({ icon, secure, onToggleSecure, ...props }: TextInputProps & {
  icon: keyof typeof Ionicons.glyphMap; secure?: boolean; onToggleSecure?: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.well, borderRadius: 14, paddingHorizontal: 14, marginBottom: 12 }}>
      <Ionicons name={icon} size={19} color={C.textMuted} />
      <TextInput placeholderTextColor={C.textMuted} secureTextEntry={secure} autoCapitalize="none"
        style={{ flex: 1, fontSize: 15, color: C.text, paddingVertical: 15 }} {...props} />
      {onToggleSecure && (
        <TouchableOpacity onPress={onToggleSecure} hitSlop={8}>
          <Ionicons name={secure ? "eye-outline" : "eye-off-outline"} size={19} color={C.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}
