/**
 * OneDelivery — maps helpers
 * ──────────────────────────
 * The map itself is react-native-maps (Google Maps SDK, key EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY
 * set at build time). Address search, routes and live tracking go through the OneDelivery
 * server (Google Routes API, Places API (New) and Geocoding there), so the app ships no
 * Google web-service key.
 */
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import api from "@/lib/api";

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  distanceMeters: number | null;
}

export interface PickedPlace {
  latitude: number;
  longitude: number;
  address: string;
}

// Dar es Salaam city centre
export const DEFAULT_CENTER: LatLng = { latitude: -6.7924, longitude: 39.2083 };

async function authHeaders() {
  const token = await SecureStore.getItemAsync("od_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// A token per search: the keystrokes and the chosen result are billed as one session
export function newSessionToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function searchPlaces(input: string, near: LatLng | null, sessionToken: string): Promise<PlacePrediction[]> {
  if (!input || input.trim().length < 2) return [];
  try {
    const { data } = await api.get("/maps/autocomplete", {
      params: { input, session: sessionToken, ...(near ? { lat: near.latitude, lng: near.longitude } : {}) },
      headers: await authHeaders(),
    });
    return data.predictions || [];
  } catch {
    return [];
  }
}

export async function getPlace(placeId: string, sessionToken: string): Promise<PickedPlace | null> {
  try {
    const { data } = await api.get(`/maps/place/${encodeURIComponent(placeId)}`, {
      params: { session: sessionToken },
      headers: await authHeaders(),
    });
    const p = data.place;
    return p ? { latitude: p.lat, longitude: p.lng, address: p.address } : null;
  } catch {
    return null;
  }
}

// Street address for a point: the phone's own geocoder first (free), the server second
export async function addressFor(point: LatLng): Promise<string> {
  try {
    const [g] = await Location.reverseGeocodeAsync(point);
    const line = g && [g.name && g.name !== g.street ? g.name : null, g.street, g.district || g.subregion, g.city].filter(Boolean).join(", ");
    if (line) return line;
  } catch { /* fall through to the server */ }
  try {
    const { data } = await api.get("/maps/reverse", {
      params: { lat: point.latitude, lng: point.longitude },
      headers: await authHeaders(),
    });
    if (data.address) return data.address;
  } catch { /* use coordinates */ }
  return `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
}

// The phone's position, or null without permission / a fix
export async function currentPosition(): Promise<LatLng | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  } catch {
    return null;
  }
}

/**
 * Decode a Google encoded polyline string to an array of LatLng.
 */
export function decodePolyline(encoded: string): LatLng[] {
  const coords: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0, result = 0, b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0; result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return coords;
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.max(10, Math.round(meters / 10) * 10)} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function formatEta(seconds: number): string {
  const min = Math.max(1, Math.round(seconds / 60));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}
