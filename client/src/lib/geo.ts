export type Coordinates = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function toCoordinates(
  latitude?: number | string | null,
  longitude?: number | string | null,
): Coordinates | null {
  const lat = typeof latitude === "number" ? latitude : Number(latitude);
  const lng = typeof longitude === "number" ? longitude : Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { latitude: lat, longitude: lng };
}

export function computeDistanceKm(
  origin: Coordinates | null,
  destination?:
    | {
        latitude?: number | string | null;
        longitude?: number | string | null;
      }
    | null,
): number | null {
  if (!origin || !destination) return null;
  const target = toCoordinates(destination.latitude ?? null, destination.longitude ?? null);
  if (!target) return null;
  return haversineDistanceKm(
    origin.latitude,
    origin.longitude,
    target.latitude,
    target.longitude,
  );
}
