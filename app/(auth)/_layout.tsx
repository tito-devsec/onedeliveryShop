import { Redirect, Stack } from "expo-router";
import { useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { View, ActivityIndicator } from "react-native";
import { C } from "@/lib/theme";

export default function AuthRoutesLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  // Only bounce users who open these screens while already signed in; a fresh
  // sign-in navigates back by itself (see finishSignIn in lib/authGate).
  const signedInOnOpen = useRef(isLoaded && isSignedIn).current;

  if (!isLoaded) return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.card }}>
      <ActivityIndicator size="large" color={C.navy} />
    </View>
  );
  if (signedInOnOpen) return <Redirect href="/(tabs)" />;
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
