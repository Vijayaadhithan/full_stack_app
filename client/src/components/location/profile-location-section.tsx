import React from "react";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { User } from "@shared/schema";
import { LocationPicker, Coordinates } from "./location-picker";
import { cn } from "@/lib/utils";
import MapLink from "@/components/location/MapLink";

type ProfileLocationSectionProps = {
  user: Pick<User, "latitude" | "longitude" | "role"> | null;
  title?: string;
  description?: string;
  className?: string;
};

function toCoordinates(
  latitudeValue: unknown | null | undefined,
  longitudeValue: unknown | null | undefined,
): Coordinates | null {
  if (latitudeValue == null || longitudeValue == null) {
    return null;
  }
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return {
    latitude,
    longitude,
  };
}

function locationsEqual(a: Coordinates | null, b: Coordinates | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    Number(a.latitude.toFixed(7)) === Number(b.latitude.toFixed(7)) &&
    Number(a.longitude.toFixed(7)) === Number(b.longitude.toFixed(7))
  );
}

export function ProfileLocationSection({
  user,
  title,
  description,
  className,
}: ProfileLocationSectionProps) {
  const resolvedTitle =
    title ?? (user?.role === "customer" ? "My Location" : "Business Location");
  const resolvedDescription =
    description ??
    "Set your exact position so that distance-based search works accurately.";
  const userLatitude = user?.latitude;
  const userLongitude = user?.longitude;
  const initialLocation = useMemo(
    () => toCoordinates(userLatitude, userLongitude),
    [userLatitude, userLongitude],
  );
  const [location, setLocation] = useState<Coordinates | null>(initialLocation);
  const [isCapturingDeviceLocation, setIsCapturingDeviceLocation] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setLocation(initialLocation);
  }, [initialLocation]);

  const mutation = useMutation({
    mutationFn: async (coords: Coordinates) => {
      const res = await apiRequest("POST", "/api/profile/location", coords);
      return (await res.json()) as { message?: string; user: User };
    },
    onSuccess: ({ user: updatedUser, message }) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
      toast({
        title: "Location saved",
        description: message ?? "Profile location updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Location update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isDirty = !locationsEqual(location, initialLocation);

  const handleUseDeviceLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast({
        title: "Geolocation unavailable",
        description: "Your browser does not support the Geolocation API.",
        variant: "destructive",
      });
      return;
    }
    setIsCapturingDeviceLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsCapturingDeviceLocation(false);
        setLocation({
          latitude: Number(position.coords.latitude.toFixed(7)),
          longitude: Number(position.coords.longitude.toFixed(7)),
        });
      },
      (error) => {
        setIsCapturingDeviceLocation(false);
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
  };

  const handleSave = () => {
    if (!location) {
      toast({
        title: "Select a location first",
        description: "Drag the pin on the map or use your device location.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(location);
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <MapPin className="h-5 w-5 text-primary" />
          {resolvedTitle}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{resolvedDescription}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <LocationPicker value={location} onChange={setLocation} />
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={handleUseDeviceLocation}
            disabled={isCapturingDeviceLocation || mutation.isPending}
          >
            {isCapturingDeviceLocation ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Use My Current Location
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleSave}
            disabled={!isDirty || mutation.isPending || !location}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Save Location
          </Button>
        </div>
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          {location ? (
            <div className="flex flex-col gap-1">
              <span className="font-medium text-muted-foreground">
                Selected coordinates
              </span>
              <span>
                Latitude:{" "}
                <span className="font-mono">
                  {location.latitude.toFixed(6)}
                </span>
              </span>
              <span>
                Longitude:{" "}
                <span className="font-mono">
                  {location.longitude.toFixed(6)}
                </span>
              </span>
              <MapLink
                latitude={location.latitude}
                longitude={location.longitude}
              />
              {initialLocation && !isDirty ? (
                <span className="text-xs text-muted-foreground">
                  This matches your saved location.
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground">
              No saved location yet. Drag the pin or use your device to begin.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
