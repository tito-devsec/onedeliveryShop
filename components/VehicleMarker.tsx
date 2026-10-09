import { useEffect, useRef, useState } from "react";
import { Marker } from "react-native-maps";
import { bearingDegrees, distanceMeters, LatLng } from "@/lib/maps";
import { vehicleTopImage } from "@/lib/vehicles";

type Props = {
  coordinate: LatLng;
  heading?: number | null; // degrees from north, from the driver's GPS; null/negative when unknown
  vehicleType?: string | null;
  title?: string;
  zIndex?: number;
};

const FRAME_MS = 33; // ~30 fps: smooth, and light on the JS thread
const TELEPORT_METERS = 400; // a jump this big (GPS re-acquired, app resumed) isn't driven across town
const MIN_TURN_METERS = 4; // smaller moves are GPS noise and would spin the vehicle

const norm = (deg: number) => ((deg % 360) + 360) % 360;
const validHeading = (h?: number | null) => (h != null && Number.isFinite(h) && h >= 0 ? norm(h) : null);

/**
 * The driver's vehicle on the map, seen from above. Between GPS fixes it drives along
 * the straight line to the new position over about the time fixes take to arrive, and
 * turns to face the way it's moving, so it glides like in ride-hailing apps instead
 * of jumping every few seconds.
 */
export default function VehicleMarker({ coordinate, heading, vehicleType, title, zIndex = 10 }: Props) {
  const [pose, setPose] = useState(() => ({ ...coordinate, rotation: validHeading(heading) ?? 0 }));
  const current = useRef(pose);
  const lastFixAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    const from = current.current;
    const to = { latitude: coordinate.latitude, longitude: coordinate.longitude };
    const now = Date.now();
    const gap = lastFixAt.current ? now - lastFixAt.current : 0;
    lastFixAt.current = now;
    const moved = distanceMeters(from, to);

    if (!gap || moved > TELEPORT_METERS) {
      stop();
      const p = { ...to, rotation: validHeading(heading) ?? from.rotation };
      current.current = p;
      setPose(p);
      return;
    }
    if (moved < 0.5) return;

    // Face the direction of travel; when barely moving keep the last direction
    const target = moved >= MIN_TURN_METERS ? bearingDegrees(from, to) : from.rotation;
    const turn = ((target - from.rotation + 540) % 360) - 180;
    const duration = Math.min(Math.max(gap, 600), 4000);
    const start = now;

    stop();
    timer.current = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const p = {
        latitude: from.latitude + (to.latitude - from.latitude) * t,
        longitude: from.longitude + (to.longitude - from.longitude) * t,
        rotation: norm(from.rotation + turn * Math.min(1, t * 3)), // turn first, then drive
      };
      current.current = p;
      setPose(p);
      if (t >= 1) stop();
    }, FRAME_MS);
  }, [coordinate.latitude, coordinate.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => stop, []);

  return (
    <Marker
      coordinate={{ latitude: pose.latitude, longitude: pose.longitude }}
      rotation={pose.rotation}
      flat
      anchor={{ x: 0.5, y: 0.5 }}
      image={vehicleTopImage(vehicleType)}
      title={title}
      zIndex={zIndex}
      tracksViewChanges={false}
    />
  );
}
