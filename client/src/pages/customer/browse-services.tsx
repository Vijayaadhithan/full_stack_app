import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Clock, Filter, MapPin, Search } from "lucide-react";
import { Service } from "@shared/schema";
import { serviceFilterConfig } from "@shared/config";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AnimatePresence, motion } from "framer-motion";
import {
  useLocationFilter,
  Coordinates as GeoCoordinates,
} from "@/hooks/use-location-filter";
import { LocationFilterPopover } from "@/components/location/location-filter-popover";
import { cn } from "@/lib/utils";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const MotionButton = motion(Button);

const formatNextSlot = (duration: number) => {
  const now = new Date();
  const slot = new Date(now.getTime() + Math.max(duration, 30) * 60 * 1000);
  return slot.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const haversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const computeDistance = (
  origin: GeoCoordinates | null,
  destination?: { latitude?: string | number | null; longitude?: string | number | null } | null,
) => {
  if (!origin || !destination?.latitude || !destination?.longitude) {
    return null;
  }
  const lat = Number(destination.latitude);
  const lng = Number(destination.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return haversineDistance(origin.latitude, origin.longitude, lat, lng);
};

type ProviderSummary = {
  id: number;
  name: string | null;
  phone: string | null;
  profilePicture: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
  latitude: string | null;
  longitude: string | null;
};

type ServiceWithProvider = Service & {
  rating: number | null;
  provider: ProviderSummary | null;
};

export default function BrowseServices() {
  const { toast } = useToast();
  const locationFilter = useLocationFilter({ storageKey: "services-radius" });
  const locationQuery = locationFilter.location
    ? {
        lat: locationFilter.location.latitude,
        lng: locationFilter.location.longitude,
        radius: locationFilter.radius,
      }
    : null;
  const [filters, setFilters] = useState({
    searchTerm: "",
    category: "all",
    minPrice: "",
    maxPrice: "",
    locationCity: "",
    locationState: "",
  });

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const {
    data: services,
    isLoading,
    error,
  } = useQuery<ServiceWithProvider[]>({
    queryKey: [
      "/api/services",
      filters,
      locationQuery?.lat,
      locationQuery?.lng,
      locationQuery?.radius,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.searchTerm) params.append("searchTerm", filters.searchTerm);
      if (filters.category && filters.category !== "all")
        params.append("category", filters.category);
      if (filters.minPrice) params.append("minPrice", filters.minPrice);
      if (filters.maxPrice) params.append("maxPrice", filters.maxPrice);
      if (filters.locationCity)
        params.append("locationCity", filters.locationCity);
      if (filters.locationState)
        params.append("locationState", filters.locationState);
      if (locationQuery) {
        params.append("lat", locationQuery.lat.toString());
        params.append("lng", locationQuery.lng.toString());
        params.append("radius", locationQuery.radius.toString());
      }

      const queryString = params.toString();
      const response = await apiRequest(
        "GET",
        `/api/services${queryString ? `?${queryString}` : ""}`,
      );
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Failed to fetch services" }));
        throw new Error(errorData.message || "Failed to fetch services");
      }
      return response.json();
    },
  });

  const filteredServices = services;
  const glassFilterEnabled = filters.category === "cleaning";
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const mapPoints = useMemo(
    () =>
      (filteredServices ?? [])
        .map((service) => ({
          id: service.id,
          name: service.name,
          lat: Number(service.provider?.latitude),
          lng: Number(service.provider?.longitude),
          price: service.price,
          category: service.category,
        }))
        .filter(
          (point) =>
            Number.isFinite(point.lat) && Number.isFinite(point.lng),
        ),
    [filteredServices],
  );

  const mapBounds = useMemo(() => {
    if (!mapPoints.length) return null;
    const lats = mapPoints.map((p) => p.lat);
    const lngs = mapPoints.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return { minLat, maxLat, minLng, maxLng };
  }, [mapPoints]);

  const projectPoint = useCallback(
    (lat: number, lng: number) => {
      if (!mapBounds) return { x: 50, y: 50 };
      const latRange = Math.max(mapBounds.maxLat - mapBounds.minLat, 0.0001);
      const lngRange = Math.max(mapBounds.maxLng - mapBounds.minLng, 0.0001);
      const x = ((lng - mapBounds.minLng) / lngRange) * 70 + 15;
      const y = 100 - (((lat - mapBounds.minLat) / latRange) * 70 + 15);
      return {
        x: Math.max(6, Math.min(94, x)),
        y: Math.max(8, Math.min(92, y)),
      };
    },
    [mapBounds],
  );

  useEffect(() => {
    if (error) {
      toast({
        title: "Error fetching services",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  return (
    <DashboardLayout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6 p-4 sm:p-6"
      >
        <div className="sticky top-[76px] z-30 space-y-3">
          <motion.div
            layout
            className={cn(
              "rounded-3xl border px-4 py-4 shadow-sm md:px-6 md:py-5",
              glassFilterEnabled
                ? "bg-white/60 backdrop-blur-2xl shadow-2xl dark:bg-slate-900/70 border-white/50"
                : "bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70",
            )}
            animate={{
              scale: glassFilterEnabled ? 1.01 : 1,
              boxShadow: glassFilterEnabled
                ? "0 25px 90px rgba(99,102,241,0.25)"
                : "0 10px 40px rgba(0,0,0,0.07)",
            }}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Discover
                </p>
                <h1 className="text-2xl font-bold leading-tight">
                  Book trusted services near you
                </h1>
              </div>
              <div className="flex items-center gap-2 self-start">
                <MotionButton
                  size="sm"
                  variant={viewMode === "list" ? "default" : "outline"}
                  onClick={() => setViewMode("list")}
                  whileTap={{ scale: 0.95 }}
                >
                  List View
                </MotionButton>
                <MotionButton
                  size="sm"
                  variant={viewMode === "map" ? "default" : "outline"}
                  onClick={() => setViewMode("map")}
                  whileTap={{ scale: 0.95 }}
                >
                  Map Split
                </MotionButton>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 items-center md:grid-cols-[1.6fr_1fr_1fr] lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by service or provider"
                  value={filters.searchTerm}
                  onChange={(e) =>
                    handleFilterChange("searchTerm", e.target.value)
                  }
                  className="pl-10"
                />
              </div>
              <Select
                value={filters.category}
                onValueChange={(value) => handleFilterChange("category", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {serviceFilterConfig.categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <Filter className="mr-2 h-4 w-4" /> More Filters
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="minPrice">Min Price (₹)</Label>
                    <Input
                      id="minPrice"
                      type="number"
                      value={filters.minPrice}
                      onChange={(e) =>
                        handleFilterChange("minPrice", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxPrice">Max Price (₹)</Label>
                    <Input
                      id="maxPrice"
                      type="number"
                      value={filters.maxPrice}
                      onChange={(e) =>
                        handleFilterChange("maxPrice", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={filters.locationCity}
                      onChange={(e) =>
                        handleFilterChange("locationCity", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={filters.locationState}
                      onChange={(e) =>
                        handleFilterChange("locationState", e.target.value)
                      }
                    />
                  </div>
                </PopoverContent>
              </Popover>
              <LocationFilterPopover state={locationFilter} />
            </div>
          </motion.div>
          <div className="rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground shadow-sm">
            {locationFilter.location ? (
              <>
                Showing providers within{" "}
                <span className="font-semibold">{locationFilter.radius} km</span>{" "}
                of{" "}
                <span className="font-mono">
                  {locationFilter.location.latitude.toFixed(3)},{" "}
                  {locationFilter.location.longitude.toFixed(3)}
                </span>
                .
              </>
            ) : (
              <>Set your location filter to prioritize nearby service providers.</>
            )}
          </div>
        </div>

        <div
          className={cn(
            "grid gap-6 items-start",
            viewMode === "map"
              ? "lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.85fr)]"
              : "",
          )}
        >
          <div ref={listContainerRef} className="space-y-4">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Card key={index} className="overflow-hidden">
                    <div className="h-32 bg-gradient-to-r from-muted to-muted/60" />
                    <CardContent className="space-y-3 p-4">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <div className="flex justify-between items-center">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-10 w-24 rounded-md" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : !filteredServices?.length ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">No services found</p>
                </CardContent>
              </Card>
            ) : (
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 auto-rows-fr"
              >
                {filteredServices.map((service) => {
                  const distance = computeDistance(
                    locationFilter.location,
                    service.provider,
                  );
                  const nextSlotLabel = formatNextSlot(service.duration);
                  return (
                    <motion.div
                      key={service.id}
                      variants={item}
                      layout
                      onHoverStart={() => setHoveredCard(service.id)}
                      onHoverEnd={() => setHoveredCard(null)}
                      className="h-full"
                    >
                      <Card className="group relative flex h-full flex-col overflow-hidden transition-all duration-200 hover:shadow-lg">
                        <div className="relative h-32 w-full overflow-hidden bg-gradient-to-br from-primary/10 via-muted to-muted">
                          <motion.div
                            className="absolute inset-0"
                            animate={{
                              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                            }}
                            transition={{ duration: 8, repeat: Infinity }}
                            style={{
                              backgroundImage:
                                "radial-gradient(circle at 10% 20%, rgba(99,102,241,0.24), transparent 25%), radial-gradient(circle at 90% 40%, rgba(16,185,129,0.24), transparent 25%), radial-gradient(circle at 40% 80%, rgba(14,165,233,0.18), transparent 25%)",
                              backgroundSize: "160% 160%",
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
                          <div className="absolute left-4 bottom-3 rounded-full bg-background/80 px-3 py-1 text-xs font-semibold shadow-sm">
                            {service.category}
                          </div>
                        </div>
                        <CardContent className="flex flex-1 flex-col gap-3 p-4">
                          <div className="space-y-1">
                            <h3 className="font-semibold line-clamp-1">
                              {service.name}
                            </h3>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {service.description}
                            </p>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span>{service.duration} mins</span>
                            </div>
                            <span className="font-semibold">₹{service.price}</span>
                          </div>
                          {distance !== null ? (
                            <p className="text-xs text-muted-foreground">
                              {distance.toFixed(1)} km away
                            </p>
                          ) : null}
                          <div className="mt-auto pt-2">
                            <Link href={`/customer/service-details/${service.id}`}>
                              <MotionButton
                                className="w-full"
                                whileTap={{ scale: 0.95 }}
                              >
                                View Details
                              </MotionButton>
                            </Link>
                          </div>
                          <AnimatePresence>
                            {hoveredCard === service.id && (
                              <motion.div
                                key="next-slot"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="hidden md:flex items-center justify-between rounded-xl border bg-primary/5 px-3 py-2 text-xs font-medium text-primary"
                              >
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>Next slot</span>
                                </div>
                                <span className="font-semibold">
                                  {nextSlotLabel}
                                </span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          <div className="md:hidden rounded-xl border bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3.5 w-3.5" />
                              <span>Next slot {nextSlotLabel}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </div>

          <AnimatePresence>
            {viewMode === "map" && (
              <motion.div
                key="map-panel"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
                className="lg:sticky lg:top-[140px]"
              >
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Map View
                      </p>
                      <p className="text-sm font-semibold">
                        Services around you
                      </p>
                    </div>
                    <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {mapPoints.length} pins
                    </div>
                  </div>
                  <div className="relative h-full min-h-[420px] overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-white">
                    <div className="pointer-events-none absolute inset-0 opacity-35">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.3),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.28),transparent_32%),radial-gradient(circle_at_40%_80%,rgba(236,72,153,0.25),transparent_28%)]" />
                      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(15,23,42,0.65),transparent_40%)]" />
                    </div>
                    <div className="absolute left-4 top-4 rounded-full bg-white/10 px-3 py-1 text-xs backdrop-blur">
                      Live proximity map
                    </div>
                    <div className="relative grid h-full w-full place-items-center">
                      {mapPoints.length === 0 ? (
                        <p className="text-sm text-slate-200">
                          Set a location to see nearby providers.
                        </p>
                      ) : (
                        mapPoints.map((point) => {
                          const pos = projectPoint(point.lat, point.lng);
                          const isActive = hoveredCard === point.id;
                          return (
                            <motion.div
                              key={point.id}
                              className="absolute"
                              style={{
                                left: `${pos.x}%`,
                                top: `${pos.y}%`,
                              }}
                              animate={{ scale: isActive ? 1.1 : 1 }}
                              transition={{ type: "spring", stiffness: 250, damping: 20 }}
                            >
                              <div className="flex items-center gap-2">
                                <div className="h-9 rounded-xl bg-white/90 px-3 py-1 text-xs font-semibold text-slate-900 shadow-lg backdrop-blur">
                                  {point.name}
                                  <span className="ml-2 text-primary">
                                    ₹{point.price}
                                  </span>
                                </div>
                                <div className="relative">
                                  <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40" />
                                  <div className="relative grid h-7 w-7 place-items-center rounded-full bg-emerald-400 text-slate-900 shadow-lg">
                                    <MapPin className="h-3.5 w-3.5" />
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                      {locationFilter.location ? (
                        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs backdrop-blur">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          You are here
                          <span className="text-slate-200">
                            ({locationFilter.location.latitude.toFixed(2)},{" "}
                            {locationFilter.location.longitude.toFixed(2)})
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
