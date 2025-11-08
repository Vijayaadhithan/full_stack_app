import React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L, {
  type LatLngTuple,
  type LeafletMouseEvent,
  type LeafletEvent,
} from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { cn } from "@/lib/utils";

const DEFAULT_COORDINATES = {
  latitude: 20.5937,
  longitude: 78.9629,
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

export type LocationPickerProps = {
  value: Coordinate | null;
  onChange: (value: Coordinate) => void;
  className?: string;
  height?: number;
  zoom?: number;
  disabled?: boolean;
  showHint?: boolean;
};

const isBrowser = typeof window !== "undefined";
if (isBrowser) {
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
  });
}

function MapPositionUpdater({ position }: { position: Coordinate }) {
  const map = useMap();
  const latLng = useMemo<LatLngTuple>(
    () => [position.latitude, position.longitude],
    [position.latitude, position.longitude],
  );

  useEffect(() => {
    map.setView(latLng);
  }, [latLng, map]);

  return null;
}

function MapInteractionLayer({
  disabled,
  onChange,
}: {
  disabled?: boolean;
  onChange: (value: Coordinate) => void;
}) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      if (disabled) return;
      onChange({
        latitude: Number(event.latlng.lat.toFixed(7)),
        longitude: Number(event.latlng.lng.toFixed(7)),
      });
    },
  });
  return null;
}

export function LocationPicker({
  value,
  onChange,
  className,
  height = 320,
  zoom = 13,
  disabled,
  showHint = true,
}: LocationPickerProps) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const position = value ?? DEFAULT_COORDINATES;

  if (!isMounted) {
    return (
      <div
        className={cn(
          "w-full rounded-xl border border-dashed border-muted bg-muted/40 animate-pulse",
          className,
        )}
        style={{ height }}
      />
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <MapContainer
        center={[position.latitude, position.longitude] as LatLngTuple}
        zoom={zoom}
        className="z-0 h-full w-full rounded-xl overflow-hidden border"
        style={{ height }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapPositionUpdater position={position} />
        <MapInteractionLayer disabled={disabled} onChange={onChange} />
        <Marker
          draggable={!disabled}
          eventHandlers={
            disabled
              ? undefined
              : {
                  dragend: (event: LeafletEvent) => {
                    const coords = (event.target as L.Marker).getLatLng();
                    onChange({
                      latitude: Number(coords.lat.toFixed(7)),
                      longitude: Number(coords.lng.toFixed(7)),
                    });
                  },
                }
          }
          position={[position.latitude, position.longitude] as LatLngTuple}
        />
      </MapContainer>
      {showHint ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Drag the pin or tap anywhere on the map to fine-tune your position.
        </p>
      ) : null}
    </div>
  );
}

export type Coordinates = Coordinate;
