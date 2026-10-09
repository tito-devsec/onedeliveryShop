import { useApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Alert, StyleSheet,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatMoney, detectProvider } from "@/lib/utils";
import { addressFor, currentPosition, decodePolyline, DEFAULT_CENTER, PickedPlace } from "@/lib/maps";
import LocationPickerModal from "@/components/LocationPickerModal";

const VEHICLE_ICONS: Record<string, string> = {
  bodaboda: "🏍️", bajaj: "🛺", pickup: "🚛", toyo: "🚙",
};

export default function RideRequestScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const api = useApi();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  // Drop-off is the customer's location: GPS by default, adjustable on the map
  const [dropoff, setDropoff] = useState<PickedPlace | null>(null);
  const [locating, setLocating] = useState(true);
  const [picking, setPicking] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [payerPhone, setPayerPhone] = useState(user?.phone || "");
  const [step, setStep] = useState<"map" | "vehicle" | "pay">("map");

  useEffect(() => {
    (async () => {
      const here = await currentPosition();
      if (here) setDropoff({ ...here, address: await addressFor(here) });
      setLocating(false);
    })();
  }, []);

  // The pickup point is the seller's shop — set by the server, not chosen here
  const { data: orderData, isLoading: orderLoading } = useQuery({
    queryKey: ["order-for-ride", orderId],
    queryFn: async () => { const { data } = await api.get(`/orders/${orderId}`); return data; },
    enabled: !!orderId,
  });
  const pickup = orderData?.order?.pickup as { lat: number; lng: number; name: string; address: string } | null | undefined;
  const shopMissing = !!orderData && !pickup;

  // Order deliveries can only be dispatched after the order payment webhook
  // confirms success — poll payment status and gate the flow on it.
  const { data: payData } = useQuery({
    queryKey: ["order-payment", orderId],
    queryFn: async () => { const { data } = await api.get(`/payment/status/${orderId}`); return data; },
    enabled: !!orderId,
    refetchInterval: (q) => (q.state.data?.paymentStatus === "success" ? false : 4000),
  });
  const paymentConfirmed = payData?.paymentStatus === "success";
  const paymentFailed    = payData?.paymentStatus === "failed";

  const { data: optionsData, isLoading: optLoading, error: optError } = useQuery({
    queryKey: ["ride-options", orderId, dropoff?.latitude, dropoff?.longitude],
    queryFn: async () => {
      const { data } = await api.get("/rides/options", {
        params: { order_id: orderId, dropoff_lat: dropoff!.latitude, dropoff_lng: dropoff!.longitude },
      });
      return data;
    },
    enabled: !!(orderId && pickup && dropoff),
    retry: false,
  });

  const options  = optionsData?.options || [];
  const route    = optionsData?.route as { distanceKm: number; durationMin: number; polyline: string } | null | undefined;
  const distKm   = route?.distanceKm ?? optionsData?.distanceKm ?? 0;
  const selected = options.find((o: any) => o.id === selectedVehicle);
  const routeLine = useMemo(() => (route?.polyline ? decodePolyline(route.polyline) : null), [route?.polyline]);
  const shopPoint = pickup ? { latitude: Number(pickup.lat), longitude: Number(pickup.lng) } : null;
  const dropPoint = dropoff ? { latitude: dropoff.latitude, longitude: dropoff.longitude } : null;
  const optionsErr = (optError as any)?.response?.data?.error as string | undefined;

  // Frame the shop, the customer and the road between them
  useEffect(() => {
    const pts = [shopPoint, dropPoint, ...(routeLine || [])].filter(Boolean) as { latitude: number; longitude: number }[];
    if (pts.length >= 2 && step === "map") {
      setTimeout(() => mapRef.current?.fitToCoordinates(pts, { edgePadding: { top: 60, right: 50, bottom: 60, left: 50 }, animated: true }), 300);
    }
  }, [shopPoint?.latitude, dropPoint?.latitude, dropPoint?.longitude, routeLine, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const requestMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !dropoff) throw new Error("Select a vehicle first");
      // 1) Create the ride (the server sets the pickup, computes the fare and offers it to the nearest drivers)
      const { data } = await api.post("/rides/request", {
        orderId,
        vehicleType: selectedVehicle,
        dropoffLat: dropoff.latitude,
        dropoffLng: dropoff.longitude,
        dropoffAddress: dropoff.address,
        payerPhone,
      });
      // 2) Initiate the delivery-fee payment against the real ride id
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
      const existing = err?.response?.data?.rideId;
      if (existing) {
        router.replace({ pathname: "/ride/tracking", params: { rideId: existing } });
        return;
      }
      Alert.alert("Request failed", err?.response?.data?.error || err.message);
    },
  });

  const anyNearby = options.some((o: any) => o.available > 0);

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F8" }}>
      <StatusBar style="dark" />
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 20, backgroundColor: "#F4F5F8", borderBottomWidth: 1, borderBottomColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => (step === "map" ? router.back() : setStep(step === "pay" ? "vehicle" : "map"))}>
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
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={{ ...(dropPoint || shopPoint || DEFAULT_CENTER), latitudeDelta: 0.05, longitudeDelta: 0.05 }}
            showsUserLocation
          >
            {shopPoint && (
              <Marker coordinate={shopPoint} title={pickup?.name || "Shop"} description="Pickup">
                <View style={{ backgroundColor: "#16A34A", borderRadius: 20, padding: 8, borderWidth: 2, borderColor: "#fff" }}>
                  <Ionicons name="storefront" size={18} color="#fff" />
                </View>
              </Marker>
            )}
            {dropPoint && (
              <Marker coordinate={dropPoint} title="Drop-off" description={dropoff?.address} onPress={() => setPicking(true)}>
                <View style={{ backgroundColor: "#EC7C2C", borderRadius: 20, padding: 8, borderWidth: 2, borderColor: "#fff" }}>
                  <Ionicons name="home" size={18} color="#fff" />
                </View>
              </Marker>
            )}
            {routeLine && routeLine.length > 1 ? (
              <Polyline coordinates={routeLine} strokeColor="#2E3A74" strokeWidth={5} />
            ) : shopPoint && dropPoint ? (
              <Polyline coordinates={[shopPoint, dropPoint]} strokeColor="#EC7C2C" strokeWidth={3} lineDashPattern={[6, 4]} />
            ) : null}
          </MapView>

          <View style={{ backgroundColor: "#F4F5F8", padding: 20, paddingBottom: insets.bottom + 16, borderTopWidth: 1, borderTopColor: "#FFFFFF" }}>
            {/* Pickup: the shop, fixed */}
            <View style={s.addrRow}>
              <View style={[s.dot, { backgroundColor: "#16A34A" }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.addrLabel}>Pickup · shop</Text>
                <Text style={s.addrText} numberOfLines={1}>
                  {orderLoading ? "Loading shop…" : pickup ? `${pickup.name}${pickup.address ? " · " + pickup.address : ""}` : "Shop location not set"}
                </Text>
              </View>
              <Ionicons name="lock-closed" size={16} color="#8A90A0" />
            </View>

            {/* Drop-off: the customer */}
            <TouchableOpacity onPress={() => setPicking(true)} style={[s.addrRow, { marginTop: 10 }]}>
              <View style={[s.dot, { backgroundColor: "#EC7C2C" }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.addrLabel}>Drop-off · you</Text>
                <Text style={s.addrText} numberOfLines={1}>
                  {dropoff?.address || (locating ? "Getting your location…" : "Set your delivery location")}
                </Text>
              </View>
              <Text style={{ color: "#EC7C2C", fontWeight: "800", fontSize: 13 }}>Change</Text>
            </TouchableOpacity>

            {shopMissing ? (
              <View style={s.warn}>
                <Ionicons name="alert-circle" size={18} color="#E0950B" />
                <Text style={s.warnText}>This shop hasn't added its location yet, so a driver can't be sent. We've asked the seller to add it — please try again later.</Text>
              </View>
            ) : optionsErr ? (
              <View style={s.warn}>
                <Ionicons name="alert-circle" size={18} color="#E0950B" />
                <Text style={s.warnText}>{optionsErr}</Text>
              </View>
            ) : route ? (
              <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 12, textAlign: "center" }}>
                {route.distanceKm} km by road · about {route.durationMin} min drive
              </Text>
            ) : null}

            <TouchableOpacity
              onPress={() => {
                if (!dropoff) { setPicking(true); return; }
                setStep("vehicle");
              }}
              disabled={!pickup || !!optionsErr}
              style={{ backgroundColor: !pickup || optionsErr ? "#A0A6B4" : "#2E3A74", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 14 }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{dropoff ? "Choose Vehicle →" : "Set delivery location"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === "vehicle" && (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
            <View style={s.statBox}>
              <Text style={s.statLabel}>DISTANCE</Text>
              <Text style={s.statValue}>{distKm} km</Text>
            </View>
            {!!route && (
              <View style={s.statBox}>
                <Text style={s.statLabel}>DRIVE TIME</Text>
                <Text style={s.statValue}>{route.durationMin} min</Text>
              </View>
            )}
          </View>

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
                    <Text style={{ color: "#8A90A0", fontSize: 13, marginTop: 2 }}>{opt.subtitle} · {opt.capacity}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: opt.available > 0 ? "#16A34A" : "#DC2626" }} />
                      <Text style={{ color: opt.available > 0 ? "#16A34A" : "#DC2626", fontSize: 12, fontWeight: "600" }}>
                        {opt.available > 0
                          ? `${opt.available} near the shop${opt.pickupEtaMin ? ` · nearest ~${opt.pickupEtaMin} min away` : ""}`
                          : "None near the shop right now"}
                      </Text>
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

          {!optLoading && !anyNearby && options.length > 0 && (
            <View style={[s.warn, { marginTop: 16 }]}>
              <Ionicons name="time-outline" size={18} color="#E0950B" />
              <Text style={s.warnText}>No drivers are close to the shop at the moment. You can still request — we'll keep searching wider for 10 minutes.</Text>
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
        <KeyboardAwareScrollView bottomOffset={130} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
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
              { label: "Distance",      value: `${distKm} km${route ? ` · ~${route.durationMin} min` : ""}` },
              { label: "Driver to shop", value: selected.pickupEtaMin ? `~${selected.pickupEtaMin} min` : "Searching nearby" },
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
              <View style={[s.dot, { backgroundColor: "#16A34A", marginRight: 0 }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#8A90A0", fontSize: 11 }}>PICKUP · SHOP</Text>
                <Text style={{ color: "#1B2036", fontSize: 13 }}>{pickup ? `${pickup.name}${pickup.address ? " · " + pickup.address : ""}` : "Shop"}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <View style={[s.dot, { backgroundColor: "#EC7C2C", marginRight: 0 }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#8A90A0", fontSize: 11 }}>DROP-OFF · YOU</Text>
                <Text style={{ color: "#1B2036", fontSize: 13 }}>{dropoff?.address || "Your location"}</Text>
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
          {!paymentConfirmed && !paymentFailed && (
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
        </KeyboardAwareScrollView>
      )}

      <LocationPickerModal
        visible={picking}
        title="Where should we deliver?"
        hint="Move the map so the pin is on your door, or search for a place."
        initial={dropPoint}
        confirmLabel="Deliver here"
        onClose={() => setPicking(false)}
        onConfirm={(p) => { setDropoff(p); setPicking(false); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  addrRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 13, padding: 12, borderWidth: 1, borderColor: "#E6E8EE", gap: 8 },
  addrLabel: { color: "#8A90A0", fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  addrText: { color: "#1B2036", fontSize: 14, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 2, marginTop: 4 },
  warn: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "#E0950B10", borderColor: "#E0950B40", borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 12 },
  warnText: { color: "#9A6700", fontSize: 13, flex: 1, lineHeight: 18 },
  statBox: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#E6E8EE" },
  statLabel: { color: "#8A90A0", fontSize: 11, marginBottom: 4 },
  statValue: { color: "#1B2036", fontSize: 20, fontWeight: "900" },
});
