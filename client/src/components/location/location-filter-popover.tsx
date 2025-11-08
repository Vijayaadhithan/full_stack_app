import React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  MapPin,
  Crosshair,
  LocateFixed,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useLocationFilter,
  MIN_RADIUS_KM,
  MAX_RADIUS_KM,
  DEFAULT_RADIUS_KM,
} from "@/hooks/use-location-filter";

type LocationFilterPopoverProps = {
  label?: string;
  className?: string;
  state: ReturnType<typeof useLocationFilter>;
};

export function LocationFilterPopover({
  label = "Location",
  className,
  state,
}: LocationFilterPopoverProps) {
  const {
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
    clearLocation,
    handleUseDeviceLocation,
    handleUseProfileLocation,
    handleManualSubmit,
  } = state;

  const locationSummary = location
    ? `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`
    : "No coordinates selected";

  const sourceLabel =
    source === "device"
      ? "Device"
      : source === "manual"
        ? "Manual"
        : source === "profile"
          ? "Profile"
          : "None";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-full sm:w-auto", className)}>
          <MapPin className="mr-2 h-4 w-4" />
          {label}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm font-medium">
            <span>Radius</span>
            <span>{radius} km</span>
          </div>
          <Slider
            className="mt-2"
            value={[radius]}
            min={MIN_RADIUS_KM}
            max={MAX_RADIUS_KM}
            step={5}
            onValueChange={(value) => setRadius(value[0] ?? DEFAULT_RADIUS_KM)}
          />
        </div>

        <div className="space-y-1 rounded-md border bg-muted/40 p-3 text-xs">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>Selected point</span>
            <span className="text-muted-foreground">Source: {sourceLabel}</span>
          </div>
          <p className="font-mono text-sm">{locationSummary}</p>
          {locationError ? (
            <p className="text-destructive">{locationError}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleUseDeviceLocation}
            disabled={isRequestingLocation}
          >
            {isRequestingLocation ? (
              <Crosshair className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Crosshair className="mr-2 h-4 w-4" />
            )}
            Use device
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleUseProfileLocation}
            disabled={!hasProfileLocation}
          >
            <LocateFixed className="mr-2 h-4 w-4" />
            Saved location
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setShowManualInputs((prev) => !prev)}
          >
            {showManualInputs ? "Hide manual input" : "Enter coordinates"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={clearLocation}
            disabled={!location}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>

        {showManualInputs ? (
          <div className="space-y-3 rounded-md border p-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Latitude</Label>
              <Input
                value={manualInputs.latitude}
                onChange={(e) =>
                  setManualInputs((prev) => ({
                    ...prev,
                    latitude: e.target.value,
                  }))
                }
                placeholder="12.9716"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Longitude</Label>
              <Input
                value={manualInputs.longitude}
                onChange={(e) =>
                  setManualInputs((prev) => ({
                    ...prev,
                    longitude: e.target.value,
                  }))
                }
                placeholder="77.5946"
              />
            </div>
            <Button type="button" size="sm" className="w-full" onClick={handleManualSubmit}>
              Apply manual coordinates
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
