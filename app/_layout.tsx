import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "@/context/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function NotificationSetup() {
  useNotifications();
  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({});

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NotificationSetup />
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(profile)" />
            <Stack.Screen name="product/[id]" />
            <Stack.Screen name="category/[slug]" />
            <Stack.Screen name="conversation/[id]" />
            <Stack.Screen name="become-seller" />
            <Stack.Screen name="business/index" />
            <Stack.Screen name="seller-orders" />
            <Stack.Screen name="seller-analytics" />
            <Stack.Screen name="seller-chat" />
            <Stack.Screen name="checkout" />
            <Stack.Screen name="order-confirmed" />
            <Stack.Screen name="ride/request" />
            <Stack.Screen name="ride/tracking" />
            <Stack.Screen name="packages" />
            <Stack.Screen name="notifications" />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
