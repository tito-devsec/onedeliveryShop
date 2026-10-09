import { useState } from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Application from "expo-application";
import * as Updates from "expo-updates";

const fmt = (d: Date) =>
  d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// The installed version and the over-the-air update it is running, so anyone can see
// when the latest changes have arrived — plus a button to fetch them straight away.
export default function AppVersion() {
  const [checking, setChecking] = useState(false);
  const version = Application.nativeApplicationVersion || "—";
  const build = Application.nativeBuildVersion;
  const fromUpdate = Updates.isEnabled && !Updates.isEmbeddedLaunch;
  const updateLine = !Updates.isEnabled
    ? "Development build"
    : fromUpdate && Updates.createdAt
      ? `Updated ${fmt(Updates.createdAt)}${Updates.updateId ? ` · ${Updates.updateId.slice(0, 8)}` : ""}`
      : "Original release";
  const channel = Updates.channel && Updates.channel !== "production" ? ` · ${Updates.channel}` : "";

  const check = async () => {
    if (!Updates.isEnabled) {
      Alert.alert("Updates", "Updates aren't available in this build.");
      return;
    }
    setChecking(true);
    try {
      const res = await Updates.checkForUpdateAsync();
      if (!res.isAvailable) {
        Alert.alert("Up to date", `You have the latest version of OneDelivery (${version}).`);
        return;
      }
      await Updates.fetchUpdateAsync();
      Alert.alert("Update downloaded", "Restart the app to start using it.", [
        { text: "Later", style: "cancel" },
        { text: "Restart now", onPress: () => { Updates.reloadAsync().catch(() => {}); } },
      ]);
    } catch {
      Alert.alert("Couldn't check for updates", "Check your internet connection and try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, marginTop: 20, borderWidth: 1, borderColor: "#E6E8EE" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "#2E3A7415", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="information-circle-outline" size={22} color="#2E3A74" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#1B2036", fontWeight: "700", fontSize: 15 }}>
            OneDelivery {version}{build ? ` (build ${build})` : ""}
          </Text>
          <Text style={{ color: "#8A90A0", fontSize: 12, marginTop: 2 }}>{updateLine}{channel}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={check} disabled={checking} activeOpacity={0.75}
        style={{ marginTop: 12, borderRadius: 12, paddingVertical: 11, alignItems: "center", backgroundColor: "#F4F5F8", flexDirection: "row", justifyContent: "center", gap: 8 }}>
        {checking
          ? <ActivityIndicator size="small" color="#2E3A74" />
          : <Ionicons name="refresh" size={16} color="#2E3A74" />}
        <Text style={{ color: "#2E3A74", fontWeight: "700", fontSize: 14 }}>{checking ? "Checking…" : "Check for updates"}</Text>
      </TouchableOpacity>
    </View>
  );
}
