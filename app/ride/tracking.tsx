import { useApi } from "@/lib/api";
import { subscribe } from "@/lib/socket";
import { vehicleEmoji, formatMoney } from "@/lib/utils";
import { decodePolyline, formatDistance, formatEta } from "@/lib/maps";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Linking, Alert, ScrollView, ActivityIndicator } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const STATUS_STEPS = [
  { key: "searching",    label: "Finding a driver near the shop", icon: "search-outline" },
  { key: "accepted",     label: "Driver on the way to the shop",  icon: "bicycle-outline" },
  { key: "going_to_shop",label: "Driver at the shop",             icon: "storefront-outline" },
  { key: "picked_up",    label: "Order collected",                icon: "cube-outline" },
  { key: "on_the_way",   label: "On the way to you",              icon: "navigate-outline" },
  { key: "delivered",    label: "Delivered!",                     icon: "gift-outline" },
];

const STATUS_MESSAGES: Record<string, string> = {
  searching:     "🔍 Offering your delivery to the drivers nearest the shop…",
  accepted:      "🛵 Your driver is heading to the shop.",
  going_to_shop: "🏪 Your driver is at the shop collecting your order.",
  picked_up:     "📦 Your driver has your order!",
  on_the_way:    "🚗 Your order is on the way to you!",
  delivered:     "🎉 Your order has been delivered!",
  cancelled:     "❌ Delivery was cancelled.",
  no_driver:     "😔 No driver was free near the shop. Please try again.",
};

const LIVE = ["accepted", "going_to_shop", "picked_up", "on_the_way"];
const CANCELLABLE = ["searching", "accepted", "going_to_shop"];

type Point = { latitude: number; longitude: number };

export default function TrackingScreen() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const api     = useApi();
  const insets  = useSafeAreaInsets();
  const mapRef  = useRef<MapView>(null);

  const [driver, setDriver] = useState<(Point & { heading: number }) | null>(null);
  const [live, setLive] = useState<{ etaSeconds: number | null; remainingMeters: number | null } | null>(null);
  const [stars, setStars] = useState(0);
  const routeVersion = useRef<number | null>(null);
  const framedLeg = useRef<string | null>(null);

  const { data: ride, isLoading, refetch } = useQuery({
    queryKey: ["ride", rideId],
    queryFn: async () => {
      const { data } = await api.get(`/rides/${rideId}`);
      return data.ride;
    },
    enabled: !!rideId,
    refetchInterval: (q) => (["delivered", "cancelled", "no_driver"].includes(q.state.data?.status) ? false : 15_000),
  });

  const { data: route, refetch: refetchRoute } = useQuery({
    queryKey: ["ride-route", rideId],
    queryFn: async () => {
      const { data } = await api.get(`/rides/${rideId}/route`);
      return data;
    },
    enabled: !!rideId,
    refetchInterval: (q) => (LIVE.includes(q.state.data?.status) ? 30_000 : false),
  });

  // Live position + ETA after every driver GPS fix; status changes the moment they happen
  useEffect(() => {
    if (!rideId) return;
    const offLocation = subscribe("driver:location_update", (p: any) => {
      if (p.rideId !== rideId) return;
      setDriver({ latitude: p.lat, longitude: p.lng, heading: p.heading || 0 });
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
    return () => {
      offLocation();
      offStatus();
    };
  }, [rideId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Same data from the API (first load, and if the socket is down)
  useEffect(() => {
    if (ride?.driver_lat && ride?.driver_lng) {
      setDriver({ latitude: Number(ride.driver_lat), longitude: Number(ride.driver_lng), heading: Number(ride.driver_heading) || 0 });
    }
    if (ride?.eta_seconds != null) setLive({ etaSeconds: ride.eta_seconds, remainingMeters: ride.remaining_meters ?? null });
  }, [ride?.driver_lat, ride?.driver_lng, ride?.eta_seconds]);

  useEffect(() => {
    if (route?.leg?.version) routeVersion.current = route.leg.version;
  }, [route?.leg?.version]);

  const status: string = ride?.status || "searching";
  const isLive = LIVE.includes(status);
  const beforePickup = status === "searching" || status === "accepted" || status === "going_to_shop";
  const pickup: Point | null = ride ? { latitude: Number(ride.pickup_lat), longitude: Number(ride.pickup_lng) } : null;
  const dropoff: Point | null = ride ? { latitude: Number(ride.dropoff_lat), longitude: Number(ride.dropoff_lng) } : null;
  const target = beforePickup ? pickup : dropoff;

  const tripLine = useMemo(() => (route?.trip?.polyline ? decodePolyline(route.trip.polyline) : null), [route?.trip?.polyline]);
  const legLine = useMemo(() => (isLive && route?.leg?.polyline ? decodePolyline(route.leg.polyline) : null), [isLive, route?.leg?.polyline]);

  // Frame the map once per leg (not on every update, so the customer can look around)
  const frame = () => {
    const pts = [driver, target, beforePickup ? dropoff : null, ...(legLine || [])].filter(Boolean) as Point[];
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

  const cancelMutation = useMutation({
    mutationFn: async () => { await api.delete(`/rides/${rideId}/cancel`); },
    onSuccess: () => refetch(),
    onError: (e: any) => Alert.alert("Can't cancel", e?.response?.data?.error || e.message),
  });

  const rateMutation = useMutation({
    mutationFn: async (rating: number) => { await api.post(`/rides/${rideId}/rate`, { rating }); },
    onSuccess: () => refetch(),
    onError: (e: any) => Alert.alert("Rating", e?.response?.data?.error || e.message),
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
      Alert.alert("Chat", e?.response?.data?.error || "Could not open the chat");
    }
  };

  const confirmCancel = () =>
    Alert.alert("Cancel delivery?", "The driver search or the driver on the way will be stopped.", [
      { text: "Keep it", style: "cancel" },
      { text: "Cancel delivery", style: "destructive", onPress: () => cancelMutation.mutate() },
    ]);

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

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F8" }}>
      <StatusBar style="dark" />

      {/* Map (top half) */}
      <View style={{ height: "50%" }}>
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
            <Polyline coordinates={legLine} strokeColor="#EC7C2C" strokeWidth={5} />
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
            <Marker coordinate={driver} title={ride?.driver_name || "Driver"} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={{ backgroundColor: "#FFFFFF", borderRadius: 24, padding: 8, borderWidth: 2, borderColor: "#EC7C2C" }}>
                <Text style={{ fontSize: 20 }}>{vehicleEmoji(ride?.vehicle_type)}</Text>
              </View>
            </Marker>
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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}>
        {/* Status message + ETA */}
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#E6E8EE" }}>
          <Text style={{ color: "#1B2036", fontSize: 15, fontWeight: "700", marginBottom: 4 }}>
            {STATUS_MESSAGES[status] || STATUS_MESSAGES.searching}
          </Text>
          {!!etaLine && <Text style={{ color: "#EC7C2C", fontSize: 15, fontWeight: "800", marginBottom: 4 }}>{etaLine}</Text>}
          <Text style={{ color: "#8A90A0", fontSize: 13 }}>
            {vehicleEmoji(ride?.vehicle_type)} {ride?.vehicle_type} · {Number(ride?.distance_km || 0).toFixed(1)} km · {formatMoney(ride?.fare)}
          </Text>
          {status === "searching" && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
              <ActivityIndicator size="small" color="#EC7C2C" />
              <Text style={{ color: "#6B7280", fontSize: 12, flex: 1 }}>Closest drivers get it first; we widen the search every 30 seconds.</Text>
            </View>
          )}
        </View>

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

        {/* Driver card */}
        {ride?.driver_name && isLive && (
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#E6E8EE", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 22 }}>{vehicleEmoji(ride.vehicle_type)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#1B2036", fontWeight: "800", fontSize: 16 }}>{ride.driver_name}</Text>
              {!!ride.plate_number && <Text style={{ color: "#6B7280", fontSize: 13 }}>{ride.plate_number}{ride.vehicle_color ? ` · ${ride.vehicle_color}` : ""}</Text>}
              {Number(ride.driver_rating_avg) > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Text style={{ color: "#E0950B" }}>★</Text>
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
      </ScrollView>
    </View>
  );
}
