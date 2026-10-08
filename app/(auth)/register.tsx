import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import AuthField from "@/components/AuthField";
import GoogleButton from "@/components/GoogleButton";
import { cancelSignIn, finishSignIn } from "@/lib/authGate";
import { C } from "@/lib/theme";

const { width } = Dimensions.get("window");

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [phone, setPhone]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);

  const handleRegister = async () => {
    if (!name.trim()) { Alert.alert("Missing field", "Please enter your full name."); return; }
    if (!email.trim()) { Alert.alert("Missing field", "Please enter your email."); return; }
    if (password.length < 8) { Alert.alert("Weak password", "Password must be at least 8 characters."); return; }
    if (password !== confirmPw) { Alert.alert("Mismatch", "Passwords do not match."); return; }
    setLoading(true);
    try {
      await signUp(name.trim(), email.trim(), password, phone.trim());
      finishSignIn();
    } catch (err: any) {
      Alert.alert("Registration failed", err?.response?.data?.error || err.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.card }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={cancelSignIn} hitSlop={10} style={{ alignSelf: "flex-start", marginTop: 8, padding: 4 }}>
          <Ionicons name="close" size={26} color={C.text} />
        </TouchableOpacity>
        <View style={{ alignItems: "center", marginTop: 4, marginBottom: 22 }}>
          <Image source={require("../../assets/images/onedelivery-logo-wide.png")} style={{ width: width * 0.46, height: (width * 0.46) / 1.844 }} contentFit="contain" />
        </View>
        <Text style={{ fontSize: 26, fontWeight: "800", color: C.text }}>Create account</Text>
        <Text style={{ fontSize: 14, color: C.textSecondary, marginTop: 6, marginBottom: 22, lineHeight: 20 }}>
          Shop, send packages and track every delivery in one app.
        </Text>

        <AuthField icon="person-outline" value={name} onChangeText={setName} placeholder="Full name" autoCapitalize="words" autoComplete="name" />
        <AuthField icon="mail-outline" value={email} onChangeText={setEmail} placeholder="Email address" keyboardType="email-address" autoComplete="email" />
        <AuthField icon="call-outline" value={phone} onChangeText={setPhone} placeholder="Phone (optional), e.g. 0712345678" keyboardType="phone-pad" autoComplete="tel" />
        <AuthField icon="lock-closed-outline" value={password} onChangeText={setPassword} placeholder="Password (8+ characters)"
          secure={!showPw} onToggleSecure={() => setShowPw((s) => !s)} autoComplete="new-password" />
        <AuthField icon="lock-closed-outline" value={confirmPw} onChangeText={setConfirmPw} placeholder="Confirm password"
          secure={!showPw} autoComplete="new-password" />

        <TouchableOpacity onPress={handleRegister} disabled={loading} activeOpacity={0.85}
          style={{ backgroundColor: C.navy, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8 }}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Create account</Text>}
        </TouchableOpacity>

        <GoogleButton />

        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 26 }}>
          <Text style={{ color: C.textSecondary, fontSize: 14 }}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
            <Text style={{ color: C.navy, fontWeight: "700", fontSize: 14 }}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
