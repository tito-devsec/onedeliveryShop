import { useApi } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Image, ActivityIndicator } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";

const BUSINESS_TYPES = [
  "General Retail",
  "Electronics",
  "Fashion & Clothing",
  "Food & Beverages",
  "Health & Beauty",
  "Sports & Fitness",
  "Books & Stationery",
  "Home & Furniture",
  "Toys & Games",
  "Agriculture",
  "Services",
  "Other",
];

export default function BecomeSellerScreen() {
  const api    = useApi();
  const insets = useSafeAreaInsets();

  const [businessName, setBusinessName] = useState("");
  const [ownerName,    setOwnerName]    = useState("");
  const [description,  setDescription]  = useState("");
  const [phone,        setPhone]        = useState("");
  const [address,      setAddress]      = useState("");
  const [tinNumber,    setTinNumber]    = useState("");
  const [businessType, setBusinessType] = useState("");
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [idDocUri,     setIdDocUri]     = useState<string | null>(null);
  const [shopLat,      setShopLat]      = useState<number | null>(null);
  const [shopLng,      setShopLng]      = useState<number | null>(null);
  const [showMap,      setShowMap]      = useState(false);
  const [locLoading,   setLocLoading]   = useState(false);

  const applyMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("business_name",        businessName.trim());
      fd.append("business_description", description.trim());
      fd.append("business_phone",       phone.trim());
      fd.append("business_address",     address.trim());
      fd.append("business_type",        businessType);
      fd.append("owner_name",           ownerName.trim());
      if (shopLat != null && shopLng != null) {
        fd.append("shop_lat", String(shopLat));
        fd.append("shop_lng", String(shopLng));
      }
      if (tinNumber.trim()) fd.append("tin_number", tinNumber.trim());
      if (idDocUri) {
        fd.append("id_document", { uri: idDocUri, name: "id_document.jpg", type: "image/jpeg" } as any);
      }
      const { data } = await api.post("/seller/apply", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => {
      Alert.alert("Application Submitted! 🎉", "Our team will review your application within 24–48 hours. You'll receive a notification when approved.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (err: any) => {
      Alert.alert("Application Failed", err?.response?.data?.error || err.message || "Please try again.");
    },
  });

  const pickDocument = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission required", "Grant photo library access to upload your ID."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]) setIdDocUri(result.assets[0].uri);
  };

  const getMyLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission denied", "Allow location access to set your shop location."); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setShopLat(loc.coords.latitude);
      setShopLng(loc.coords.longitude);
      const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (geo[0]) setAddress(`${geo[0].street || ""} ${geo[0].city || ""}`.trim());
    } catch {}
    setLocLoading(false);
  };

  const handleMapPress = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setShopLat(latitude);
    setShopLng(longitude);
    Location.reverseGeocodeAsync({ latitude, longitude })
      .then((g) => { if (g[0]) setAddress(`${g[0].street || ""} ${g[0].city || ""}`.trim()); });
  };

  const handleApply = () => {
    if (!businessName.trim()) { Alert.alert("Required", "Enter your shop/business name."); return; }
    if (!ownerName.trim())    { Alert.alert("Required", "Enter the shop owner name."); return; }
    if (!businessType)        { Alert.alert("Required", "Select your business type."); return; }
    applyMutation.mutate();
  };

  if (showMap) {
    return (
      <View style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <MapView
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={{ latitude: shopLat || -6.7924, longitude: shopLng || 39.2083, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
          onPress={handleMapPress}
        >
          {shopLat && shopLng && <Marker coordinate={{ latitude: shopLat, longitude: shopLng }} title="Shop Location" pinColor="#EC7C2C" />}
        </MapView>
        {/* Map overlay */}
        <View style={{ position: "absolute", top: insets.top + 12, left: 16, right: 16, flexDirection: "row", gap: 10 }}>
          <TouchableOpacity onPress={() => setShowMap(false)} style={{ backgroundColor: "#FFFFFFEB", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#E6E8EE" }}>
            <Ionicons name="arrow-back" size={22} color="#1B2036" />
          </TouchableOpacity>
          <View style={{ flex: 1, backgroundColor: "#FFFFFFEB", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#E6E8EE" }}>
            <Text style={{ color: "#6B7280", fontSize: 11 }}>SHOP LOCATION</Text>
            <Text style={{ color: "#1B2036", fontSize: 13 }} numberOfLines={1}>{address || "Tap map to pin location"}</Text>
          </View>
        </View>
        <View style={{ position: "absolute", bottom: insets.bottom + 20, left: 20, right: 20 }}>
          <TouchableOpacity onPress={() => setShowMap(false)}
            style={{ backgroundColor: "#2E3A74", borderRadius: 14, paddingVertical: 16, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F8" }}>
      <StatusBar style="dark" />
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={26} color="#1B2036" /></TouchableOpacity>
        <View>
          <Text style={{ color: "#1B2036", fontSize: 20, fontWeight: "800" }}>Become a Seller</Text>
          <Text style={{ color: "#8A90A0", fontSize: 12, marginTop: 1 }}>Apply to sell on OneDelivery</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

          {/* Basic info */}
          <View style={s.card}>
            <Text style={s.sectionLabel}>Shop Information</Text>

            <Text style={s.label}>Shop / Business Name *</Text>
            <TextInput value={businessName} onChangeText={setBusinessName} placeholder="e.g. Juma Electronics" placeholderTextColor="#A0A6B4" style={s.input} />

            <Text style={s.label}>Shop Owner Name *</Text>
            <TextInput value={ownerName} onChangeText={setOwnerName} placeholder="Full legal name" placeholderTextColor="#A0A6B4" style={s.input} />

            <Text style={s.label}>Business Type *</Text>
            <TouchableOpacity onPress={() => setShowTypePicker(true)} style={[s.input, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
              <Text style={{ color: businessType ? "#1B2036" : "#A0A6B4", fontSize: 14 }}>{businessType || "Select business type"}</Text>
              <Ionicons name="chevron-down" size={18} color="#8A90A0" />
            </TouchableOpacity>

            <Text style={s.label}>Business Phone</Text>
            <TextInput value={phone} onChangeText={setPhone} placeholder="e.g. 0712 345 678" placeholderTextColor="#A0A6B4" keyboardType="phone-pad" style={s.input} />

            <Text style={s.label}>Description</Text>
            <TextInput value={description} onChangeText={setDescription} placeholder="Tell customers about your shop…" placeholderTextColor="#A0A6B4" multiline
              style={[s.input, { height: 80, textAlignVertical: "top" }]} />
          </View>

          {/* Shop Location */}
          <View style={s.card}>
            <Text style={s.sectionLabel}>Shop Location</Text>
            <Text style={{ color: "#8A90A0", fontSize: 13, marginBottom: 14 }}>
              Your shop location is used as the pickup point for deliveries. Buyers will see this on the map.
            </Text>

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
              <TouchableOpacity onPress={getMyLocation} disabled={locLoading}
                style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 12, paddingVertical: 13, borderWidth: 1, borderColor: "#E6E8EE" }}>
                {locLoading ? <ActivityIndicator size="small" color="#EC7C2C" /> : <Ionicons name="locate" size={18} color="#EC7C2C" />}
                <Text style={{ color: "#EC7C2C", fontWeight: "700", fontSize: 13 }}>Use My Location</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowMap(true)}
                style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 12, paddingVertical: 13, borderWidth: 1, borderColor: "#E6E8EE" }}>
                <Ionicons name="map-outline" size={18} color="#2563EB" />
                <Text style={{ color: "#2563EB", fontWeight: "700", fontSize: 13 }}>Pin on Map</Text>
              </TouchableOpacity>
            </View>

            {/* Mini map preview */}
            {shopLat && shopLng ? (
              <TouchableOpacity onPress={() => setShowMap(true)} activeOpacity={0.9}>
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={{ height: 160, borderRadius: 14, overflow: "hidden" }}
                  region={{ latitude: shopLat, longitude: shopLng, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  <Marker coordinate={{ latitude: shopLat, longitude: shopLng }} pinColor="#EC7C2C" />
                </MapView>
                <View style={{ backgroundColor: "#16A34A20", borderRadius: 10, padding: 10, marginTop: 10, borderWidth: 1, borderColor: "#16A34A40", flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                  <Text style={{ color: "#16A34A", fontSize: 13, flex: 1 }} numberOfLines={1}>{address || `${shopLat.toFixed(4)}, ${shopLng.toFixed(4)}`}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={{ backgroundColor: "#E6E8EE", borderRadius: 14, height: 120, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#A0A6B4", borderStyle: "dashed" }}>
                <Ionicons name="location-outline" size={32} color="#8A90A0" />
                <Text style={{ color: "#8A90A0", marginTop: 8, fontSize: 13 }}>No location set yet</Text>
              </View>
            )}

            <Text style={s.label}>Address Description</Text>
            <TextInput value={address} onChangeText={setAddress} placeholder="Street, area, city…" placeholderTextColor="#A0A6B4" style={s.input} />
          </View>

          {/* Legal */}
          <View style={s.card}>
            <Text style={s.sectionLabel}>Legal Information</Text>
            <Text style={s.label}>TIN / Business License Number (optional)</Text>
            <TextInput value={tinNumber} onChangeText={setTinNumber} placeholder="e.g. 100-123-456" placeholderTextColor="#A0A6B4" style={s.input} />

            <Text style={s.label}>Leseni ya Biashara / ID Document (optional)</Text>
            <TouchableOpacity onPress={pickDocument}
              style={{ borderWidth: 2, borderColor: "#E6E8EE", borderStyle: "dashed", borderRadius: 14, padding: 18, alignItems: "center", gap: 8 }}>
              {idDocUri ? (
                <View style={{ alignItems: "center" }}>
                  <Image source={{ uri: idDocUri }} style={{ width: 100, height: 100, borderRadius: 10 }} />
                  <Text style={{ color: "#16A34A", fontSize: 12, marginTop: 8 }}>✓ Document selected</Text>
                </View>
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={28} color="#8A90A0" />
                  <Text style={{ color: "#8A90A0", fontSize: 14 }}>Upload business license or national ID</Text>
                  <Text style={{ color: "#A0A6B4", fontSize: 12 }}>JPG, PNG or PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Submit button */}
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: insets.bottom + 16, backgroundColor: "#F4F5F8", borderTopWidth: 1, borderTopColor: "#FFFFFF" }}>
          <TouchableOpacity onPress={handleApply} disabled={applyMutation.isPending}
            style={{ backgroundColor: "#2E3A74", borderRadius: 16, paddingVertical: 17, alignItems: "center", opacity: applyMutation.isPending ? 0.7 : 1, flexDirection: "row", justifyContent: "center", gap: 10 }}>
            {applyMutation.isPending ? <ActivityIndicator color="#fff" /> : <Ionicons name="storefront" size={20} color="#fff" />}
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{applyMutation.isPending ? "Submitting…" : "Submit Application"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Business type picker modal */}
      {showTypePicker && (
        <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: insets.bottom + 20 }}>
            <Text style={{ color: "#1B2036", fontSize: 17, fontWeight: "800", marginBottom: 16 }}>Business Type</Text>
            <ScrollView style={{ maxHeight: 340 }}>
              {BUSINESS_TYPES.map((type) => (
                <TouchableOpacity key={type} onPress={() => { setBusinessType(type); setShowTypePicker(false); }}
                  style={{ paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: "#E6E8EE", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: businessType === type ? "#EC7C2C" : "#1B2036", fontSize: 15, fontWeight: businessType === type ? "700" : "400" }}>{type}</Text>
                  {businessType === type && <Ionicons name="checkmark-circle" size={20} color="#EC7C2C" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowTypePicker(false)} style={{ marginTop: 16, paddingVertical: 14, alignItems: "center", backgroundColor: "#E6E8EE", borderRadius: 14 }}>
              <Text style={{ color: "#6B7280", fontWeight: "700" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "#E6E8EE" },
  sectionLabel: { color: "#1B2036", fontSize: 16, fontWeight: "800", marginBottom: 16 },
  label: { color: "#6B7280", fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: "#F4F5F8", borderWidth: 1, borderColor: "#E6E8EE", borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, color: "#1B2036", fontSize: 14 },
});
