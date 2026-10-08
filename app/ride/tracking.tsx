import { useApi } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { getStatusColor, vehicleEmoji, formatMoney } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert, ScrollView } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const STATUS_STEPS = [
  { key: "searching",    label: "Finding driver",        icon: "search-outline" },
  { key: "accepted",     label: "Driver accepted",       icon: "checkmark-circle-outline" },
  { key: "going_to_shop",label: "Driver to pickup",      icon: "storefront-outline" },
  { key: "picked_up",    label: "Order collected",       icon: "cube-outline" },
  { key: "on_the_way",   label: "On the way",            icon: "navigate-outline" },
  { key: "delivered",    label: "Delivered!",            icon: "gift-outline" },
];

const STATUS_MESSAGES: Record<string, string> = {
  searching:     "🔍 Looking for a nearby driver…",
  accepted:      "✅ Driver found and accepted your ride!",
  going_to_shop: "🏃 Driver is heading to the pickup location.",
  picked_up:     "📦 Driver has collected your order!",
  on_the_way:    "🚗 Your order is on the way to you!",
  delivered:     "🎉 Your order has been delivered!",
  cancelled:     "❌ Delivery was cancelled.",
  no_driver:     "😔 No driver found. Please try again.",
};

export default function TrackingScreen() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const api     = useApi();
  const insets  = useSafeAreaInsets();
  const mapRef  = useRef<MapView>(null);

  const [driverLat, setDriverLat] = useState<number | null>(null);
  const [driverLng, setDriverLng] = useState<number | null>(null);
  const [driverHeading, setDriverHeading] = useState(0);

  const { data: rideData, isLoading } = useQuery({
    queryKey: ["ride", rideId],
    queryFn: async () => {
      const { data } = await api.get(`/rides/${rideId}`);
      return data.ride;
    },
    enabled: !!rideId,
    refetchInterval: 8_000,
  });

  const ride = rideData;

  // Socket.io live driver location
  useEffect(() => {
    if (!rideId) return;
    let socket: any;
    getSocket().then((s) => {
      socket = s;
      s.emit("track:join", { rideId });
      s.on("driver:location_update", (payload: any) => {
        if (payload.rideId === rideId) {
          setDriverLat(payload.lat);
          setDriverLng(payload.lng);
          setDriverHeading(payload.heading || 0);
          mapRef.current?.animateToRegion({ latitude: payload.lat, longitude: payload.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 800);
        }
      });
    });
    return () => {
      if (socket) {
        socket.emit("track:leave", { rideId });
        socket.off("driver:location_update");
      }
    };
  }, [rideId]);

  // Update driver location from API data too
  useEffect(() => {
    if (ride?.driver_lat) setDriverLat(ride.driver_lat);
    if (ride?.driver_lng) setDriverLng(ride.driver_lng);
  }, [ride?.driver_lat, ride?.driver_lng]);

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === ride?.status);
  const isTerminal = ["delivered","cancelled","no_driver"].includes(ride?.status || "");
  const isLive     = ["accepted","going_to_shop","picked_up","on_the_way"].includes(ride?.status || "");

  const callDriver = () => {
    if (ride?.driver_phone) Linking.openURL(`tel:${ride.driver_phone}`);
  };

  const openChat = () => {
    Alert.alert("Chat", "Start chat with driver?", [
      { text: "Cancel", style: "cancel" },
      { text: "Open Chat", onPress: () => router.push("/conversation/driver") },
    ]);
  };

  const initialRegion = {
    latitude:      ride?.dropoff_lat  || -6.7924,
    longitude:     ride?.dropoff_lng  || 39.2083,
    latitudeDelta:  0.03,
    longitudeDelta: 0.03,
  };

  if (isLoading) return (
    <View style={{ flex: 1, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center" }}>
      <StatusBar style="light" />
      <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 4, borderColor: "#F97316", borderTopColor: "transparent" }} />
      <Text style={{ color: "#94A3B8", marginTop: 16 }}>Loading tracking…</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <StatusBar style="light" />

      {/* Map (top half) */}
      <View style={{ height: "50%" }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={initialRegion}
          showsUserLocation
        >
          {/* Pickup */}
          {ride?.pickup_lat && ride?.pickup_lng && (
            <Marker coordinate={{ latitude: ride.pickup_lat, longitude: ride.pickup_lng }} title="Pickup">
              <View style={{ backgroundColor: "#22C55E", borderRadius: 20, padding: 8 }}>
                <Ionicons name="storefront" size={18} color="#fff" />
              </View>
            </Marker>
          )}
          {/* Dropoff */}
          {ride?.dropoff_lat && ride?.dropoff_lng && (
            <Marker coordinate={{ latitude: ride.dropoff_lat, longitude: ride.dropoff_lng }} title="Your location">
              <View style={{ backgroundColor: "#F97316", borderRadius: 20, padding: 8 }}>
                <Ionicons name="home" size={18} color="#fff" />
              </View>
            </Marker>
          )}
          {/* Live driver */}
          {driverLat && driverLng && (
            <Marker coordinate={{ latitude: driverLat, longitude: driverLng }} title="Driver">
              <View style={{ backgroundColor: "#0F172A", borderRadius: 24, padding: 10, borderWidth: 2, borderColor: "#F97316" }}>
                <Text style={{ fontSize: 20 }}>{vehicleEmoji(ride?.vehicle_type)}</Text>
              </View>
            </Marker>
          )}
          {/* Route line */}
          {ride?.pickup_lat && ride?.dropoff_lat && (
            <Polyline
              coordinates={[
                { latitude: ride.pickup_lat,  longitude: ride.pickup_lng  },
                ...(driverLat ? [{ latitude: driverLat, longitude: driverLng! }] : []),
                { latitude: ride.dropoff_lat, longitude: ride.dropoff_lng },
              ]}
              strokeColor="#F97316"
              strokeWidth={3}
              lineDashPattern={[6, 4]}
            />
          )}
        </MapView>

        {/* Back button */}
        <TouchableOpacity onPress={() => router.back()}
          style={{ position: "absolute", top: insets.top + 12, left: 16, backgroundColor: "#0F172AE0", borderRadius: 14, padding: 10, borderWidth: 1, borderColor: "#334155" }}>
          <Ionicons name="arrow-back" size={22} color="#F8FAFC" />
        </TouchableOpacity>

        {/* Live badge */}
        {isLive && (
          <View style={{ position: "absolute", top: insets.top + 12, right: 16, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#0F172AE0", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#22C55E40" }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" }} />
            <Text style={{ color: "#22C55E", fontSize: 12, fontWeight: "700" }}>LIVE</Text>
          </View>
        )}
      </View>

      {/* Bottom panel */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}>
        {/* Status message */}
        <View style={{ backgroundColor: "#1E293B", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#334155" }}>
          <Text style={{ color: "#F8FAFC", fontSize: 15, fontWeight: "700", marginBottom: 4 }}>
            {STATUS_MESSAGES[ride?.status || "searching"]}
          </Text>
          <Text style={{ color: "#64748B", fontSize: 13 }}>{vehicleEmoji(ride?.vehicle_type)} {ride?.vehicle_type} · {ride?.distance_km} km · {formatMoney(ride?.fare)}</Text>
        </View>

        {/* Progress steps */}
        <View style={{ backgroundColor: "#1E293B", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          {STATUS_STEPS.map((step, idx) => {
            const done    = currentStepIndex > idx;
            const current = currentStepIndex === idx;
            return (
              <View key={step.key} style={{ flexDirection: "row", alignItems: "center", marginBottom: idx < STATUS_STEPS.length - 1 ? 16 : 0 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: done ? "#22C55E" : current ? "#F97316" : "#334155", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  {done ? (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  ) : (
                    <Ionicons name={step.icon as any} size={16} color={current ? "#fff" : "#64748B"} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: done || current ? "#F8FAFC" : "#64748B", fontWeight: current ? "800" : "500", fontSize: 14 }}>{step.label}</Text>
                </View>
                {current && isLive && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#F97316" }} />}
              </View>
            );
          })}
        </View>

        {/* Driver card */}
        {ride?.driver_name && (
          <View style={{ backgroundColor: "#1E293B", borderRadius: 16, padding: 16, marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#334155", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 22 }}>{vehicleEmoji(ride.vehicle_type)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "800", fontSize: 16 }}>{ride.driver_name}</Text>
              {ride.plate_number && <Text style={{ color: "#94A3B8", fontSize: 13 }}>{ride.plate_number}</Text>}
              {ride.driver_rating_avg && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Text style={{ color: "#F59E0B" }}>★</Text>
                  <Text style={{ color: "#94A3B8", fontSize: 12 }}>{ride.driver_rating_avg}</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {ride.driver_phone && (
                <TouchableOpacity onPress={callDriver} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#22C55E20", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#22C55E40" }}>
                  <Ionicons name="call" size={18} color="#22C55E" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={openChat} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#3B82F620", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#3B82F640" }}>
                <Ionicons name="chatbubble" size={18} color="#3B82F6" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Delivered CTA */}
        {ride?.status === "delivered" && (
          <View style={{ gap: 10 }}>
            <TouchableOpacity onPress={() => router.push({ pathname: `/ride/${rideId}/rate` as any })}
              style={{ backgroundColor: "#F97316", borderRadius: 14, paddingVertical: 16, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>⭐ Rate your driver</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.replace("/(tabs)")}
              style={{ backgroundColor: "#1E293B", borderRadius: 14, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: "#334155" }}>
              <Text style={{ color: "#94A3B8", fontWeight: "700" }}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        )}
        {(ride?.status === "cancelled" || ride?.status === "no_driver") && (
          <View style={{ gap: 10 }}>
            <TouchableOpacity onPress={() => router.replace("/(tabs)")}
              style={{ backgroundColor: "#1E293B", borderRadius: 14, paddingVertical: 16, alignItems: "center" }}>
              <Text style={{ color: "#94A3B8", fontWeight: "700" }}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
