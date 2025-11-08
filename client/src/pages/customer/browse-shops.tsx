import React from "react";
import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Store, MapPin, Filter } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { User } from "@shared/schema";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import {
  useLocationFilter,
  Coordinates as GeoCoordinates,
} from "@/hooks/use-location-filter";
import { LocationFilterPopover } from "@/components/location/location-filter-popover";

const formatAddress = (user: User): string => {
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
  destination: User,
): number | null {
  if (!origin || !destination.latitude || !destination.longitude) return null;
  const lat = Number(destination.latitude);
  const lng = Number(destination.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return haversineDistance(origin.latitude, origin.longitude, lat, lng);
}

export default function BrowseShops() {
  const locationFilter = useLocationFilter({ storageKey: "shops-radius" });
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

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const {
    data: fallbackShops,
    isLoading: isLoadingFallback,
  } = useQuery<User[]>({
    queryKey: ["/api/shops", filters.locationCity, filters.locationState],
    enabled: !locationQuery,
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
  } = useQuery<User[]>({
    queryKey: [
      "search-nearby",
      locationQuery?.lat,
      locationQuery?.lng,
      locationQuery?.radius,
    ],
    enabled: Boolean(locationQuery),
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

  const shops = locationQuery ? nearbyShops : fallbackShops;
  const isLoading = locationQuery ? isSearchingNearby : isLoadingFallback;

  const filteredShops = useMemo(() => {
    if (!shops) return [];
    return shops
      .filter((shop) => shop.role === "shop")
      .filter((shop) => {
        if (!filters.searchQuery) return true;
        const query = filters.searchQuery.toLowerCase();
        const nameMatch = shop.name.toLowerCase().includes(query);
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
        className="space-y-6 p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Browse Shops</h1>
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Input
              placeholder="Search shops..."
              value={filters.searchQuery}
              onChange={(e) =>
                handleFilterChange("searchQuery", e.target.value)
              }
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Filter className="mr-2 h-4 w-4" /> More Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 space-y-4">
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
        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          {customerLocation ? (
            <>
              Showing shops within{" "}
              <span className="font-semibold">{radius} km</span> of{" "}
              <span className="font-mono">
                {customerLocation.latitude.toFixed(3)},{" "}
                {customerLocation.longitude.toFixed(3)}
              </span>
              .
            </>
          ) : (
            <>Set a location filter to focus on nearby shops.</>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[320px]">
            <Loader2 className="h-8 w-8 animate-spin" />
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
              return (
                <motion.div key={shop.id} variants={item}>
                  <Link href={`/customer/shops/${shop.id}`}>
                    <Card className="h-full cursor-pointer transition-shadow hover:shadow-lg">
                      <CardContent className="p-6">
                        <div className="flex flex-col gap-4 h-full">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                              {shop.profilePicture ? (
                                <img
                                  src={shop.profilePicture}
                                  alt={shop.name}
                                  className="h-full w-full rounded-full object-cover"
                                />
                              ) : (
                                <Store className="h-6 w-6 text-primary" />
                              )}
                            </div>
                            <div>
                              <h3 className="font-semibold">
                                {shop.shopProfile?.shopName || shop.name}
                              </h3>
                              <div className="flex items-center text-sm text-muted-foreground">
                                <MapPin className="mr-1 h-3 w-3" />
                                <span>{formatAddress(shop)}</span>
                              </div>
                              {distance !== null ? (
                                <p className="text-xs text-muted-foreground">
                                  {distance.toFixed(1)} km away
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {shop.shopProfile?.description ||
                              "No description available"}
                          </p>
                          <div className="mt-auto pt-2">
                            <Button variant="outline" className="w-full">
                              View Shop
                            </Button>
                          </div>
                        </div>
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
