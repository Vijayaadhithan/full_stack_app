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
import { useLanguage } from "@/contexts/language-context";
import { useAppMode } from "@/contexts/UserContext";

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
  initialCoordinates,
}: ProfileLocationSectionProps & { initialCoordinates?: Coordinates | null }) {
  const { t } = useLanguage();
  const resolvedTitle =
    title ??
    (user?.role === "customer"
      ? t("profile_location_title_customer")
      : t("profile_location_title_provider"));
  const resolvedDescription =
    description ?? t("profile_location_description");
  const userLatitude = user?.latitude;
  const userLongitude = user?.longitude;

  const initialLocation = useMemo(
    () => initialCoordinates || toCoordinates(userLatitude, userLongitude),
    [userLatitude, userLongitude, initialCoordinates],
  );

  const [location, setLocation] = useState<Coordinates | null>(initialLocation);
  const [isCapturingDeviceLocation, setIsCapturingDeviceLocation] = useState(false);
  const { toast } = useToast();
  const { appMode } = useAppMode();

  useEffect(() => {
    setLocation(initialLocation);
  }, [initialLocation]);

  const mutation = useMutation({
    mutationFn: async (coords: Coordinates) => {
      const res = await apiRequest("POST", "/api/profile/location", {
        ...coords,
        context: appMode === "SHOP" ? "shop" : "user"
      });
      return (await res.json()) as { message?: string; user: User };
    },
    onSuccess: ({ user: updatedUser, message }) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
      toast({
        title: t("location_saved_title"),
        description: message ?? t("location_saved_description"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("location_update_failed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isDirty = !locationsEqual(location, initialLocation);

  const handleUseDeviceLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast({
        title: t("geolocation_unavailable_title"),
        description: t("geolocation_unavailable_description"),
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
          title: t("location_fetch_failed_title"),
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
        title: t("location_select_first_title"),
        description: t("location_select_first_description"),
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
            {t("use_current_location")}
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
            {t("save_location")}
          </Button>
        </div>
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          {location ? (
            <div className="flex flex-col gap-1">
              <span className="font-medium text-muted-foreground">
                {t("selected_coordinates")}
              </span>
              <span>
                {t("latitude_label")}:{" "}
                <span className="font-mono">
                  {location.latitude.toFixed(6)}
                </span>
              </span>
              <span>
                {t("longitude_label")}:{" "}
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
                  {t("location_matches_saved")}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground">
              {t("location_empty_state")}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
