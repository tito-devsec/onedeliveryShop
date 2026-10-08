import { useState } from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { useAuth } from "@/context/AuthContext";
import { finishSignIn } from "@/lib/authGate";
import { GOOGLE_WEB_CLIENT_ID, getGoogleIdToken } from "@/lib/googleAuth";
import { C } from "@/lib/theme";

// "Continue with Google" — signs in, or creates the account on first use.
// Hidden until the Firebase Google client ID is part of the build.
export default function GoogleButton() {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!GOOGLE_WEB_CLIENT_ID) return null;

  const onPress = async () => {
    setBusy(true);
    try {
      const idToken = await getGoogleIdToken();
      if (!idToken) return; // picker closed
      await signInWithGoogle(idToken);
      finishSignIn();
    } catch (err: any) {
      Alert.alert("Google sign-in failed", err?.response?.data?.error || err?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 20 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
        <Text style={{ color: C.textMuted, fontSize: 13 }}>or</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
      </View>
      <TouchableOpacity onPress={onPress} disabled={busy} activeOpacity={0.85}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 14, backgroundColor: C.card }}>
        {busy ? <ActivityIndicator color={C.navy} /> : (
          <>
            <Image source={require("../assets/images/google-g.png")} style={{ width: 20, height: 20 }} contentFit="contain" />
            <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>
    </>
  );
}
