import { StatusBar } from "expo-status-bar";
import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SafeScreen = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaView style={{ flex: 1, backgroundColor: "#0F172A" }} edges={["top","left","right"]}>
    <StatusBar style="light" />
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>{children}</View>
  </SafeAreaView>
);

export default SafeScreen;
