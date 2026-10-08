import SafeScreen from "@/components/SafeScreen";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollView, Text, TouchableOpacity, View, Alert, ActivityIndicator } from "react-native";

export default function ProfileScreen() {
  const { user, signOut, refreshUser } = useAuth();
  const api = useApi();
  const qc = useQueryClient();
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Refresh the user every time this tab gains focus so a freshly approved
  // seller immediately sees the Seller Dashboard (role flips customer → seller
  // on the backend when admin approves the application).
  useFocusEffect(
    useCallback(() => {
      refreshUser();
    }, [refreshUser])
  );

  const isSeller = user?.role === "seller";
  const isCustomer = user?.role === "customer";

  // Seller application status (only relevant while still a customer)
  const { data: appData } = useQuery({
    queryKey: ["seller-application"],
    queryFn: async () => { const { data } = await api.get("/seller/application"); return data; },
    enabled: isCustomer,
    refetchInterval: isCustomer ? 30_000 : false,
  });
  const application = appData?.application;
  const appPending  = application?.status === "pending";
  const appRejected = application?.status === "rejected";

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  };

  const changeAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission needed", "Allow photo access to set a profile picture."); return; }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      setAvatarUploading(true);
      const fd = new FormData();
      fd.append("avatar", { uri: a.uri, name: a.fileName || `avatar_${Date.now()}.jpg`, type: a.mimeType || "image/jpeg" } as any);
      await api.put("/auth/me", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 30000 });
      await refreshUser();
      qc.invalidateQueries();
    } catch (e: any) {
      Alert.alert("Upload failed", e?.response?.data?.error || e.message || "Try again.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const menuItems = [
    { icon: "receipt-outline",      label: "My Orders",         route: "/(profile)/orders" },
    { icon: "heart-outline",        label: "Wishlist",          route: "/(profile)/wishlist" },
    { icon: "location-outline",     label: "Delivery Addresses",route: "/(profile)/addresses" },
    { icon: "notifications-outline",label: "Notifications",     route: "/notifications" },
    { icon: "shield-outline",       label: "Privacy & Security",route: "/(profile)/privacy-security" },
  ];

  const sellerItems = isSeller ? [
    { icon: "storefront-outline",   label: "Seller Dashboard",  route: "/business" },
    { icon: "cloud-upload-outline", label: "Upload Product",    route: "/business?tab=upload" },
    { icon: "wallet-outline",       label: "Wallet & Payouts",  route: "/business?tab=wallet" },
    { icon: "award-outline",        label: "Packages & Plans",  route: "/packages" },
  ] : [];

  return (
    <SafeScreen>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, backgroundColor: "#0F172A" }}>
        <Text style={{ color: "#F8FAFC", fontSize: 22, fontWeight: "800", marginBottom: 16 }}>Profile</Text>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#1E293B", borderRadius: 16, padding: 16 }}>
          <TouchableOpacity onPress={changeAvatar} activeOpacity={0.8}
            style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "#F97316", alignItems: "center", justifyContent: "center", marginRight: 14 }}>
            {avatarUploading ? (
              <ActivityIndicator color="#fff" />
            ) : user?.profile_image ? (
              <Image source={user.profile_image} style={{ width: 56, height: 56, borderRadius: 28 }} contentFit="cover" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800" }}>{user?.name?.[0]?.toUpperCase() || "U"}</Text>
            )}
            <View style={{ position: "absolute", right: -2, bottom: -2, backgroundColor: "#0F172A", borderRadius: 10, padding: 3 }}>
              <Ionicons name="camera" size={12} color="#F97316" />
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "800", fontSize: 17 }}>{user?.name || "User"}</Text>
            <Text style={{ color: "#94A3B8", fontSize: 13, marginTop: 2 }}>{user?.email}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
              <View style={{ backgroundColor: "#F97316" + "20", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ color: "#F97316", fontSize: 11, fontWeight: "700", textTransform: "capitalize" }}>{user?.role || "customer"}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {/* Seller/Business section */}
        {(sellerItems.length > 0 || isCustomer) && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: "#64748B", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Business</Text>
            {sellerItems.map((item) => (
              <TouchableOpacity key={item.label} onPress={() => router.push(item.route as any)}
                style={{ backgroundColor: "#1E293B", borderRadius: 14, padding: 16, marginBottom: 8, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#F9731630" }}
                activeOpacity={0.75}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "#F97316" + "20", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <Ionicons name={item.icon as any} size={20} color="#F97316" />
                </View>
                <Text style={{ color: "#F8FAFC", fontWeight: "600", fontSize: 15, flex: 1 }}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color="#475569" />
              </TouchableOpacity>
            ))}

            {isCustomer && appPending && (
              <View style={{ backgroundColor: "#F59E0B10", borderRadius: 14, padding: 16, marginBottom: 8, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#F59E0B40" }}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "#F59E0B20", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <Ionicons name="hourglass-outline" size={20} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#F59E0B", fontWeight: "700", fontSize: 15 }}>Seller application in review</Text>
                  <Text style={{ color: "#94A3B8", fontSize: 12 }}>We'll notify you once it's approved (24–48h)</Text>
                </View>
              </View>
            )}

            {isCustomer && !appPending && (
              <TouchableOpacity onPress={() => router.push("/become-seller")}
                style={{ backgroundColor: "#F97316" + "10", borderRadius: 14, padding: 16, marginBottom: 8, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#F97316" + "40" }}
                activeOpacity={0.75}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "#F97316" + "20", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <Ionicons name="add-circle-outline" size={20} color="#F97316" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#F97316", fontWeight: "700", fontSize: 15 }}>
                    {appRejected ? "Re-apply as a Seller" : "Become a Seller"}
                  </Text>
                  <Text style={{ color: "#94A3B8", fontSize: 12 }}>
                    {appRejected ? `Rejected: ${application?.rejection_reason || "update your details and try again"}` : "Apply to sell on OneDelivery"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#F97316" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Main menu */}
        <View>
          <Text style={{ color: "#64748B", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Account</Text>
          {menuItems.map((item) => (
            <TouchableOpacity key={item.route} onPress={() => router.push(item.route as any)}
              style={{ backgroundColor: "#1E293B", borderRadius: 14, padding: 16, marginBottom: 8, flexDirection: "row", alignItems: "center" }}
              activeOpacity={0.75}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "#334155", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name={item.icon as any} size={20} color="#94A3B8" />
              </View>
              <Text style={{ color: "#F8FAFC", fontWeight: "600", fontSize: 15, flex: 1 }}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color="#475569" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity onPress={handleLogout}
          style={{ backgroundColor: "#EF4444" + "15", borderRadius: 14, padding: 16, marginTop: 20, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#EF444430" }}
          activeOpacity={0.75}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "#EF444420", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          </View>
          <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 15 }}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeScreen>
  );
}
