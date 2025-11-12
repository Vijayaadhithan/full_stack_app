import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

type MapLinkProps = {
  latitude?: number | string | null;
  longitude?: number | string | null;
  className?: string;
  label?: string;
};

const toNumber = (value?: number | string | null): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export function MapLink({
  latitude,
  longitude,
  className,
  label = "(View on Map)",
}: MapLinkProps) {
  const latValue = toNumber(latitude);
  const lngValue = toNumber(longitude);

  if (latValue === null || lngValue === null) {
    return null;
  }

  const query = `${latValue.toFixed(6)},${lngValue.toFixed(6)}`;

  return (
    <a
      href={`https://www.google.com/maps?q=${latValue},${lngValue}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600",
        className,
      )}
      title={`Open ${query} in Google Maps`}
    >
      <span>{label}</span>
      <span role="img" aria-label="map">
        🗺️
      </span>
      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

export default MapLink;
