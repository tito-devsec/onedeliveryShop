import { useApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Alert, StyleSheet, Dimensions
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatMoney, detectProvider } from "@/lib/utils";

const { height } = Dimensions.get("window");

const VEHICLE_ICONS: Record<string, string> = {
  bodaboda: "🏍️", bajaj: "🛺", pickup: "🚛", toyo: "🚙",
};

export default function RideRequestScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const api = useApi();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [pickupLat,  setPickupLat]  = useState<number | null>(null);
  const [pickupLng,  setPickupLng]  = useState<number | null>(null);
  const [dropLat,    setDropLat]    = useState<number | null>(null);
  const [dropLng,    setDropLng]    = useState<number | null>(null);
  const [pickupAddr, setPickupAddr] = useState("");
  const [dropAddr,   setDropAddr]   = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [payerPhone, setPayerPhone] = useState(user?.phone || "");
  const [locLoading, setLocLoading] = useState(false);
  const [step, setStep]   = useState<"map" | "vehicle" | "pay">("map");

  // Get user current location
  useEffect(() => {
    (async () => {
      setLocLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setDropLat(loc.coords.latitude);
        setDropLng(loc.coords.longitude);
        const geocode = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        if (geocode[0]) setDropAddr(`${geocode[0].street || ""} ${geocode[0].city || ""}`.trim());
      } catch {}
      setLocLoading(false);
    })();
  }, []);

  // When this delivery is for an order, the PICKUP POINT is the seller's shop
  // and the destination is the customer's location.
  const { data: orderData } = useQuery({
    queryKey: ["order-for-ride", orderId],
    queryFn: async () => { const { data } = await api.get(`/orders/${orderId}`); return data; },
    enabled: !!orderId,
  });
  useEffect(() => {
    const o = orderData?.order;
    if (o?.shop_lat && o?.shop_lng && pickupLat == null) {
      setPickupLat(parseFloat(o.shop_lat));
      setPickupLng(parseFloat(o.shop_lng));
      setPickupAddr(o.shop_name ? `${o.shop_name}${o.shop_address ? " · " + o.shop_address : ""}` : (o.shop_address || "Seller shop"));
    }
  }, [orderData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Order deliveries can only be dispatched after the order payment webhook
  // confirms success — poll payment status and gate the flow on it.
  const { data: payData } = useQuery({
    queryKey: ["order-payment", orderId],
    queryFn: async () => { const { data } = await api.get(`/payment/status/${orderId}`); return data; },
    enabled: !!orderId,
    refetchInterval: (q) => (q.state.data?.paymentStatus === "success" ? false : 4000),
  });
  const paymentConfirmed = !orderId || payData?.paymentStatus === "success";
  const paymentFailed    = !!orderId && payData?.paymentStatus === "failed";

  const { data: optionsData, isLoading: optLoading } = useQuery({
    queryKey: ["ride-options", pickupLat, pickupLng, dropLat, dropLng],
    queryFn: async () => {
      const { data } = await api.get(
        `/rides/options?pickup_lat=${pickupLat}&pickup_lng=${pickupLng}&dropoff_lat=${dropLat}&dropoff_lng=${dropLng}`
      );
      return data;
    },
    enabled: !!(pickupLat && pickupLng && dropLat && dropLng),
  });

  const options  = optionsData?.options  || [];
  const distKm   = optionsData?.distanceKm || 0;
  const selected = options.find((o: any) => o.id === selectedVehicle);

  const requestMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a vehicle first");
      // 1) Create the ride (backend computes fare + notifies drivers)
      const { data } = await api.post("/rides/request", {
        orderId: orderId || undefined,
        vehicleType: selectedVehicle,
        pickupLat,   pickupLng,   pickupAddress: pickupAddr,
        dropoffLat: dropLat, dropoffLng: dropLng, dropoffAddress: dropAddr,
        payerPhone,
      });
      // 2) Initiate the delivery-fee payment against the REAL ride id.
      //    (Previously this was called before the ride existed with
      //    rideId: "pending", which always 404'd and broke the whole flow.)
      try {
        await api.post("/payment/delivery", { rideId: data.rideId, payerPhone });
      } catch (feeErr: any) {
        // Ride exists; user can still pay the driver — surface but don't block tracking
        console.warn("Delivery fee initiation failed:", feeErr?.response?.data?.error || feeErr.message);
      }
      return data;
    },
    onSuccess: (data: any) => {
      router.replace({ pathname: "/ride/tracking", params: { rideId: data.rideId } });
    },
    onError: (err: any) => {
      Alert.alert("Request failed", err?.response?.data?.error || err.message);
    },
  });

  const handleMapPress = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    if (!pickupLat) {
      setPickupLat(latitude);
      setPickupLng(longitude);
      Location.reverseGeocodeAsync({ latitude, longitude })
        .then((g) => { if (g[0]) setPickupAddr(`${g[0].street || ""} ${g[0].city || ""}`.trim()); });
    } else {
      setDropLat(latitude);
      setDropLng(longitude);
      Location.reverseGeocodeAsync({ latitude, longitude })
        .then((g) => { if (g[0]) setDropAddr(`${g[0].street || ""} ${g[0].city || ""}`.trim()); });
    }
  };

  const resetMap = () => {
    setPickupLat(null); setPickupLng(null); setPickupAddr("");
  };

  const initialRegion = dropLat != null && dropLng != null ? { latitude: dropLat, longitude: dropLng, latitudeDelta: 0.04, longitudeDelta: 0.04 } :
    { latitude: -6.7924, longitude: 39.2083, latitudeDelta: 0.08, longitudeDelta: 0.08 };

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F8" }}>
      <StatusBar style="dark" />
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 20, backgroundColor: "#F4F5F8", borderBottomWidth: 1, borderBottomColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#1B2036" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#1B2036", fontSize: 19, fontWeight: "800" }}>Request Delivery</Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
            {["map","vehicle","pay"].map((s, i) => (
              <View key={s} style={{ height: 3, flex: 1, borderRadius: 3, backgroundColor: (step === "map" ? 0 : step === "vehicle" ? 1 : 2) >= i ? "#EC7C2C" : "#E6E8EE" }} />
            ))}
          </View>
        </View>
      </View>

      {step === "map" && (
        <View style={{ flex: 1 }}>
          {/* Map */}
          <MapView
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={initialRegion}
            onPress={handleMapPress}
          >
            {pickupLat && pickupLng && (
              <Marker coordinate={{ latitude: pickupLat, longitude: pickupLng }} title="Pickup" pinColor="#16A34A" />
            )}
            {dropLat && dropLng && (
              <Marker coordinate={{ latitude: dropLat, longitude: dropLng }} title="Drop-off" pinColor="#EC7C2C" />
            )}
            {pickupLat && pickupLng && dropLat && dropLng && (
              <Polyline coordinates={[{ latitude: pickupLat, longitude: pickupLng }, { latitude: dropLat, longitude: dropLng }]} strokeColor="#EC7C2C" strokeWidth={3} lineDashPattern={[6, 4]} />
            )}
          </MapView>

          {/* Instruction + inputs */}
          <View style={{ backgroundColor: "#F4F5F8", padding: 20, borderTopWidth: 1, borderTopColor: "#FFFFFF" }}>
            <Text style={{ color: "#8A90A0", fontSize: 12, marginBottom: 12, textAlign: "center" }}>
              {!pickupLat ? "Tap map to set PICKUP (shop/seller) location" : !dropLat ? "Tap map to set DROPOFF (your) location" : "Ready! Review your locations"}
            </Text>

            {/* Pickup */}
            <View style={s.addrRow}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#16A34A", marginRight: 10, marginTop: 4 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.addrLabel}>Pickup</Text>
                <Text style={s.addrText} numberOfLines={1}>{pickupAddr || (pickupLat ? `${pickupLat?.toFixed(4)}, ${pickupLng?.toFixed(4)}` : "Tap map to set")}</Text>
              </View>
              {pickupLat && <TouchableOpacity onPress={resetMap}><Ionicons name="close-circle" size={20} color="#DC2626" /></TouchableOpacity>}
            </View>

            {/* Dropoff */}
            <View style={[s.addrRow, { marginTop: 10 }]}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#EC7C2C", marginRight: 10, marginTop: 4 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.addrLabel}>Drop-off</Text>
                <Text style={s.addrText} numberOfLines={1}>{dropAddr || (locLoading ? "Getting your location…" : dropLat ? `${dropLat?.toFixed(4)}, ${dropLng?.toFixed(4)}` : "Tap map to set")}</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => { if (!pickupLat || !dropLat) { Alert.alert("Set locations", "Please set both pickup and drop-off locations on the map."); return; } setStep("vehicle"); }}
              style={{ backgroundColor: "#2E3A74", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 16 }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Choose Vehicle →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === "vehicle" && (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          {distKm > 0 && (
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
              <View style={{ flex: 1, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#E6E8EE" }}>
                <Text style={{ color: "#8A90A0", fontSize: 11, marginBottom: 4 }}>DISTANCE</Text>
                <Text style={{ color: "#1B2036", fontSize: 20, fontWeight: "900" }}>{distKm} km</Text>
              </View>
            </View>
          )}

          <Text style={{ color: "#1B2036", fontSize: 18, fontWeight: "800", marginBottom: 14 }}>Choose Vehicle</Text>

          {optLoading ? (
            <ActivityIndicator color="#EC7C2C" size="large" style={{ marginTop: 40 }} />
          ) : (
            <View style={{ gap: 12 }}>
              {options.map((opt: any) => (
                <TouchableOpacity key={opt.id} onPress={() => setSelectedVehicle(opt.id)} activeOpacity={0.8}
                  style={{ backgroundColor: "#FFFFFF", borderRadius: 18, padding: 18, borderWidth: 2, borderColor: selectedVehicle === opt.id ? "#EC7C2C" : "#E6E8EE", flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <Text style={{ fontSize: 36 }}>{VEHICLE_ICONS[opt.id]}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ color: "#1B2036", fontWeight: "800", fontSize: 16 }}>{opt.name}</Text>
                      <Text style={{ color: "#EC7C2C", fontWeight: "900", fontSize: 17 }}>{formatMoney(opt.fare)}</Text>
                    </View>
                    <Text style={{ color: "#8A90A0", fontSize: 13, marginTop: 2 }}>{opt.subtitle}</Text>
                    <View style={{ flexDirection: "row", gap: 14, marginTop: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="time-outline" size={13} color="#8A90A0" />
                        <Text style={{ color: "#8A90A0", fontSize: 12 }}>{opt.eta}</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="cube-outline" size={13} color="#8A90A0" />
                        <Text style={{ color: "#8A90A0", fontSize: 12 }}>{opt.capacity}</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: opt.available > 0 ? "#16A34A" : "#DC2626" }} />
                        <Text style={{ color: opt.available > 0 ? "#16A34A" : "#DC2626", fontSize: 12 }}>
                          {opt.available > 0 ? `${opt.available} available` : "Not available"}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {selectedVehicle === opt.id && (
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#EC7C2C", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="checkmark" size={15} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
            <TouchableOpacity onPress={() => setStep("map")} style={{ flex: 1, backgroundColor: "#FFFFFF", borderRadius: 14, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: "#E6E8EE" }}>
              <Text style={{ color: "#6B7280", fontWeight: "700" }}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { if (!selectedVehicle) { Alert.alert("Select vehicle", "Please choose a delivery vehicle."); return; } setStep("pay"); }}
              style={{ flex: 2, backgroundColor: "#2E3A74", borderRadius: 14, paddingVertical: 16, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Pay for Delivery →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {step === "pay" && selected && (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
          {/* Summary card */}
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 18, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: "#EC7C2C30" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <Text style={{ fontSize: 40 }}>{VEHICLE_ICONS[selected.id]}</Text>
              <View>
                <Text style={{ color: "#1B2036", fontWeight: "800", fontSize: 18 }}>{selected.name}</Text>
                <Text style={{ color: "#8A90A0" }}>{selected.subtitle}</Text>
              </View>
            </View>
            {[
              { label: "Distance",      value: `${distKm} km` },
              { label: "Estimated ETA", value: selected.eta },
              { label: "Delivery Fee",  value: formatMoney(selected.fare), highlight: true },
            ].map((row) => (
              <View key={row.label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#E6E8EE" }}>
                <Text style={{ color: "#6B7280", fontSize: 14 }}>{row.label}</Text>
                <Text style={{ color: row.highlight ? "#EC7C2C" : "#1B2036", fontWeight: row.highlight ? "900" : "700", fontSize: 14 }}>{row.value}</Text>
              </View>
            ))}
          </View>

          {/* Route labels */}
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#E6E8EE" }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#16A34A", marginTop: 4 }} />
              <View>
                <Text style={{ color: "#8A90A0", fontSize: 11 }}>PICKUP</Text>
                <Text style={{ color: "#1B2036", fontSize: 13 }}>{pickupAddr || "Set on map"}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#EC7C2C", marginTop: 4 }} />
              <View>
                <Text style={{ color: "#8A90A0", fontSize: 11 }}>DROP-OFF</Text>
                <Text style={{ color: "#1B2036", fontSize: 13 }}>{dropAddr || "Your location"}</Text>
              </View>
            </View>
          </View>

          {/* Phone input */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "600", marginBottom: 8 }}>Mobile Money Number</Text>
            <View style={{ backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E6E8EE", borderRadius: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }}>
              <Text style={{ color: "#6B7280", marginRight: 8 }}>🇹🇿</Text>
              <TextInput value={payerPhone} onChangeText={setPayerPhone} placeholder="0712 345 678" placeholderTextColor="#A0A6B4" keyboardType="phone-pad"
                style={{ flex: 1, color: "#1B2036", fontSize: 15, paddingVertical: 15 }} />
            </View>
            {detectProvider(payerPhone) && (
              <Text style={{ color: "#16A34A", fontSize: 12, marginTop: 6 }}>✓ {detectProvider(payerPhone)}</Text>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity onPress={() => setStep("vehicle")} style={{ flex: 1, backgroundColor: "#FFFFFF", borderRadius: 14, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: "#E6E8EE" }}>
              <Text style={{ color: "#6B7280", fontWeight: "700" }}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => requestMutation.mutate()}
              disabled={requestMutation.isPending || !payerPhone || !paymentConfirmed}
              style={{ flex: 2, backgroundColor: paymentConfirmed ? "#EC7C2C" : "#E6E8EE", borderRadius: 14, paddingVertical: 16, alignItems: "center", opacity: requestMutation.isPending ? 0.7 : 1, flexDirection: "row", justifyContent: "center", gap: 8 }}>
              {requestMutation.isPending ? <ActivityIndicator color="#fff" /> : <Ionicons name="phone-portrait" size={18} color="#fff" />}
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
                {requestMutation.isPending ? "Requesting…" : `Pay ${formatMoney(selected.fare)}`}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Order payment gating — rides for an order can only be dispatched
              once the order's mobile-money payment is confirmed by the webhook */}
          {!!orderId && !paymentConfirmed && !paymentFailed && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#E0950B10", borderColor: "#E0950B40", borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 14 }}>
              <ActivityIndicator color="#E0950B" size="small" />
              <Text style={{ color: "#E0950B", fontSize: 13, flex: 1 }}>
                Waiting for your order payment to be confirmed… Approve the mobile-money prompt on your phone. This unlocks automatically.
              </Text>
            </View>
          )}
          {paymentFailed && (
            <View style={{ backgroundColor: "#DC262610", borderColor: "#DC262640", borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 14 }}>
              <Text style={{ color: "#DC2626", fontSize: 13 }}>
                Your order payment failed, so delivery can't be requested. Go back to your orders and retry the payment.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  addrRow: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#FFFFFF", borderRadius: 13, padding: 12, borderWidth: 1, borderColor: "#E6E8EE" },
  addrLabel: { color: "#8A90A0", fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  addrText: { color: "#1B2036", fontSize: 14, marginTop: 2 },
});
