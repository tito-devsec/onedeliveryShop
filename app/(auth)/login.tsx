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

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) { Alert.alert("Missing fields", "Please enter your email and password."); return; }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      finishSignIn();
    } catch (err: any) {
      Alert.alert("Sign in failed", err?.response?.data?.error || err.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.card }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={cancelSignIn} hitSlop={10} style={{ alignSelf: "flex-start", marginTop: 8, padding: 4 }}>
          <Ionicons name="close" size={26} color={C.text} />
        </TouchableOpacity>
        <View style={{ alignItems: "center", marginTop: 4, marginBottom: 28 }}>
          <Image source={require("../../assets/images/onedelivery-logo-wide.png")} style={{ width: width * 0.56, height: (width * 0.56) / 1.844 }} contentFit="contain" />
        </View>
        <Text style={{ fontSize: 26, fontWeight: "800", color: C.text }}>Welcome back</Text>
        <Text style={{ fontSize: 14, color: C.textSecondary, marginTop: 6, marginBottom: 24, lineHeight: 20 }}>
          Sign in to order, track your deliveries and chat with support.
        </Text>

        <AuthField icon="mail-outline" value={email} onChangeText={setEmail} placeholder="Email address" keyboardType="email-address" autoComplete="email" />
        <AuthField icon="lock-closed-outline" value={password} onChangeText={setPassword} placeholder="Password"
          secure={!showPw} onToggleSecure={() => setShowPw((s) => !s)} autoComplete="password" />

        <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.85}
          style={{ backgroundColor: C.navy, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8 }}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Sign in</Text>}
        </TouchableOpacity>

        <GoogleButton />

        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 26 }}>
          <Text style={{ color: C.textSecondary, fontSize: 14 }}>New to OneDelivery? </Text>
          <TouchableOpacity onPress={() => router.replace("/(auth)/register")}>
            <Text style={{ color: C.navy, fontWeight: "700", fontSize: 14 }}>Create account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
