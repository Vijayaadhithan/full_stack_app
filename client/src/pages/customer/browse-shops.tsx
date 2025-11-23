import React from "react";
import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Store, MapPin, Filter, Sparkles, Compass } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import {
  useLocationFilter,
  Coordinates as GeoCoordinates,
} from "@/hooks/use-location-filter";
import { LocationFilterPopover } from "@/components/location/location-filter-popover";
import { useAuth } from "@/hooks/use-auth";
import type { PublicShop } from "@/types/public-shop";

const formatAddress = (user: PublicShop): string => {
  const parts = [
    user.addressStreet,
    user.addressCity,
    user.addressState,
    user.addressPostalCode,
    user.addressCountry,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Location not specified";
};

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

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371; // km
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
}

function computeDistance(
  origin: GeoCoordinates | null,
  destination: PublicShop,
): number | null {
  if (!origin || !destination.latitude || !destination.longitude) return null;
  const lat = Number(destination.latitude);
  const lng = Number(destination.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return haversineDistance(origin.latitude, origin.longitude, lat, lng);
}

export default function BrowseShops() {
  const locationFilter = useLocationFilter({ storageKey: "shops-radius" });
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    searchQuery: "",
    locationCity: "",
    locationState: "",
  });
  const customerLocation = locationFilter.location;
  const radius = locationFilter.radius;
  const locationQuery = customerLocation
    ? {
        lat: customerLocation.latitude,
        lng: customerLocation.longitude,
        radius,
      }
    : null;
  const canUseNearbySearch = Boolean(user && locationQuery);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const {
    data: fallbackShops,
    isLoading: isLoadingFallback,
  } = useQuery<PublicShop[]>({
    queryKey: ["/api/shops", filters.locationCity, filters.locationState],
    enabled: !canUseNearbySearch,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.locationCity)
        params.append("locationCity", filters.locationCity);
      if (filters.locationState)
        params.append("locationState", filters.locationState);
      const queryString = params.toString();
      const response = await apiRequest(
        "GET",
        `/api/shops${queryString ? `?${queryString}` : ""}`,
      );
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }
      return response.json();
    },
  });

  const {
    data: nearbyShops,
    isFetching: isSearchingNearby,
  } = useQuery<PublicShop[]>({
    queryKey: [
      "search-nearby",
      locationQuery?.lat,
      locationQuery?.lng,
      locationQuery?.radius,
    ],
    enabled: canUseNearbySearch,
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: String(locationQuery!.lat),
        lng: String(locationQuery!.lng),
        radius: String(locationQuery!.radius),
      });
      const response = await apiRequest(
        "GET",
        `/api/search/nearby?${params.toString()}`,
      );
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }
      return response.json();
    },
  });

  const shops = canUseNearbySearch ? nearbyShops : fallbackShops;
  const isLoading = canUseNearbySearch ? isSearchingNearby : isLoadingFallback;

  const filteredShops = useMemo(() => {
    if (!shops) return [];
    return shops
      .filter((shop) => {
        if (!filters.searchQuery) return true;
        const query = filters.searchQuery.toLowerCase();
        const displayName = shop.shopProfile?.shopName || shop.name || "";
        const nameMatch = displayName.toLowerCase().includes(query);
        const descMatch = shop.shopProfile?.description
          ?.toLowerCase()
          .includes(query);
        return nameMatch || descMatch;
      })
      .filter((shop) => {
        if (filters.locationCity) {
          if (
            shop.addressCity?.toLowerCase() !==
            filters.locationCity.toLowerCase()
          ) {
            return false;
          }
        }
        if (filters.locationState) {
          if (
            shop.addressState?.toLowerCase() !==
            filters.locationState.toLowerCase()
          ) {
            return false;
          }
        }
        return true;
      });
  }, [shops, filters]);

  return (
    <DashboardLayout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6 p-4 sm:p-6"
      >
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-r from-primary/10 via-primary/5 to-sky-50 p-6 shadow-sm">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.14),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.16),transparent_32%)]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Discover
              </p>
              <h1 className="text-2xl font-bold leading-tight">
                Browse Shops nearby
              </h1>
              <p className="text-sm text-muted-foreground">
                Glassy filters + location to surface the best fit.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-3 py-2 shadow-sm backdrop-blur">
              <Compass className="h-4 w-4 text-primary" />
              <div className="text-sm">
                {canUseNearbySearch
                  ? "Using your saved location"
                  : "Set a radius to improve results"}
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 items-center md:grid-cols-[1.6fr_1fr_1fr]">
            <div className="relative w-full">
              <Input
                placeholder="Search shops..."
                value={filters.searchQuery}
                onChange={(e) => handleFilterChange("searchQuery", e.target.value)}
                className="pl-3"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Filter className="mr-2 h-4 w-4" /> Filters
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={filters.locationCity}
                    onChange={(e) => handleFilterChange("locationCity", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={filters.locationState}
                    onChange={(e) => handleFilterChange("locationState", e.target.value)}
                  />
                </div>
              </PopoverContent>
            </Popover>
            <LocationFilterPopover state={locationFilter} />
          </div>
        </div>
        <div className="rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground space-y-1">
          {customerLocation ? (
            <>
              Showing shops within{" "}
              <span className="font-semibold">{radius} km</span> of{" "}
              <span className="font-mono">
                {customerLocation.latitude.toFixed(3)},{" "}
                {customerLocation.longitude.toFixed(3)}
              </span>
              .
              {!user && (
                <span className="block text-xs text-muted-foreground/80">
                  Sign in to load location-based results.
                </span>
              )}
            </>
          ) : (
            <>{user ? "Set a location filter to focus on nearby shops." : "Sign in or use the text filters to browse shops."}</>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="overflow-hidden">
                <div className="h-28 bg-gradient-to-r from-muted to-muted/60" />
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-28 rounded bg-muted" />
                    <div className="h-6 w-16 rounded bg-muted" />
                  </div>
                  <div className="h-4 w-32 rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredShops.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                No shops matched your filters. Try widening your radius or adjusting the search.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredShops.map((shop) => {
              const distance = computeDistance(customerLocation, shop);
              const displayName = shop.shopProfile?.shopName || shop.name;
              return (
                <motion.div key={shop.id} variants={item}>
                  <Link href={`/customer/shops/${shop.id}`}>
                    <Card className="group h-full cursor-pointer overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
                      <div className="relative h-24 bg-gradient-to-r from-primary/10 via-muted to-muted/60">
                        {shop.shopBannerImageUrl ? (
                          <img
                            src={shop.shopBannerImageUrl}
                            alt={displayName ?? "Shop banner"}
                            className="absolute inset-0 h-full w-full object-cover opacity-70"
                          />
                        ) : null}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80" />
                        <div className="absolute left-4 bottom-3 inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-xs font-semibold shadow-sm">
                          <Sparkles className="h-4 w-4 text-primary" />
                          Featured shop
                        </div>
                      </div>
                      <CardContent className="flex h-full flex-col gap-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                              <Store className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="font-semibold line-clamp-1">
                                {displayName}
                              </h3>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {shop.shopProfile?.description ||
                                  "Local shop near you"}
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary">Shop</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span className="line-clamp-1">
                            {formatAddress(shop)}
                          </span>
                        </div>
                        {distance !== null && (
                          <p className="text-xs font-medium text-primary">
                            {distance.toFixed(1)} km away
                          </p>
                        )}
                        <Button className="w-full mt-auto" variant="outline">
                          Visit Shop
                        </Button>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
