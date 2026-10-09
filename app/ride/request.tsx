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
import { Image } from "expo-image";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatMoney, detectProvider } from "@/lib/utils";
import { addressFor, currentPosition, decodePolyline, DEFAULT_CENTER, PickedPlace } from "@/lib/maps";
import { vehicleSideImage } from "@/lib/vehicles";
import LocationPickerModal from "@/components/LocationPickerModal";

type PayMethod = "mobile" | "cash";
type VehicleOption = {
  id: string; name: string; subtitle: string; capacity: string;
  fare: number; offerMin: number; offerMax: number;
  available: number; pickupEtaMin: number | null;
};

const OFFER_STEP = 500;
const round100 = (n: number) => Math.round(n / 100) * 100;
const grouped = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const PAY_METHODS: { id: PayMethod; icon: keyof typeof Ionicons.glyphMap; title: string; note: string }[] = [
  { id: "mobile", icon: "phone-portrait-outline", title: "Mobile money", note: "Pay in the app once a driver agrees to a price" },
  { id: "cash", icon: "cash-outline", title: "Cash", note: "Pay the driver when your order arrives" },
];

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
  const [payMethod, setPayMethod] = useState<PayMethod>("mobile");
  const [offer, setOffer] = useState(0);
  const [offerText, setOfferText] = useState("");
  const [editingOffer, setEditingOffer] = useState(false);
  const [step, setStep] = useState<"map" | "vehicle" | "offer">("map");

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

  const options: VehicleOption[] = optionsData?.options || [];
  const route    = optionsData?.route as { distanceKm: number; durationMin: number; polyline: string } | null | undefined;
  const distKm   = route?.distanceKm ?? optionsData?.distanceKm ?? 0;
  const driveMin = route?.durationMin ?? optionsData?.durationMin ?? null;
  const selected = options.find((o) => o.id === selectedVehicle);
  const routeLine = useMemo(() => (route?.polyline ? decodePolyline(route.polyline) : null), [route?.polyline]);
  const shopPoint = pickup ? { latitude: Number(pickup.lat), longitude: Number(pickup.lng) } : null;
  const dropPoint = dropoff ? { latitude: dropoff.latitude, longitude: dropoff.longitude } : null;
  const optionsErr = (optError as any)?.response?.data?.error as string | undefined;

  // The offer starts at the suggested price for the chosen vehicle (and again if the trip changes)
  useEffect(() => {
    if (selected) {
      setOffer(selected.fare);
      setOfferText(String(selected.fare));
    }
  }, [selected?.id, selected?.fare]); // eslint-disable-line react-hooks/exhaustive-deps

  const clampOffer = (n: number) => (selected ? Math.min(selected.offerMax, Math.max(selected.offerMin, round100(n))) : n);
  const setOfferValue = (n: number) => {
    const v = clampOffer(n);
    setOffer(v);
    setOfferText(String(v));
  };
  const commitTypedOffer = () => {
    setEditingOffer(false);
    const typed = Number(offerText);
    setOfferValue(Number.isFinite(typed) && typed > 0 ? typed : offer);
  };

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
      // The server sets the pickup and checks the offer; nearby drivers accept it or send their own price
      const { data } = await api.post("/rides/request", {
        orderId,
        vehicleType: selected.id,
        dropoffLat: dropoff.latitude,
        dropoffLng: dropoff.longitude,
        dropoffAddress: dropoff.address,
        offeredFare: offer,
        paymentMethod: payMethod,
      });
      return data;
    },
    onSuccess: (data: any) => {
      router.replace({ pathname: "/ride/tracking", params: { rideId: data.rideId, phone: payMethod === "mobile" ? payerPhone : "" } });
    },
    onError: (err: any) => {
      const body = err?.response?.data;
      if (body?.rideId) {
        router.replace({ pathname: "/ride/tracking", params: { rideId: body.rideId } });
        return;
      }
      if (body?.code === "offer_out_of_range" && body.min && body.max) {
        setOfferValue(Math.min(body.max, Math.max(body.min, offer)));
      }
      Alert.alert("Request failed", body?.error || err.message);
    },
  });

  const anyNearby = options.some((o) => o.available > 0);
  const offerHint = !selected ? null
    : offer < selected.fare
      ? { color: "#B45309", icon: "alert-circle-outline" as const, text: "Below the suggested price — drivers may take longer to accept, or send a higher price." }
      : offer > selected.fare
        ? { color: "#15803D", icon: "flash-outline" as const, text: "Above the suggested price — drivers near the shop accept faster." }
        : { color: "#15803D", icon: "checkmark-circle-outline" as const, text: "The suggested price for this trip — drivers usually accept it quickly." };
  const mobileReady = payMethod === "cash" || payerPhone.replace(/\D/g, "").length >= 9;

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F8" }}>
      <StatusBar style="dark" />
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 20, backgroundColor: "#F4F5F8", borderBottomWidth: 1, borderBottomColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => (step === "map" ? router.back() : setStep(step === "offer" ? "vehicle" : "map"))}>
          <Ionicons name="arrow-back" size={26} color="#1B2036" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#1B2036", fontSize: 19, fontWeight: "800" }}>
            {step === "offer" ? "Offer your price" : "Request Delivery"}
          </Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
            {["map", "vehicle", "offer"].map((s, i) => (
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
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
            <View style={s.statBox}>
              <Text style={s.statLabel}>DISTANCE</Text>
              <Text style={s.statValue}>{distKm} km</Text>
            </View>
            {!!driveMin && (
              <View style={s.statBox}>
                <Text style={s.statLabel}>DRIVE TIME</Text>
                <Text style={s.statValue}>{driveMin} min</Text>
              </View>
            )}
          </View>

          <Text style={{ color: "#1B2036", fontSize: 18, fontWeight: "800" }}>Choose Vehicle</Text>
          <Text style={{ color: "#8A90A0", fontSize: 13, marginTop: 2, marginBottom: 14 }}>
            Prices are suggestions — you'll offer your own price next.
          </Text>

          {optLoading ? (
            <ActivityIndicator color="#EC7C2C" size="large" style={{ marginTop: 40 }} />
          ) : (
            <View style={{ gap: 12 }}>
              {options.map((opt) => {
                const active = selectedVehicle === opt.id;
                return (
                  <TouchableOpacity key={opt.id} onPress={() => setSelectedVehicle(opt.id)} activeOpacity={0.8}
                    style={{ backgroundColor: "#FFFFFF", borderRadius: 18, paddingVertical: 14, paddingHorizontal: 14, borderWidth: 2, borderColor: active ? "#EC7C2C" : "#E6E8EE", flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Image source={vehicleSideImage(opt.id)} style={{ width: 84, height: 56 }} contentFit="contain" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#1B2036", fontWeight: "800", fontSize: 16 }}>{opt.name}</Text>
                      <Text style={{ color: "#8A90A0", fontSize: 12, marginTop: 1 }} numberOfLines={1}>{opt.subtitle}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: opt.available > 0 ? "#16A34A" : "#DC2626" }} />
                        <Text style={{ color: opt.available > 0 ? "#16A34A" : "#DC2626", fontSize: 12, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                          {opt.available > 0
                            ? `${opt.available} nearby${opt.pickupEtaMin ? ` · ~${opt.pickupEtaMin} min away` : ""}`
                            : "None nearby right now"}
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ color: "#EC7C2C", fontWeight: "900", fontSize: 16 }}>{formatMoney(opt.fare)}</Text>
                      <Text style={{ color: "#8A90A0", fontSize: 11, marginTop: 1 }}>suggested</Text>
                      {active && (
                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#EC7C2C", alignItems: "center", justifyContent: "center", marginTop: 6 }}>
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
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
              onPress={() => { if (!selectedVehicle) { Alert.alert("Select vehicle", "Please choose a delivery vehicle."); return; } setStep("offer"); }}
              style={{ flex: 2, backgroundColor: "#2E3A74", borderRadius: 14, paddingVertical: 16, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Offer your price →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {step === "offer" && selected && (
        <KeyboardAwareScrollView bottomOffset={130} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
          {/* Vehicle + trip */}
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 18, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#E6E8EE", flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Image source={vehicleSideImage(selected.id)} style={{ width: 78, height: 52 }} contentFit="contain" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#1B2036", fontWeight: "800", fontSize: 17 }}>{selected.name}</Text>
              <Text style={{ color: "#8A90A0", fontSize: 13 }}>
                {distKm} km{driveMin ? ` · ~${driveMin} min drive` : ""}{selected.pickupEtaMin ? ` · driver ~${selected.pickupEtaMin} min from shop` : ""}
              </Text>
            </View>
          </View>

          {/* The customer's price */}
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "#EC7C2C40" }}>
            <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "700", textAlign: "center", letterSpacing: 0.5 }}>YOUR OFFER</Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
              <TouchableOpacity onPress={() => setOfferValue(offer - OFFER_STEP)} disabled={offer <= selected.offerMin}
                style={[s.stepBtn, offer <= selected.offerMin && { opacity: 0.35 }]}>
                <Ionicons name="remove" size={26} color="#2E3A74" />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ color: "#8A90A0", fontSize: 13, fontWeight: "700" }}>TZS</Text>
                <TextInput
                  value={editingOffer ? offerText : grouped(offer)}
                  onFocus={() => { setEditingOffer(true); setOfferText(String(offer)); }}
                  onChangeText={(t) => setOfferText(t.replace(/[^0-9]/g, ""))}
                  onEndEditing={commitTypedOffer}
                  onSubmitEditing={commitTypedOffer}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  maxLength={7}
                  selectTextOnFocus
                  style={{ color: "#1B2036", fontSize: 34, fontWeight: "900", textAlign: "center", paddingVertical: 2, minWidth: 140 }}
                />
              </View>
              <TouchableOpacity onPress={() => setOfferValue(offer + OFFER_STEP)} disabled={offer >= selected.offerMax}
                style={[s.stepBtn, offer >= selected.offerMax && { opacity: 0.35 }]}>
                <Ionicons name="add" size={26} color="#2E3A74" />
              </TouchableOpacity>
            </View>
            <Text style={{ color: "#8A90A0", fontSize: 12, textAlign: "center", marginTop: 6 }}>
              Suggested {formatMoney(selected.fare)} · offer {grouped(selected.offerMin)}–{grouped(selected.offerMax)}
            </Text>
            {offer !== selected.fare && (
              <TouchableOpacity onPress={() => setOfferValue(selected.fare)} style={{ alignSelf: "center", marginTop: 10, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#2E3A740F" }}>
                <Text style={{ color: "#2E3A74", fontWeight: "800", fontSize: 12 }}>Use suggested price</Text>
              </TouchableOpacity>
            )}
            {offerHint && (
              <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start", marginTop: 12 }}>
                <Ionicons name={offerHint.icon} size={16} color={offerHint.color} style={{ marginTop: 1 }} />
                <Text style={{ color: offerHint.color, fontSize: 12.5, flex: 1, lineHeight: 17 }}>{offerHint.text}</Text>
              </View>
            )}
          </View>

          {/* How the driver gets paid */}
          <Text style={{ color: "#1B2036", fontWeight: "800", fontSize: 15, marginBottom: 10 }}>How will you pay?</Text>
          <View style={{ gap: 10, marginBottom: 16 }}>
            {PAY_METHODS.map((m) => {
              const active = payMethod === m.id;
              return (
                <TouchableOpacity key={m.id} onPress={() => setPayMethod(m.id)} activeOpacity={0.85}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, borderWidth: 2, borderColor: active ? "#EC7C2C" : "#E6E8EE" }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: active ? "#EC7C2C18" : "#F4F5F8", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={m.icon} size={20} color={active ? "#EC7C2C" : "#6B7280"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#1B2036", fontWeight: "800", fontSize: 15 }}>{m.title}</Text>
                    <Text style={{ color: "#8A90A0", fontSize: 12.5, marginTop: 1 }}>{m.note}</Text>
                  </View>
                  <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={22} color={active ? "#EC7C2C" : "#A0A6B4"} />
                </TouchableOpacity>
              );
            })}
          </View>

          {payMethod === "mobile" && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "600", marginBottom: 8 }}>Mobile money number</Text>
              <View style={{ backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E6E8EE", borderRadius: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }}>
                <Text style={{ color: "#6B7280", marginRight: 8 }}>🇹🇿</Text>
                <TextInput value={payerPhone} onChangeText={setPayerPhone} placeholder="0712 345 678" placeholderTextColor="#A0A6B4" keyboardType="phone-pad"
                  style={{ flex: 1, color: "#1B2036", fontSize: 15, paddingVertical: 15 }} />
              </View>
              {detectProvider(payerPhone) ? (
                <Text style={{ color: "#16A34A", fontSize: 12, marginTop: 6 }}>✓ {detectProvider(payerPhone)}</Text>
              ) : (
                <Text style={{ color: "#8A90A0", fontSize: 12, marginTop: 6 }}>You'll get the payment prompt after a driver agrees to a price.</Text>
              )}
            </View>
          )}

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

          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity onPress={() => setStep("vehicle")} style={{ flex: 1, backgroundColor: "#FFFFFF", borderRadius: 14, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: "#E6E8EE" }}>
              <Text style={{ color: "#6B7280", fontWeight: "700" }}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => requestMutation.mutate()}
              disabled={requestMutation.isPending || !paymentConfirmed || !mobileReady || editingOffer}
              style={{ flex: 2, backgroundColor: paymentConfirmed && mobileReady ? "#EC7C2C" : "#C9CDD6", borderRadius: 14, paddingVertical: 16, alignItems: "center", opacity: requestMutation.isPending ? 0.7 : 1, flexDirection: "row", justifyContent: "center", gap: 8 }}>
              {requestMutation.isPending ? <ActivityIndicator color="#fff" /> : <Ionicons name="search" size={18} color="#fff" />}
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
                {requestMutation.isPending ? "Sending…" : `Find a driver · ${formatMoney(offer)}`}
              </Text>
            </TouchableOpacity>
          </View>
          {!mobileReady && (
            <Text style={{ color: "#B45309", fontSize: 12, marginTop: 8, textAlign: "center" }}>Enter your mobile money number, or choose cash.</Text>
          )}

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
  stepBtn: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: "#2E3A7430", alignItems: "center", justifyContent: "center", backgroundColor: "#F4F5F8" },
});
