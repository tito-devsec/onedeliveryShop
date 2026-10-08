import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, ActivityIndicator } from "react-native";
import { C } from "@/lib/theme";

// Open to guests: browsing needs no account; account-only tabs show a sign-in prompt
const TabsLayout = () => {
  const { isLoaded } = useAuth();
  const insets = useSafeAreaInsets();

  if (!isLoaded) return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg }}>
      <ActivityIndicator size="large" color={C.navy} />
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.navy,
        tabBarInactiveTintColor: "#A0A6B4",
        tabBarStyle: {
          backgroundColor: C.card,
          borderTopWidth: 1,
          borderTopColor: C.border,
          elevation: 0,
          height: 58 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Shop", tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "storefront" : "storefront-outline"} size={size} color={color} /> }} />
      <Tabs.Screen name="cart" options={{ title: "Cart", tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "cart" : "cart-outline"} size={size} color={color} /> }} />
      <Tabs.Screen name="chat" options={{ title: "Chat", tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "person" : "person-outline"} size={size} color={color} /> }} />
    </Tabs>
  );
};

export default TabsLayout;
