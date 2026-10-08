/**
 * OneDelivery — Google Maps Utilities
 * ─────────────────────────────────────
 * Uses:
 *  • react-native-maps with Google Maps provider (Android) and Apple Maps (iOS)
 *  • Google Places API for address autocomplete
 *  • Google Directions API for route polylines
 *
 * API keys are loaded from .env:
 *   EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY
 *   EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY
 *
 * Keys are also configured in app.json → ios.config.googleMapsApiKey
 * and android.config.googleMaps.apiKey  (used by the native Maps SDK)
 */

import { Platform } from "react-native";

// Active Maps API key (for REST calls — Places, Directions)
const MAPS_KEY =
  Platform.OS === "ios"
    ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY
    : process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  formattedAddress: string;
  location: LatLng;
}

export interface Route {
  polylineEncoded: string;
  distanceMeters: number;
  durationSeconds: number;
  distanceText: string;
  durationText: string;
}

// ── Places Autocomplete ───────────────────────────────────────────────────────
/**
 * Search for places by text query, biased to Tanzania.
 * Returns place predictions for address autocomplete UI.
 */
export async function searchPlaces(query: string, sessionToken?: string): Promise<PlacePrediction[]> {
  if (!query || query.length < 2) return [];
  if (!MAPS_KEY) {
    console.warn("Google Maps API key not set. Add EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY or EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY to .env");
    return [];
  }

  const params = new URLSearchParams({
    input: query,
    key: MAPS_KEY,
    language: "en",
    components: "country:tz",           // restrict to Tanzania
    location: "-6.7924,39.2083",        // bias to Dar es Salaam
    radius: "50000",
    ...(sessionToken ? { sessiontoken: sessionToken } : {}),
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("Places autocomplete error:", data.status, data.error_message);
      return [];
    }

    return (data.predictions || []).map((p: any) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text || p.description,
      secondaryText: p.structured_formatting?.secondary_text || "",
    }));
  } catch (err) {
    console.error("searchPlaces error:", err);
    return [];
  }
}

// ── Place Details ─────────────────────────────────────────────────────────────
/**
 * Get full details (including lat/lng) for a place by its ID.
 */
export async function getPlaceDetails(placeId: string, sessionToken?: string): Promise<PlaceDetails | null> {
  if (!MAPS_KEY) return null;

  const params = new URLSearchParams({
    place_id: placeId,
    key: MAPS_KEY,
    fields: "place_id,name,formatted_address,geometry",
    ...(sessionToken ? { sessiontoken: sessionToken } : {}),
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();

    if (data.status !== "OK") {
      console.error("Place details error:", data.status);
      return null;
    }

    const result = data.result;
    return {
      placeId: result.place_id,
      name: result.name,
      formattedAddress: result.formatted_address,
      location: {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
      },
    };
  } catch (err) {
    console.error("getPlaceDetails error:", err);
    return null;
  }
}

// ── Directions / Route ────────────────────────────────────────────────────────
/**
 * Get a route between two points using Google Directions API.
 * Returns an encoded polyline for drawing on MapView.
 */
export async function getRoute(origin: LatLng, destination: LatLng): Promise<Route | null> {
  if (!MAPS_KEY) return null;

  const params = new URLSearchParams({
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    key: MAPS_KEY,
    mode: "driving",
    region: "tz",
    language: "en",
    units: "metric",
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json();

    if (data.status !== "OK" || !data.routes?.length) {
      console.error("Directions error:", data.status);
      return null;
    }

    const route = data.routes[0];
    const leg = route.legs[0];
    return {
      polylineEncoded: route.overview_polyline.points,
      distanceMeters: leg.distance.value,
      durationSeconds: leg.duration.value,
      distanceText: leg.distance.text,
      durationText: leg.duration.text,
    };
  } catch (err) {
    console.error("getRoute error:", err);
    return null;
  }
}

// ── Reverse Geocoding ─────────────────────────────────────────────────────────
/**
 * Convert lat/lng to a human-readable address string.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  if (!MAPS_KEY) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_KEY}&language=en&region=tz`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();

    if (data.status === "OK" && data.results?.length) {
      return data.results[0].formatted_address;
    }
  } catch {}

  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

// ── Decode Polyline ───────────────────────────────────────────────────────────
/**
 * Decode a Google encoded polyline string to an array of LatLng.
 * Use this to draw Polyline on MapView.
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

// ── Map Provider ──────────────────────────────────────────────────────────────
/**
 * Use Google Maps on Android, default (Apple Maps) on iOS.
 * react-native-maps PROVIDER_GOOGLE on iOS also works if you set the iOS key.
 */
export { PROVIDER_GOOGLE, PROVIDER_DEFAULT } from "react-native-maps";

export const MAP_PROVIDER = Platform.OS === "android" ? "google" : "default";

// ── Dark Map Style ────────────────────────────────────────────────────────────
// Custom dark style matching OneDelivery's #0F172A theme (Google Maps only)
export const DARK_MAP_STYLE = [
  { elementType: "geometry",            stylers: [{ color: "#1E293B" }] },
  { elementType: "labels.text.fill",    stylers: [{ color: "#94A3B8" }] },
  { elementType: "labels.text.stroke",  stylers: [{ color: "#0F172A" }] },
  { featureType: "road",              elementType: "geometry",       stylers: [{ color: "#334155" }] },
  { featureType: "road.arterial",     elementType: "geometry",       stylers: [{ color: "#475569" }] },
  { featureType: "road.highway",      elementType: "geometry",       stylers: [{ color: "#64748B" }] },
  { featureType: "water",             elementType: "geometry",       stylers: [{ color: "#0F172A" }] },
  { featureType: "poi",               elementType: "geometry",       stylers: [{ color: "#1E293B" }] },
  { featureType: "poi.park",          elementType: "geometry.fill",  stylers: [{ color: "#1a2e1a" }] },
  { featureType: "transit",           stylers: [{ visibility: "off" }] },
  { featureType: "administrative",    elementType: "geometry.stroke", stylers: [{ color: "#334155" }] },
];
