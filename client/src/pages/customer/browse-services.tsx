import React from 'react';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Loader2,
  Clock,
  Search,
  Filter,
  CalendarDays,
  Siren,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Service } from "@shared/schema";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  useLocationFilter,
  Coordinates as GeoCoordinates,
} from "@/hooks/use-location-filter";
import { LocationFilterPopover } from "@/components/location/location-filter-popover";
import { CategoryIcon } from "@/components/ui/category-icon";
import { getServiceImage, serviceCategoryImages, getGradientCSS } from "@shared/predefinedImages";
import { useLanguage } from "@/contexts/language-context";
import {
  SERVICE_CATEGORY_OPTIONS,
  getServiceCategoryLabel,
} from "@/lib/service-categories";

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

type ServiceCategoryFilterOption = {
  value: string;
  label: string;
  count: number;
};

export default function BrowseServices() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const locationFilter = useLocationFilter({ storageKey: "services-radius" });
  const pageSize = 24;
  const [page, setPage] = useState(1);
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
    urgency: "scheduled" as "scheduled" | "emergency",
  });

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    setPage(1);
  }, [
    filters,
    locationFilter.location?.latitude,
    locationFilter.location?.longitude,
    locationFilter.radius,
  ]);

  type ServiceListResponse = {
    page: number;
    pageSize: number;
    hasMore: boolean;
    items: ServiceWithProvider[];
  };

  const {
    data: servicesResponse,
    isLoading,
    error,
  } = useQuery<ServiceListResponse>({
    queryKey: [
      "/api/services",
      filters,
      page,
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
      if (filters.urgency === "emergency") {
        params.append("availableNow", "true");
      }
      if (locationQuery) {
        params.append("lat", locationQuery.lat.toString());
        params.append("lng", locationQuery.lng.toString());
        params.append("radius", locationQuery.radius.toString());
      }
      params.append("page", String(page));
      params.append("pageSize", String(pageSize));

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

  useEffect(() => {
    if (error) {
      toast({
        title: "Error fetching services",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Client-side filtering is no longer needed
  const filteredServices = servicesResponse?.items ?? [];
  const serviceCategoryOptions = useMemo<ServiceCategoryFilterOption[]>(() => {
    const baseOptions = SERVICE_CATEGORY_OPTIONS.map((option) => ({
      value: option.value,
      label: getServiceCategoryLabel(option.value, t),
      count: 0,
    }));
    const optionMap = new Map(
      baseOptions.map((option) => [option.value.toLowerCase(), option]),
    );

    filteredServices.forEach((service) => {
      const rawCategory = service.category?.trim();
      if (!rawCategory) return;
      const key = rawCategory.toLowerCase();
      const existing = optionMap.get(key);
      if (existing) {
        existing.count += 1;
        return;
      }
      optionMap.set(key, {
        value: rawCategory,
        label: getServiceCategoryLabel(rawCategory, t),
        count: 1,
      });
    });

    const options = Array.from(optionMap.values());
    const withResults = options
      .filter((option) => option.count > 0)
      .sort(
        (a, b) =>
          b.count - a.count || a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
      );
    const withoutResults = options
      .filter((option) => option.count === 0)
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
      );

    return [
      {
        value: "all",
        label: t("all_categories"),
        count: filteredServices.length,
      },
      ...withResults,
      ...withoutResults,
    ];
  }, [filteredServices, t]);

  const categoryTileOptions = useMemo(() => {
    const available = serviceCategoryOptions
      .filter((option) => option.value !== "all" && option.count > 0)
      .slice(0, 8);
    const fallback = serviceCategoryOptions
      .filter((option) => option.value !== "all")
      .slice(0, 8);
    const topCategories = available.length > 0 ? available : fallback;
    return [serviceCategoryOptions[0], ...topCategories].filter(
      (option): option is ServiceCategoryFilterOption => Boolean(option),
    );
  }, [serviceCategoryOptions]);

  useEffect(() => {
    if (filters.category === "all") return;
    const isValidCategory = serviceCategoryOptions.some(
      (option) => option.value === filters.category,
    );
    if (!isValidCategory) {
      setFilters((prev) => ({ ...prev, category: "all" }));
    }
  }, [filters.category, serviceCategoryOptions]);

  const showPagination = Boolean(
    servicesResponse && (servicesResponse.hasMore || page > 1),
  );
  const pageNumbers = (() => {
    const pages = new Set<number>();
    if (page > 1) {
      pages.add(page - 1);
    }
    pages.add(page);
    if (servicesResponse?.hasMore) {
      pages.add(page + 1);
    }
    return Array.from(pages).sort((a, b) => a - b);
  })();

  return (
    <DashboardLayout>
      <motion.div
        variants={container}
        initial={false}
        animate="show"
        className="space-y-6 p-6"
      >
        <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-start md:items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Browse Services</h1>
            <p className="text-sm text-muted-foreground">
              Choose a category first, then search nearby providers.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
            <ToggleGroup
              type="single"
              value={filters.urgency}
              onValueChange={(value) => {
                if (value) {
                  handleFilterChange("urgency", value);
                }
              }}
              className="w-full sm:w-auto justify-start"
            >
              <ToggleGroupItem
                value="scheduled"
                aria-label="Book for later"
                className="flex-1 sm:flex-none"
              >
                <CalendarDays className="h-4 w-4" />
                Book for later
              </ToggleGroupItem>
              <ToggleGroupItem
                value="emergency"
                aria-label="Emergency (need it now)"
                className="flex-1 sm:flex-none data-[state=on]:bg-destructive data-[state=on]:text-destructive-foreground"
              >
                <Siren className="h-4 w-4" />
                Emergency (Now)
              </ToggleGroupItem>
            </ToggleGroup>
            <div className="relative flex-1 min-w-[220px] md:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search services..."
                value={filters.searchTerm}
                onChange={(e) =>
                  handleFilterChange("searchTerm", e.target.value)
                }
                className="pl-10"
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
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={filters.category}
                    onValueChange={(value) => handleFilterChange("category", value)}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceCategoryOptions.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                          {category.count > 0 ? ` (${category.count})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
        </div>

        {filters.urgency === "emergency" ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <div className="flex items-start gap-2">
              <Siren className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-foreground">
                  Emergency mode: showing providers available now
                </p>
                <p className="text-muted-foreground">
                  Turn this off to schedule for later.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-3 mb-8">
          <p className="text-sm font-medium text-muted-foreground">
            Easy category picks
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            {categoryTileOptions.map((categoryOption) => {
              const isActive = filters.category === categoryOption.value;
              const categoryImage =
                categoryOption.value === "all"
                  ? serviceCategoryImages.other_service
                  : getServiceImage(categoryOption.value);
              const serviceCountLabel =
                categoryOption.value === "all"
                  ? "Show every category"
                  : categoryOption.count === 1
                    ? "1 service"
                    : `${categoryOption.count} services`;

              return (
                <motion.button
                  key={categoryOption.value}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleFilterChange("category", categoryOption.value)}
                  className={`relative overflow-hidden rounded-xl border p-4 text-left text-white shadow-sm transition-shadow hover:shadow-md ${
                    isActive
                      ? "ring-2 ring-primary ring-offset-2"
                      : "ring-1 ring-black/10"
                  }`}
                  style={{
                    background: getGradientCSS(categoryImage.gradient, "135deg"),
                  }}
                >
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="relative z-10 space-y-3">
                    <CategoryIcon
                      category={categoryImage}
                      size="md"
                      showLabel={false}
                    />
                    <div>
                      <p className="font-semibold leading-tight">{categoryOption.label}</p>
                      <p className="mt-1 text-xs text-white/85">{serviceCountLabel}</p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          {locationFilter.location ? (
            <>
              Showing providers within{" "}
              <span className="font-semibold">{locationFilter.radius} km</span> of{" "}
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

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !filteredServices?.length ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No services found</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredServices.map((service) => {
                const distance = computeDistance(
                  locationFilter.location,
                  service.provider,
                );
                return (
                  <motion.div key={service.id} variants={item}>
                    <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex flex-col gap-4">
                          <div>
                            <h3 className="font-semibold">{service.name}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {service.description}
                            </p>
                            {distance !== null ? (
                              <p className="text-xs text-muted-foreground mt-1">
                                {distance.toFixed(1)} km away
                              </p>
                            ) : null}
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span>{service.duration} mins</span>
                            </div>
                            <span className="font-semibold">₹{service.price}</span>
                          </div>

                          <Link href={`/customer/service-details/${service.id}`}>
                            <Button className="w-full">View Details</Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
            {showPagination ? (
              <Pagination className="mt-6">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        if (page > 1) {
                          setPage(page - 1);
                        }
                      }}
                      className={
                        page <= 1 ? "pointer-events-none opacity-50" : undefined
                      }
                    />
                  </PaginationItem>
                  {pageNumbers.map((pageNumber) => (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        href="#"
                        isActive={pageNumber === page}
                        onClick={(event) => {
                          event.preventDefault();
                          if (pageNumber !== page) {
                            setPage(pageNumber);
                          }
                        }}
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        if (servicesResponse?.hasMore) {
                          setPage(page + 1);
                        }
                      }}
                      className={
                        servicesResponse?.hasMore
                          ? undefined
                          : "pointer-events-none opacity-50"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            ) : null}
          </>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
