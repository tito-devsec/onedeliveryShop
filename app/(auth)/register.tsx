import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet, Dimensions, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";

const { width } = Dimensions.get("window");

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [phone, setPhone]       = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);

  const handleRegister = async () => {
    if (!name.trim()) { Alert.alert("Missing field", "Please enter your full name."); return; }
    if (!email.trim()) { Alert.alert("Missing field", "Please enter your email."); return; }
    if (password.length < 8) { Alert.alert("Weak password", "Password must be at least 8 characters."); return; }
    if (password !== confirmPw) { Alert.alert("Mismatch", "Passwords do not match."); return; }
    setLoading(true);
    try {
      await signUp(name.trim(), email.trim(), password, phone.trim());
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Registration failed", err?.response?.data?.error || err.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <Image source={require("../../assets/images/onedelivery-logo.png")} style={{ width: width * 0.45, height: 60 }} resizeMode="contain" />
        </View>
        <Text style={styles.title}>Sign Up</Text>
        <Text style={styles.subtitle}>Create your OneDelivery account</Text>

        {[
          { label: "Full Name", value: name, onChange: setName, placeholder: "Enter your full name", keyboardType: "default" as const, secure: false },
          { label: "Email", value: email, onChange: setEmail, placeholder: "Enter your email", keyboardType: "email-address" as const, secure: false },
          { label: "Phone (optional)", value: phone, onChange: setPhone, placeholder: "e.g. 0712345678", keyboardType: "phone-pad" as const, secure: false },
        ].map((f) => (
          <View key={f.label} style={styles.inputWrapper}>
            <Text style={styles.floatLabel}>{f.label}</Text>
            <View style={styles.inputRow}>
              <TextInput value={f.value} onChangeText={f.onChange} placeholder={f.placeholder} placeholderTextColor="#C4C4C4" keyboardType={f.keyboardType} autoCapitalize="none" style={styles.textInput} />
            </View>
          </View>
        ))}

        {[
          { label: "Password", value: password, onChange: setPassword, show: showPw, toggle: () => setShowPw((s) => !s) },
          { label: "Confirm Password", value: confirmPw, onChange: setConfirmPw, show: showPw, toggle: () => setShowPw((s) => !s) },
        ].map((f) => (
          <View key={f.label} style={styles.inputWrapper}>
            <Text style={styles.floatLabel}>{f.label}</Text>
            <View style={styles.inputRow}>
              <TextInput value={f.value} onChangeText={f.onChange} placeholder="••••••••" placeholderTextColor="#C4C4C4" secureTextEntry={!f.show} autoCapitalize="none" style={styles.textInput} />
              <TouchableOpacity onPress={f.toggle}><Ionicons name={f.show ? "eye-off-outline" : "eye-outline"} size={20} color="#C4C4C4" /></TouchableOpacity>
            </View>
          </View>
        ))}

        <TouchableOpacity onPress={handleRegister} disabled={loading} style={[styles.orangeBtn, { marginTop: 8 }]} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.orangeBtnText}>Create Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/(auth)/login")} style={{ alignItems: "center", marginTop: 16 }}>
          <Text style={{ color: "#6B7280", fontSize: 14 }}>
            Already have an account? <Text style={{ color: "#F97316", fontWeight: "700" }}>Login</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: "800", color: "#111827", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#6B7280", marginBottom: 24 },
  inputWrapper: { marginBottom: 16 },
  floatLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4, color: "#9CA3AF" },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, borderColor: "#E5E7EB" },
  textInput: { flex: 1, fontSize: 15, color: "#111827", paddingVertical: 14 },
  orangeBtn: { backgroundColor: "#F97316", borderRadius: 14, paddingVertical: 17, alignItems: "center", shadowColor: "#F97316", shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  orangeBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
