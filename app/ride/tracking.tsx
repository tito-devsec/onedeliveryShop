import { useApi } from "@/lib/api";
import { subscribe } from "@/lib/socket";
import { formatMoney, detectProvider } from "@/lib/utils";
import { decodePolyline, formatDistance, formatEta } from "@/lib/maps";
import { vehicleName, vehicleSideImage } from "@/lib/vehicles";
import { useAuth } from "@/context/AuthContext";
import VehicleMarker from "@/components/VehicleMarker";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Linking, Alert, ActivityIndicator, TextInput } from "react-native";
import { Image } from "expo-image";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const STATUS_STEPS = [
  { key: "searching",    label: "Agreeing a price with a driver", icon: "search-outline" },
  { key: "accepted",     label: "Driver on the way to the shop",  icon: "navigate-outline" },
  { key: "going_to_shop",label: "Driver at the shop",             icon: "storefront-outline" },
  { key: "picked_up",    label: "Order collected",                icon: "cube-outline" },
  { key: "on_the_way",   label: "On the way to you",              icon: "navigate-outline" },
  { key: "delivered",    label: "Delivered!",                     icon: "gift-outline" },
];

const STATUS_MESSAGES: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; text: string }> = {
  searching:     { icon: "radio-outline",        color: "#EC7C2C", text: "Your offer is with the drivers nearest the shop" },
  accepted:      { icon: "navigate-circle",      color: "#2E3A74", text: "Your driver is heading to the shop" },
  going_to_shop: { icon: "storefront",           color: "#2E3A74", text: "Your driver is at the shop collecting your order" },
  picked_up:     { icon: "cube",                 color: "#2E3A74", text: "Your driver has your order" },
  on_the_way:    { icon: "navigate-circle",      color: "#16A34A", text: "Your order is on the way to you" },
  delivered:     { icon: "checkmark-circle",     color: "#16A34A", text: "Your order has been delivered" },
  cancelled:     { icon: "close-circle",         color: "#DC2626", text: "Delivery was cancelled" },
  no_driver:     { icon: "alert-circle",         color: "#E0950B", text: "No driver took this delivery. Please try again — a higher offer helps." },
};

const LIVE = ["accepted", "going_to_shop", "picked_up", "on_the_way"];
const CANCELLABLE = ["searching", "accepted", "going_to_shop"];
const RAISE_STEPS = [500, 1000, 2000];
const round100 = (n: number) => Math.round(n / 100) * 100;

type Point = { latitude: number; longitude: number };
type Counter = {
  rideId: string; driverId: string; name: string; photo: string | null; rating: number; trips: number;
  vehicle: { type: string; plate: string | null; model: string | null; color: string | null };
  fare: number; pickupKm: number | null; pickupEtaMin: number | null;
};
type PayState = "idle" | "waiting" | "failed";

export default function TrackingScreen() {
  const { rideId, phone } = useLocalSearchParams<{ rideId: string; phone?: string }>();
  const api     = useApi();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const insets  = useSafeAreaInsets();
  const mapRef  = useRef<MapView>(null);

  const [driver, setDriver] = useState<(Point & { heading: number }) | null>(null);
  const [live, setLive] = useState<{ etaSeconds: number | null; remainingMeters: number | null } | null>(null);
  const [stars, setStars] = useState(0);
  const [raiseBy, setRaiseBy] = useState(0);
  const [payPhone, setPayPhone] = useState(phone || user?.phone || "");
  const [payState, setPayState] = useState<PayState>("idle");
  const [payByMobile, setPayByMobile] = useState<boolean | null>(null); // the customer's switch; null = as chosen
  const routeVersion = useRef<number | null>(null);
  const framedLeg = useRef<string | null>(null);

  const { data: ride, isLoading, refetch } = useQuery({
    queryKey: ["ride", rideId],
    queryFn: async () => {
      const { data } = await api.get(`/rides/${rideId}`);
      return data.ride;
    },
    enabled: !!rideId,
    refetchInterval: (q) =>
      ["delivered", "cancelled", "no_driver"].includes(q.state.data?.status) ? false
      : payState === "waiting" ? 4_000 : 15_000,
  });

  const status: string = ride?.status || "searching";

  const { data: route, refetch: refetchRoute } = useQuery({
    queryKey: ["ride-route", rideId],
    queryFn: async () => {
      const { data } = await api.get(`/rides/${rideId}/route`);
      return data;
    },
    enabled: !!rideId,
    refetchInterval: (q) => (LIVE.includes(q.state.data?.status) ? 30_000 : false),
  });

  // Drivers' prices while the customer is choosing (also pushed live over the socket)
  const countersKey = ["ride-counters", rideId];
  const { data: counters = [] } = useQuery<Counter[]>({
    queryKey: countersKey,
    queryFn: async () => {
      const { data } = await api.get(`/rides/${rideId}/counters`);
      return data.counters || [];
    },
    enabled: !!rideId && status === "searching",
    refetchInterval: status === "searching" ? 10_000 : false,
  });
  const sortedCounters = useMemo(
    () => [...counters].sort((a, b) => a.fare - b.fare || (a.pickupEtaMin ?? 99) - (b.pickupEtaMin ?? 99)),
    [counters]
  );

  // Live position + ETA after every driver GPS fix; status, prices and payment the moment they change
  useEffect(() => {
    if (!rideId) return;
    const offLocation = subscribe("driver:location_update", (p: any) => {
      if (p.rideId !== rideId) return;
      setDriver({ latitude: p.lat, longitude: p.lng, heading: p.heading ?? -1 });
      setLive({ etaSeconds: p.etaSeconds ?? null, remainingMeters: p.remainingMeters ?? null });
      if (p.routeVersion && p.routeVersion !== routeVersion.current) {
        routeVersion.current = p.routeVersion;
        refetchRoute();
      }
    });
    const offStatus = subscribe("ride:status", (s: any) => {
      if (s.rideId !== rideId) return;
      refetch();
      refetchRoute();
    });
    const offCounter = subscribe("ride:counter", (c: Counter) => {
      if (c.rideId !== rideId) return;
      queryClient.setQueryData<Counter[]>(countersKey, (old = []) => [...old.filter((o) => o.driverId !== c.driverId), c]);
    });
    const offWithdrawn = subscribe("ride:counter_withdrawn", (w: any) => {
      if (w.rideId !== rideId) return;
      queryClient.setQueryData<Counter[]>(countersKey, (old = []) => old.filter((o) => o.driverId !== w.driverId));
    });
    const offPayment = subscribe("ride:payment", (p: any) => {
      if (p.rideId !== rideId) return;
      setPayState(p.status === "paid" ? "idle" : "failed");
      refetch();
    });
    return () => {
      offLocation();
      offStatus();
      offCounter();
      offWithdrawn();
      offPayment();
    };
  }, [rideId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Same data from the API (first load, and if the socket is down)
  useEffect(() => {
    if (ride?.driver_lat && ride?.driver_lng) {
      setDriver({ latitude: Number(ride.driver_lat), longitude: Number(ride.driver_lng), heading: ride.driver_heading != null ? Number(ride.driver_heading) : -1 });
    }
    if (ride?.eta_seconds != null) setLive({ etaSeconds: ride.eta_seconds, remainingMeters: ride.remaining_meters ?? null });
  }, [ride?.driver_lat, ride?.driver_lng, ride?.eta_seconds]);

  useEffect(() => {
    if (route?.leg?.version) routeVersion.current = route.leg.version;
  }, [route?.leg?.version]);

  useEffect(() => {
    if (ride?.delivery_fee_paid) setPayState("idle");
  }, [ride?.delivery_fee_paid]);

  const isLive = LIVE.includes(status);
  const beforePickup = status === "searching" || status === "accepted" || status === "going_to_shop";
  const pickup: Point | null = ride ? { latitude: Number(ride.pickup_lat), longitude: Number(ride.pickup_lng) } : null;
  const dropoff: Point | null = ride ? { latitude: Number(ride.dropoff_lat), longitude: Number(ride.dropoff_lng) } : null;
  const target = beforePickup ? pickup : dropoff;

  const tripLine = useMemo(() => (route?.trip?.polyline ? decodePolyline(route.trip.polyline) : null), [route?.trip?.polyline]);
  const legLine = useMemo(() => (isLive && route?.leg?.polyline ? decodePolyline(route.leg.polyline) : null), [isLive, route?.leg?.polyline]);

  // Frame the map once per leg (not on every update, so the customer can look around)
  const frame = () => {
    const pts = [isLive ? driver : null, target, beforePickup ? dropoff : null, ...(legLine || [])].filter(Boolean) as Point[];
    if (pts.length >= 2) {
      mapRef.current?.fitToCoordinates(pts, { edgePadding: { top: 90, right: 50, bottom: 50, left: 50 }, animated: true });
    }
  };
  const legKey = `${status}:${!!driver}:${!!legLine}`;
  useEffect(() => {
    if (!ride || framedLeg.current === legKey) return;
    framedLeg.current = legKey;
    setTimeout(frame, 400);
  }, [legKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const apiError = (e: any) => e?.response?.data?.error || e.message;

  const cancelMutation = useMutation({
    mutationFn: async () => { await api.delete(`/rides/${rideId}/cancel`); },
    onSuccess: () => refetch(),
    onError: (e: any) => Alert.alert("Can't cancel", apiError(e)),
  });

  const rateMutation = useMutation({
    mutationFn: async (rating: number) => { await api.post(`/rides/${rideId}/rate`, { rating }); },
    onSuccess: () => refetch(),
    onError: (e: any) => Alert.alert("Rating", apiError(e)),
  });

  const acceptCounter = useMutation({
    mutationFn: async (c: Counter) => { await api.post(`/rides/${rideId}/counters/${c.driverId}/accept`); },
    onSuccess: () => { refetch(); refetchRoute(); },
    onError: (e: any) => {
      Alert.alert("Couldn't confirm this driver", apiError(e));
      queryClient.invalidateQueries({ queryKey: countersKey });
      refetch();
    },
  });

  const rejectCounter = useMutation({
    mutationFn: async (c: Counter) => {
      queryClient.setQueryData<Counter[]>(countersKey, (old = []) => old.filter((o) => o.driverId !== c.driverId));
      await api.post(`/rides/${rideId}/counters/${c.driverId}/reject`);
    },
  });

  const raiseMutation = useMutation({
    mutationFn: async (fare: number) => { await api.put(`/rides/${rideId}/offer`, { fare }); },
    onSuccess: () => { setRaiseBy(0); refetch(); },
    onError: (e: any) => Alert.alert("Couldn't update your offer", apiError(e)),
  });

  const payMutation = useMutation({
    mutationFn: async () => { await api.post("/payment/delivery", { rideId, payerPhone: payPhone }); },
    onSuccess: () => setPayState("waiting"),
    onError: (e: any) => {
      if (e?.response?.data?.code === "payment_pending") {
        setPayState("waiting");
        Alert.alert("Check your phone", apiError(e));
        return;
      }
      setPayState("failed");
      Alert.alert("Payment", apiError(e));
    },
  });

  const callDriver = () => {
    if (ride?.driver_phone) Linking.openURL(`tel:${ride.driver_phone}`);
  };

  const openChat = async () => {
    if (!ride?.driver_user_id) return;
    try {
      const { data } = await api.post("/chat/conversations", {
        recipientId: ride.driver_user_id, type: "user_driver", rideId: ride.id, orderId: ride.order_id,
      });
      router.push(`/conversation/${data.conversationId}`);
    } catch (e: any) {
      Alert.alert("Chat", apiError(e));
    }
  };

  const confirmCancel = () =>
    Alert.alert("Cancel delivery?", "The driver search or the driver on the way will be stopped.", [
      { text: "Keep it", style: "cancel" },
      { text: "Cancel delivery", style: "destructive", onPress: () => cancelMutation.mutate() },
    ]);

  const confirmCounter = (c: Counter) =>
    Alert.alert(
      `Deliver with ${c.name}?`,
      `${formatMoney(c.fare)} · ${vehicleName(c.vehicle.type)}${c.pickupEtaMin ? ` · ~${c.pickupEtaMin} min from the shop` : ""}`,
      [{ text: "Not yet", style: "cancel" }, { text: `Accept ${formatMoney(c.fare)}`, onPress: () => acceptCounter.mutate(c) }]
    );

  if (isLoading) return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F8", alignItems: "center", justifyContent: "center" }}>
      <StatusBar style="dark" />
      <ActivityIndicator color="#EC7C2C" size="large" />
      <Text style={{ color: "#6B7280", marginTop: 16 }}>Loading tracking…</Text>
    </View>
  );

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === status);
  const eta = live?.etaSeconds != null ? formatEta(live.etaSeconds) : null;
  const left = live?.remainingMeters != null ? formatDistance(live.remainingMeters) : null;
  const etaLine =
    status === "accepted" && eta ? `Driver reaches the shop in ~${eta}${left ? ` · ${left}` : ""}` :
    (status === "picked_up" || status === "on_the_way") && eta ? `Arriving in ~${eta}${left ? ` · ${left}` : ""}` :
    null;

  const fare = Number(ride?.fare || 0);
  const myOffer = Number(ride?.offered_fare ?? ride?.fare ?? 0);
  const suggested = Number(ride?.suggested_fare ?? myOffer);
  const maxOffer = round100(suggested * 3);
  const paid = !!ride?.delivery_fee_paid;
  const method: "mobile" | "cash" = ride?.payment_method === "cash" ? "cash" : "mobile";
  const wantsMobile = payByMobile ?? method === "mobile";
  const message = STATUS_MESSAGES[status] || STATUS_MESSAGES.searching;

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F8" }}>
      <StatusBar style="dark" />

      {/* Map (top) */}
      <View style={{ height: status === "searching" ? "38%" : "46%" }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={{
            latitude:  dropoff?.latitude  || -6.7924,
            longitude: dropoff?.longitude || 39.2083,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          }}
          showsUserLocation
        >
          {/* Shop → you */}
          {beforePickup && (tripLine ? (
            <Polyline coordinates={tripLine} strokeColor="#2E3A7466" strokeWidth={4} />
          ) : pickup && dropoff ? (
            <Polyline coordinates={[pickup, dropoff]} strokeColor="#2E3A7466" strokeWidth={3} lineDashPattern={[6, 4]} />
          ) : null)}
          {/* Driver → next stop */}
          {legLine && legLine.length > 1 ? (
            <>
              <Polyline coordinates={legLine} strokeColor="#9A3F0A" strokeWidth={8} />
              <Polyline coordinates={legLine} strokeColor="#EC7C2C" strokeWidth={5} />
            </>
          ) : isLive && driver && target ? (
            <Polyline coordinates={[driver, target]} strokeColor="#EC7C2C" strokeWidth={3} lineDashPattern={[6, 4]} />
          ) : null}

          {pickup && (
            <Marker coordinate={pickup} title={ride?.shop_name || "Shop"} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={{ backgroundColor: "#16A34A", borderRadius: 20, padding: 8, borderWidth: 2, borderColor: "#fff" }}>
                <Ionicons name="storefront" size={18} color="#fff" />
              </View>
            </Marker>
          )}
          {dropoff && (
            <Marker coordinate={dropoff} title="You" anchor={{ x: 0.5, y: 0.5 }}>
              <View style={{ backgroundColor: "#EC7C2C", borderRadius: 20, padding: 8, borderWidth: 2, borderColor: "#fff" }}>
                <Ionicons name="home" size={18} color="#fff" />
              </View>
            </Marker>
          )}
          {isLive && driver && (
            <VehicleMarker coordinate={driver} heading={driver.heading} vehicleType={ride?.vehicle_type} title={ride?.driver_name || "Driver"} />
          )}
        </MapView>

        {/* Back button */}
        <TouchableOpacity onPress={() => router.back()}
          style={{ position: "absolute", top: insets.top + 12, left: 16, backgroundColor: "#FFFFFFEB", borderRadius: 14, padding: 10, borderWidth: 1, borderColor: "#E6E8EE" }}>
          <Ionicons name="arrow-back" size={22} color="#1B2036" />
        </TouchableOpacity>

        {/* Live badge + re-centre */}
        <View style={{ position: "absolute", top: insets.top + 12, right: 16, alignItems: "flex-end", gap: 8 }}>
          {isLive && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFFFFFEB", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#16A34A40" }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#16A34A" }} />
              <Text style={{ color: "#16A34A", fontSize: 12, fontWeight: "700" }}>LIVE</Text>
            </View>
          )}
          <TouchableOpacity onPress={frame} style={{ backgroundColor: "#FFFFFFEB", borderRadius: 14, padding: 10, borderWidth: 1, borderColor: "#E6E8EE" }}>
            <Ionicons name="scan-outline" size={20} color="#1B2036" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom panel */}
      <KeyboardAwareScrollView bottomOffset={40} keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}>
        {/* Status message + ETA */}
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#E6E8EE" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
            {status === "searching" ? <ActivityIndicator size="small" color="#EC7C2C" /> : <Ionicons name={message.icon} size={22} color={message.color} />}
            <Text style={{ color: "#1B2036", fontSize: 15, fontWeight: "800", flex: 1 }}>{message.text}</Text>
          </View>
          {!!etaLine && <Text style={{ color: "#EC7C2C", fontSize: 15, fontWeight: "800", marginBottom: 4 }}>{etaLine}</Text>}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
            <Image source={vehicleSideImage(ride?.vehicle_type)} style={{ width: 54, height: 36 }} contentFit="contain" />
            <Text style={{ color: "#6B7280", fontSize: 13, flex: 1 }}>
              {vehicleName(ride?.vehicle_type)} · {Number(ride?.distance_km || 0).toFixed(1)} km{"\n"}
              <Text style={{ color: "#1B2036", fontWeight: "800" }}>
                {status === "searching" ? `Your offer ${formatMoney(myOffer)}` : formatMoney(fare)}
              </Text>
              {" · "}{method === "cash" && !paid ? "Cash" : "Mobile money"}
            </Text>
          </View>
          {status === "searching" && (
            <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 10, lineHeight: 17 }}>
              {sortedCounters.length
                ? `${sortedCounters.length} driver${sortedCounters.length > 1 ? "s" : ""} sent a price — accept one below, or wait: a driver may still accept your offer.`
                : "Drivers can accept your offer or send their own price. We widen the search every 30 seconds."}
            </Text>
          )}
        </View>

        {/* Drivers' prices */}
        {status === "searching" && sortedCounters.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: "#1B2036", fontWeight: "800", fontSize: 16, marginBottom: 10 }}>Drivers' prices</Text>
            <View style={{ gap: 10 }}>
              {sortedCounters.map((c) => (
                <View key={c.driverId} style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#E6E8EE" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 64, alignItems: "center" }}>
                      {c.photo ? (
                        <Image source={{ uri: c.photo }} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#E6E8EE" }} />
                      ) : (
                        <Image source={vehicleSideImage(c.vehicle.type)} style={{ width: 64, height: 43 }} contentFit="contain" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#1B2036", fontWeight: "800", fontSize: 15 }} numberOfLines={1}>{c.name}</Text>
                      <Text style={{ color: "#6B7280", fontSize: 12 }} numberOfLines={1}>
                        {c.rating > 0 ? `★ ${c.rating.toFixed(1)} · ` : ""}{c.trips} trip{c.trips === 1 ? "" : "s"}
                      </Text>
                      {(c.pickupKm != null || c.pickupEtaMin != null) && (
                        <Text style={{ color: "#16A34A", fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
                          {[c.pickupEtaMin ? `~${c.pickupEtaMin} min away` : null, c.pickupKm != null ? `${c.pickupKm} km` : null].filter(Boolean).join(" · ")}
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ color: "#EC7C2C", fontWeight: "900", fontSize: 17 }}>{formatMoney(c.fare)}</Text>
                      <Text style={{ color: "#8A90A0", fontSize: 11 }}>
                        {c.fare > myOffer ? `+${(c.fare - myOffer).toLocaleString("en-US")} on your offer` : "below your offer"}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                    <TouchableOpacity onPress={() => rejectCounter.mutate(c)} disabled={acceptCounter.isPending}
                      style={{ flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center", borderWidth: 1, borderColor: "#E6E8EE" }}>
                      <Text style={{ color: "#6B7280", fontWeight: "700" }}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmCounter(c)} disabled={acceptCounter.isPending}
                      style={{ flex: 2, borderRadius: 12, paddingVertical: 11, alignItems: "center", backgroundColor: "#EC7C2C", opacity: acceptCounter.isPending ? 0.6 : 1 }}>
                      <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>
                        {acceptCounter.isPending && acceptCounter.variables?.driverId === c.driverId ? "Confirming…" : `Accept ${formatMoney(c.fare)}`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Raise the offer */}
        {status === "searching" && !paid && (
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#E6E8EE" }}>
            <Text style={{ color: "#1B2036", fontWeight: "800", fontSize: 15 }}>Want a driver sooner?</Text>
            <Text style={{ color: "#6B7280", fontSize: 12.5, marginTop: 2 }}>Raise your offer — every driver who has it sees the new price.</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              {RAISE_STEPS.map((step) => {
                const active = raiseBy === step;
                const tooHigh = myOffer + step > maxOffer;
                return (
                  <TouchableOpacity key={step} disabled={tooHigh} onPress={() => setRaiseBy(active ? 0 : step)}
                    style={{ flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center", borderWidth: 2, borderColor: active ? "#EC7C2C" : "#E6E8EE", backgroundColor: active ? "#EC7C2C12" : "#FFFFFF", opacity: tooHigh ? 0.4 : 1 }}>
                    <Text style={{ color: active ? "#EC7C2C" : "#1B2036", fontWeight: "800" }}>+{step.toLocaleString("en-US")}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {raiseBy > 0 && (
              <TouchableOpacity onPress={() => raiseMutation.mutate(myOffer + raiseBy)} disabled={raiseMutation.isPending}
                style={{ backgroundColor: "#2E3A74", borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 12, opacity: raiseMutation.isPending ? 0.7 : 1 }}>
                <Text style={{ color: "#fff", fontWeight: "800" }}>
                  {raiseMutation.isPending ? "Updating…" : `Offer ${formatMoney(myOffer + raiseBy)}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Driver card */}
        {ride?.driver_name && isLive && (
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 64, height: 52, borderRadius: 14, backgroundColor: "#F4F5F8", alignItems: "center", justifyContent: "center" }}>
              <Image source={vehicleSideImage(ride.vehicle_type)} style={{ width: 58, height: 39 }} contentFit="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#1B2036", fontWeight: "800", fontSize: 16 }}>{ride.driver_name}</Text>
              {!!ride.plate_number && (
                <Text style={{ color: "#6B7280", fontSize: 13 }}>
                  {ride.plate_number}{ride.vehicle_model ? ` · ${ride.vehicle_model}` : ""}{ride.vehicle_color ? ` · ${ride.vehicle_color}` : ""}
                </Text>
              )}
              {Number(ride.driver_rating_avg) > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Ionicons name="star" size={12} color="#E0950B" />
                  <Text style={{ color: "#6B7280", fontSize: 12 }}>{Number(ride.driver_rating_avg).toFixed(1)}</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {!!ride.driver_phone && (
                <TouchableOpacity onPress={callDriver} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#16A34A20", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#16A34A40" }}>
                  <Ionicons name="call" size={18} color="#16A34A" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={openChat} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#2563EB20", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#2563EB40" }}>
                <Ionicons name="chatbubble" size={18} color="#2563EB" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Paying for the delivery once the price is agreed */}
        {isLive && (
          paid ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#16A34A12", borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#16A34A33" }}>
              <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
              <Text style={{ color: "#166534", fontWeight: "700", flex: 1 }}>Delivery paid · {formatMoney(fare)}. Nothing to pay the driver.</Text>
            </View>
          ) : wantsMobile ? (
            <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#EC7C2C40" }}>
              <Text style={{ color: "#1B2036", fontWeight: "800", fontSize: 15 }}>Pay {formatMoney(fare)} for delivery</Text>
              <Text style={{ color: "#6B7280", fontSize: 12.5, marginTop: 2 }}>You and the driver agreed this price. Pay by mobile money now.</Text>
              <View style={{ backgroundColor: "#F4F5F8", borderWidth: 1, borderColor: "#E6E8EE", borderRadius: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", marginTop: 12 }}>
                <Text style={{ color: "#6B7280", marginRight: 8 }}>🇹🇿</Text>
                <TextInput value={payPhone} onChangeText={setPayPhone} placeholder="0712 345 678" placeholderTextColor="#A0A6B4" keyboardType="phone-pad"
                  editable={payState !== "waiting"} style={{ flex: 1, color: "#1B2036", fontSize: 15, paddingVertical: 12 }} />
                {!!detectProvider(payPhone) && <Text style={{ color: "#16A34A", fontSize: 12, fontWeight: "700" }}>{detectProvider(payPhone)}</Text>}
              </View>
              {payState === "waiting" ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 }}>
                  <ActivityIndicator color="#EC7C2C" />
                  <Text style={{ color: "#9A3F0A", fontSize: 13, flex: 1 }}>Approve the {formatMoney(fare)} prompt on your phone. This updates by itself.</Text>
                </View>
              ) : null}
              {payState === "failed" && (
                <Text style={{ color: "#DC2626", fontSize: 13, marginTop: 10 }}>The payment didn't go through. Try again, or pay the driver in cash.</Text>
              )}
              <TouchableOpacity
                onPress={() => payMutation.mutate()}
                disabled={payMutation.isPending || payPhone.replace(/\D/g, "").length < 9}
                style={{ backgroundColor: "#EC7C2C", borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 12, flexDirection: "row", justifyContent: "center", gap: 8, opacity: payMutation.isPending || payPhone.replace(/\D/g, "").length < 9 ? 0.6 : 1 }}>
                {payMutation.isPending ? <ActivityIndicator color="#fff" /> : <Ionicons name="phone-portrait" size={17} color="#fff" />}
                <Text style={{ color: "#fff", fontWeight: "800" }}>
                  {payState === "waiting" ? "Send the prompt again" : payState === "failed" ? "Try again" : `Pay ${formatMoney(fare)}`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPayByMobile(false)} style={{ alignItems: "center", marginTop: 10 }}>
                <Text style={{ color: "#2E3A74", fontWeight: "700", fontSize: 13 }}>Pay the driver in cash instead</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#E6E8EE" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons name="cash-outline" size={22} color="#16A34A" />
                <Text style={{ color: "#1B2036", fontWeight: "800", fontSize: 15, flex: 1 }}>Pay {formatMoney(fare)} in cash</Text>
              </View>
              <Text style={{ color: "#6B7280", fontSize: 12.5, marginTop: 4 }}>Give the driver the agreed price when your order arrives.</Text>
              <TouchableOpacity onPress={() => setPayByMobile(true)} style={{ marginTop: 10 }}>
                <Text style={{ color: "#2E3A74", fontWeight: "700", fontSize: 13 }}>Pay by mobile money instead</Text>
              </TouchableOpacity>
            </View>
          )
        )}

        {/* Progress steps */}
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          {STATUS_STEPS.map((step, idx) => {
            const done    = currentStepIndex > idx;
            const current = currentStepIndex === idx;
            return (
              <View key={step.key} style={{ flexDirection: "row", alignItems: "center", marginBottom: idx < STATUS_STEPS.length - 1 ? 16 : 0 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: done ? "#16A34A" : current ? "#EC7C2C" : "#E6E8EE", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  {done ? (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  ) : (
                    <Ionicons name={step.icon as any} size={16} color={current ? "#fff" : "#8A90A0"} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: done || current ? "#1B2036" : "#8A90A0", fontWeight: current ? "800" : "500", fontSize: 14 }}>{step.label}</Text>
                </View>
                {current && isLive && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#EC7C2C" }} />}
              </View>
            );
          })}
        </View>

        {/* Rate the driver */}
        {status === "delivered" && (
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, alignItems: "center" }}>
            {ride?.driver_rating ? (
              <Text style={{ color: "#16A34A", fontWeight: "700" }}>Thanks for rating your driver!</Text>
            ) : (
              <>
                <Text style={{ color: "#1B2036", fontWeight: "800", fontSize: 15, marginBottom: 10 }}>How was your delivery{ride?.driver_name ? ` with ${ride.driver_name}` : ""}?</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity key={n} onPress={() => setStars(n)}>
                      <Ionicons name={n <= stars ? "star" : "star-outline"} size={34} color="#E0950B" />
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={() => stars && rateMutation.mutate(stars)} disabled={!stars || rateMutation.isPending}
                  style={{ backgroundColor: stars ? "#2E3A74" : "#A0A6B4", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 28 }}>
                  <Text style={{ color: "#fff", fontWeight: "800" }}>{rateMutation.isPending ? "Sending…" : "Rate driver"}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {CANCELLABLE.includes(status) && (
          <TouchableOpacity onPress={confirmCancel} disabled={cancelMutation.isPending}
            style={{ borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "#DC262640", marginBottom: 10 }}>
            <Text style={{ color: "#DC2626", fontWeight: "700" }}>{cancelMutation.isPending ? "Cancelling…" : "Cancel delivery"}</Text>
          </TouchableOpacity>
        )}
        {status === "no_driver" && !!ride?.order_id && (
          <TouchableOpacity onPress={() => router.replace({ pathname: "/ride/request", params: { orderId: ride.order_id } })}
            style={{ backgroundColor: "#2E3A74", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginBottom: 10 }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Try again</Text>
          </TouchableOpacity>
        )}
        {["delivered", "cancelled", "no_driver"].includes(status) && (
          <TouchableOpacity onPress={() => router.replace("/(tabs)")}
            style={{ backgroundColor: "#FFFFFF", borderRadius: 14, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: "#E6E8EE" }}>
            <Text style={{ color: "#6B7280", fontWeight: "700" }}>Back to Home</Text>
          </TouchableOpacity>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}
