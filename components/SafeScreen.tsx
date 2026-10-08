import { StatusBar } from "expo-status-bar";
import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "@/lib/theme";

// `headerColor` paints the status-bar strip to match a screen's header
const SafeScreen = ({ children, headerColor = C.bg }: { children: React.ReactNode; headerColor?: string }) => (
  <SafeAreaView style={{ flex: 1, backgroundColor: headerColor }} edges={["top","left","right"]}>
    <StatusBar style="dark" />
    <View style={{ flex: 1, backgroundColor: C.bg }}>{children}</View>
  </SafeAreaView>
);

export default SafeScreen;
