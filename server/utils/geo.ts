export const DEFAULT_NEARBY_RADIUS_KM = 60;
export const MIN_NEARBY_RADIUS_KM = 1;
export const MAX_NEARBY_RADIUS_KM = 500;
const EARTH_RADIUS_KM = 6371;

export type CoordinateInput = number | string | null | undefined;

export function normalizeCoordinate(value: CoordinateInput): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }
    return value.toFixed(7);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const numericValue = Number(trimmed);
    if (!Number.isFinite(numericValue)) {
      return null;
    }
    return numericValue.toFixed(7);
  }
  return null;
}

export function toNumericCoordinate(value: CoordinateInput): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }
  return numericValue;
}

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
