import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, Keyboard, Modal, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import MapView, { PROVIDER_GOOGLE, Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  addressFor, currentPosition, DEFAULT_CENTER, getPlace, LatLng, newSessionToken,
  PickedPlace, PlacePrediction, searchPlaces,
} from "@/lib/maps";

interface Props {
  visible: boolean;
  title: string;
  hint?: string;
  initial?: LatLng | null;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (place: PickedPlace) => void;
}

const near = (a: LatLng, b: LatLng) =>
  Math.abs(a.latitude - b.latitude) < 0.0002 && Math.abs(a.longitude - b.longitude) < 0.0002;

// Pick a point by moving the map under the pin, searching an address, or using GPS
export default function LocationPickerModal({ visible, title, hint, initial, confirmLabel = "Confirm location", onClose, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [center, setCenter] = useState<LatLng>(initial || DEFAULT_CENTER);
  const [address, setAddress] = useState("");
  const [resolving, setResolving] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const session = useRef(newSessionToken());
  const chosen = useRef<PickedPlace | null>(null);
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const moveTo = (p: LatLng) => {
    mapRef.current?.animateToRegion({ ...p, latitudeDelta: 0.006, longitudeDelta: 0.006 }, 500);
  };

  // Fresh state each time the picker opens; start from GPS when there is no starting point
  useEffect(() => {
    if (!visible) return;
    session.current = newSessionToken();
    chosen.current = null;
    setQuery("");
    setResults([]);
    const start = initial || null;
    if (start) {
      setCenter(start);
      resolve(start);
    } else {
      goToMyLocation();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolve = (p: LatLng) => {
    if (geoTimer.current) clearTimeout(geoTimer.current);
    if (chosen.current && near(chosen.current, p)) {
      setAddress(chosen.current.address);
      return;
    }
    setResolving(true);
    geoTimer.current = setTimeout(async () => {
      const a = await addressFor(p);
      setAddress(a);
      setResolving(false);
    }, 450);
  };

  const onRegionChangeComplete = (r: Region) => {
    const p = { latitude: r.latitude, longitude: r.longitude };
    setCenter(p);
    resolve(p);
  };

  const goToMyLocation = async () => {
    setLocating(true);
    const here = await currentPosition();
    setLocating(false);
    if (here) {
      chosen.current = null;
      moveTo(here);
    }
  };

  const onQuery = (text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      setResults(await searchPlaces(text, center, session.current));
      setSearching(false);
    }, 300);
  };

  const pick = async (p: PlacePrediction) => {
    Keyboard.dismiss();
    setResults([]);
    setQuery(p.mainText);
    const place = await getPlace(p.placeId, session.current);
    session.current = newSessionToken(); // a session ends with the details lookup
    if (!place) return;
    chosen.current = { ...place, address: place.address || p.description };
    setAddress(chosen.current.address);
    moveTo(place);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#F4F5F8" }}>
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={{ ...(initial || DEFAULT_CENTER), latitudeDelta: 0.01, longitudeDelta: 0.01 }}
            onRegionChangeComplete={onRegionChangeComplete}
            showsUserLocation
            showsMyLocationButton={false}
          />
          {/* The point under the pin's tip (the map centre) is the one picked */}
          <View pointerEvents="none" style={{ position: "absolute", top: "50%", left: "50%", marginLeft: -22, marginTop: -42 }}>
            <Ionicons name="location" size={44} color="#EC7C2C" />
          </View>
        </View>

        {/* Header + search */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TouchableOpacity onPress={onClose} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E6E8EE" }}>
              <Ionicons name="close" size={22} color="#1B2036" />
            </TouchableOpacity>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: "#E6E8EE" }}>
              <Ionicons name="search" size={18} color="#8A90A0" />
              <TextInput
                value={query}
                onChangeText={onQuery}
                placeholder="Search street, area or place"
                placeholderTextColor="#A0A6B4"
                style={{ flex: 1, color: "#1B2036", fontSize: 15, paddingVertical: 12, paddingHorizontal: 8 }}
                returnKeyType="search"
              />
              {searching && <ActivityIndicator size="small" color="#EC7C2C" />}
            </View>
          </View>
          {results.length > 0 && (
            <View style={{ backgroundColor: "#FFFFFF", borderRadius: 14, marginTop: 8, borderWidth: 1, borderColor: "#E6E8EE", maxHeight: 280 }}>
              <FlatList
                data={results}
                keyExtractor={(p) => p.placeId}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => pick(item)} style={{ flexDirection: "row", gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: "#F1F2F6" }}>
                    <Ionicons name="location-outline" size={18} color="#2E3A74" style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#1B2036", fontWeight: "700" }} numberOfLines={1}>{item.mainText}</Text>
                      {!!item.secondaryText && <Text style={{ color: "#8A90A0", fontSize: 12 }} numberOfLines={1}>{item.secondaryText}</Text>}
                    </View>
                    {item.distanceMeters != null && (
                      <Text style={{ color: "#8A90A0", fontSize: 12 }}>{(item.distanceMeters / 1000).toFixed(1)} km</Text>
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>

        {/* Bottom card */}
        <View style={{ backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: insets.bottom + 20, borderTopWidth: 1, borderColor: "#E6E8EE" }}>
          <TouchableOpacity onPress={goToMyLocation} disabled={locating}
            style={{ position: "absolute", top: -60, right: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E6E8EE" }}>
            {locating ? <ActivityIndicator color="#EC7C2C" /> : <Ionicons name="locate" size={22} color="#2E3A74" />}
          </TouchableOpacity>
          <Text style={{ color: "#1B2036", fontSize: 17, fontWeight: "800" }}>{title}</Text>
          {!!hint && <Text style={{ color: "#8A90A0", fontSize: 12, marginTop: 2 }}>{hint}</Text>}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F4F5F8", borderRadius: 13, padding: 12, marginTop: 12 }}>
            <Ionicons name="location" size={18} color="#EC7C2C" />
            <Text style={{ flex: 1, color: "#1B2036", fontSize: 14 }} numberOfLines={2}>
              {resolving ? "Finding address…" : address || "Move the map to place the pin"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onConfirm({ ...center, address: address || `${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}` })}
            disabled={resolving}
            style={{ backgroundColor: "#2E3A74", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 14, opacity: resolving ? 0.7 : 1 }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
