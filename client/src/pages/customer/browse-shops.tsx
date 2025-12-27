import React from "react";
import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Loader2, Store, MapPin, Filter, Search } from "lucide-react";
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
import { useLanguage } from "@/contexts/language-context";

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
  const { t } = useLanguage();
  const [, navigate] = useLocation();
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

  const formatAddress = (shop: PublicShop): string => {
    const parts = [
      shop.addressStreet,
      shop.addressCity,
      shop.addressState,
      shop.addressPostalCode,
      shop.addressCountry,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : t("location_not_specified");
  };

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
        className="space-y-6 p-6"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{t("browse_shops_title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("browse_shops_subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" className="h-11 px-4">
              {t("browse_shops")}
            </Button>
            <Button asChild variant="outline" className="h-11 px-4">
              <Link href="/customer/browse-products">
                {t("browse_products_title")}
              </Link>
            </Button>
          </div>
        </div>

        <Card className="border-0 bg-gradient-to-br from-emerald-50 via-white to-slate-50 shadow-sm">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder={t("browse_shops_search_placeholder")}
                  value={filters.searchQuery}
                  onChange={(e) =>
                    handleFilterChange("searchQuery", e.target.value)
                  }
                  className="pl-10"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto">
                      <Filter className="mr-2 h-4 w-4" />
                      {t("more_filters")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">{t("city_label")}</Label>
                      <Input
                        id="city"
                        value={filters.locationCity}
                        onChange={(e) =>
                          handleFilterChange("locationCity", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">{t("state_label")}</Label>
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
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground space-y-1">
              {customerLocation
                ? t("shops_location_within")
                    .replace("{radius}", String(radius))
                    .replace("{lat}", customerLocation.latitude.toFixed(3))
                    .replace("{lng}", customerLocation.longitude.toFixed(3))
                : user
                  ? t("shops_location_empty_signed_in")
                  : t("shops_location_empty_guest")}
              {!user && customerLocation ? (
                <span className="block text-xs text-muted-foreground/80">
                  {t("shops_location_sign_in_hint")}
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[320px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : filteredShops.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                {t("shops_empty_state")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredShops.map((shop) => {
              const distance = computeDistance(customerLocation, shop);
              const distanceLabel =
                distance !== null
                  ? t("distance_km_away").replace("{distance}", distance.toFixed(1))
                  : null;
              return (
                <motion.div
                  key={shop.id}
                  variants={item}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <Link href={`/customer/shops/${shop.id}`}>
                    <Card className="h-full cursor-pointer overflow-hidden rounded-2xl border bg-white/80 shadow-sm transition-shadow hover:shadow-lg">
                      <CardContent className="p-6">
                        <div className="flex flex-col gap-4 h-full">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                              {shop.profilePicture ? (
                                <img
                                  src={shop.profilePicture}
                                  alt={
                                    shop.shopProfile?.shopName ||
                                    shop.name ||
                                    t("shop_alt_fallback")
                                  }
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
                              {distanceLabel ? (
                                <p className="text-xs text-muted-foreground">
                                  {distanceLabel}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {shop.shopProfile?.description ||
                              t("shop_description_fallback")}
                          </p>
                          <div className="mt-auto pt-2">
                            <div className="grid grid-cols-2 gap-2">
                              <Button variant="outline" className="w-full h-11">
                                {t("view_shop")}
                              </Button>
                              <Button
                                variant="secondary"
                                className="w-full h-11"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  navigate(
                                    `/customer/shops/${shop.id}/quick-order`,
                                  );
                                }}
                              >
                                {t("quick_order")}
                              </Button>
                            </div>
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
