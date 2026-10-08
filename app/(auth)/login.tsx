import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet, Dimensions, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";

const { width } = Dimensions.get("window");

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning!";
  if (h < 17) return "Good Afternoon!";
  return "Good Evening!";
}

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
      router.replace("/(tabs)");
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || "Login failed. Please try again.";
      Alert.alert("Sign in failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28, paddingTop: 36, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <Image source={require("../../assets/images/onedelivery-logo.png")} style={{ width: width * 0.45, height: 60 }} resizeMode="contain" />
        </View>
        <Text style={styles.title}>{getGreeting()}</Text>
        <Text style={styles.subtitle}>Welcome back to OneDelivery</Text>

        <View style={styles.inputWrapper}>
          <Text style={styles.floatLabel}>Email</Text>
          <View style={styles.inputRow}>
            <TextInput value={email} onChangeText={setEmail} placeholder="Enter your email" placeholderTextColor="#C4C4C4" keyboardType="email-address" autoCapitalize="none" style={styles.textInput} />
            <Ionicons name="mail-outline" size={20} color="#C4C4C4" />
          </View>
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.floatLabel}>Password</Text>
          <View style={styles.inputRow}>
            <TextInput value={password} onChangeText={setPassword} placeholder="Enter your password" placeholderTextColor="#C4C4C4" secureTextEntry={!showPw} style={styles.textInput} />
            <TouchableOpacity onPress={() => setShowPw(!showPw)}>
              <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={20} color="#C4C4C4" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity onPress={handleLogin} disabled={loading} style={styles.orangeBtn} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.orangeBtnText}>Login</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/(auth)/register")} style={{ marginTop: 16 }}>
          <Text style={{ color: "#6B7280", fontSize: 14 }}>
            Don't have an account? <Text style={{ color: "#F97316", fontWeight: "700" }}>Register</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: "800", color: "#111827", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#6B7280", marginBottom: 28 },
  inputWrapper: { marginBottom: 16 },
  floatLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4, color: "#9CA3AF" },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" },
  textInput: { flex: 1, fontSize: 15, color: "#111827", paddingVertical: 14 },
  orangeBtn: { backgroundColor: "#F97316", borderRadius: 14, paddingVertical: 17, alignItems: "center", shadowColor: "#F97316", shadowOpacity: 0.25, shadowRadius: 8, elevation: 4, marginTop: 8 },
  orangeBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
