import { useAddresses } from "@/hooks/useAddressess";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AddressesScreen() {
  const insets = useSafeAreaInsets();
  const { addresses, isLoading, deleteAddress } = useAddresses();

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <StatusBar style="light" />
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#1E293B", flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={26} color="#F97316" /></TouchableOpacity>
        <Text style={{ color: "#F8FAFC", fontSize: 20, fontWeight: "800" }}>Delivery Addresses</Text>
      </View>
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#F97316" size="large" /></View>
      ) : addresses.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Ionicons name="location-outline" size={60} color="#334155" />
          <Text style={{ color: "#F8FAFC", fontSize: 18, fontWeight: "700", marginTop: 16 }}>No addresses saved</Text>
          <Text style={{ color: "#64748B", textAlign: "center", marginTop: 8 }}>Add a delivery address to speed up checkout.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          {addresses.map((addr: any) => (
            <View key={addr.id} style={{ backgroundColor: "#1E293B", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: addr.is_default ? "#F9731650" : "#334155" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Ionicons name="location" size={16} color="#F97316" />
                    <Text style={{ color: "#F8FAFC", fontWeight: "700", fontSize: 15 }}>{addr.label}</Text>
                    {addr.is_default && (
                      <View style={{ backgroundColor: "#F9731620", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ color: "#F97316", fontSize: 11, fontWeight: "700" }}>Default</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: "#94A3B8", fontSize: 13 }}>{addr.street_address}</Text>
                  <Text style={{ color: "#94A3B8", fontSize: 13 }}>{addr.city}{addr.region ? `, ${addr.region}` : ""}</Text>
                  {addr.phone_number && <Text style={{ color: "#64748B", fontSize: 12, marginTop: 4 }}>📞 {addr.phone_number}</Text>}
                </View>
                <TouchableOpacity onPress={() => Alert.alert("Delete", "Remove this address?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => deleteAddress(addr.id) },
                ])}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
