import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useCallback, useEffect, useMemo, useState } from "react";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type LocationSource = "profile" | "device" | "manual" | null;

export const MIN_RADIUS_KM = 5;
export const MAX_RADIUS_KM = 200;
export const DEFAULT_RADIUS_KM = 60;
const RADIUS_STORAGE_FALLBACK_KEY = "location-radius";

const isBrowser = typeof window !== "undefined";

const clampRadius = (value: number) =>
  Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, value));

const parseStoredRadius = (key: string, fallback: number) => {
  if (!isBrowser) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clampRadius(parsed) : fallback;
  } catch {
    return fallback;
  }
};

const persistRadius = (key: string, value: number) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(key, value.toString());
  } catch {
    // Ignore quota errors in dev
  }
};

const parseCoordinates = (
  latitudeValue: unknown | null | undefined,
  longitudeValue: unknown | null | undefined,
) => {
  if (latitudeValue == null || longitudeValue == null) return null;
  const lat = Number(latitudeValue);
  const lng = Number(longitudeValue);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return {
    latitude: lat,
    longitude: lng,
  };
};

export type UseLocationFilterOptions = {
  storageKey?: string;
};

export type UseLocationFilterResult = {
  radius: number;
  setRadius: (value: number) => void;
  location: Coordinates | null;
  source: LocationSource;
  hasProfileLocation: boolean;
  isRequestingLocation: boolean;
  locationError: string | null;
  manualInputs: { latitude: string; longitude: string };
  setManualInputs: React.Dispatch<
    React.SetStateAction<{
      latitude: string;
      longitude: string;
    }>
  >;
  showManualInputs: boolean;
  setShowManualInputs: React.Dispatch<React.SetStateAction<boolean>>;
  setLocation: React.Dispatch<React.SetStateAction<Coordinates | null>>;
  clearLocation: () => void;
  handleUseDeviceLocation: () => void;
  handleUseProfileLocation: () => void;
  handleManualSubmit: () => void;
};

export function useLocationFilter(
  options?: UseLocationFilterOptions,
): UseLocationFilterResult {
  const storageKey = options?.storageKey ?? RADIUS_STORAGE_FALLBACK_KEY;
  const { user } = useAuth();
  const { toast } = useToast();

  const profileLatitude = user?.latitude;
  const profileLongitude = user?.longitude;
  const profileCoords = useMemo(
    () => parseCoordinates(profileLatitude, profileLongitude),
    [profileLatitude, profileLongitude],
  );
  const [hasProfileLocation, setHasProfileLocation] = useState(
    Boolean(profileCoords),
  );

  const [radius, setRadiusState] = useState(() =>
    parseStoredRadius(storageKey, DEFAULT_RADIUS_KM),
  );
  const [location, setLocation] = useState<Coordinates | null>(profileCoords);
  const [source, setSource] = useState<LocationSource>(
    profileCoords ? "profile" : null,
  );
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [manualInputs, setManualInputs] = useState({
    latitude: profileCoords ? profileCoords.latitude.toFixed(6) : "",
    longitude: profileCoords ? profileCoords.longitude.toFixed(6) : "",
  });
  const [showManualInputs, setShowManualInputs] = useState(false);

  useEffect(() => {
    setHasProfileLocation(Boolean(profileCoords));
    if (!profileCoords) {
      return;
    }
    if (!location || source === "profile") {
      setLocation(profileCoords);
      setSource("profile");
      setManualInputs({
        latitude: profileCoords.latitude.toFixed(6),
        longitude: profileCoords.longitude.toFixed(6),
      });
    }
  }, [location, profileCoords, source]);

  useEffect(() => {
    if (!location) {
      setManualInputs({ latitude: "", longitude: "" });
      return;
    }
    setManualInputs({
      latitude: location.latitude.toFixed(6),
      longitude: location.longitude.toFixed(6),
    });
  }, [location]);

  useEffect(() => {
    persistRadius(storageKey, radius);
  }, [radius, storageKey]);

  const setRadius = useCallback((value: number) => {
    setRadiusState(clampRadius(value));
  }, []);

  const clearLocation = useCallback(() => {
    setLocation(null);
    setSource(null);
    setLocationError(null);
  }, []);

  const handleUseProfileLocation = useCallback(() => {
    if (!profileCoords) {
      toast({
        title: "No saved location",
        description: "Save a location from your profile first.",
        variant: "destructive",
      });
      return;
    }
    setLocation(profileCoords);
    setSource("profile");
    setLocationError(null);
  }, [profileCoords, toast]);

  const handleUseDeviceLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast({
        title: "Geolocation unavailable",
        description: "Your browser doesn't support the Geolocation API.",
        variant: "destructive",
      });
      return;
    }
    setIsRequestingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsRequestingLocation(false);
        const coords = {
          latitude: Number(position.coords.latitude.toFixed(7)),
          longitude: Number(position.coords.longitude.toFixed(7)),
        };
        setLocation(coords);
        setSource("device");
        setLocationError(null);
      },
      (error) => {
        setIsRequestingLocation(false);
        setLocationError(error.message);
        toast({
          title: "Unable to fetch location",
          description: error.message,
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
      },
    );
  }, [toast]);

  const handleManualSubmit = useCallback(() => {
    const lat = Number(manualInputs.latitude);
    const lng = Number(manualInputs.longitude);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      toast({
        title: "Invalid coordinates",
        description: "Latitude must be between -90 and 90, longitude between -180 and 180.",
        variant: "destructive",
      });
      return;
    }
    setLocation({
      latitude: Number(lat.toFixed(7)),
      longitude: Number(lng.toFixed(7)),
    });
    setSource("manual");
    setLocationError(null);
  }, [manualInputs.latitude, manualInputs.longitude, toast]);

  return {
    radius,
    setRadius,
    location,
    source,
    hasProfileLocation,
    isRequestingLocation,
    locationError,
    manualInputs,
    setManualInputs,
    showManualInputs,
    setShowManualInputs,
    setLocation,
    clearLocation,
    handleUseDeviceLocation,
    handleUseProfileLocation,
    handleManualSubmit,
  };
}
