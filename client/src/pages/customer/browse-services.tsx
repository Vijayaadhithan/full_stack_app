import React from 'react';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Loader2,
  Star,
  Clock,
  Search,
  Filter,
  Grid,
  Sparkles,
  Briefcase,
  HeartPulse,
  BookOpen,
  Wrench,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Service } from "@shared/schema";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  useLocationFilter,
  Coordinates as GeoCoordinates,
} from "@/hooks/use-location-filter";
import { LocationFilterPopover } from "@/components/location/location-filter-popover";

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

const categoryTiles = [
  {
    value: "all",
    label: "All Services",
    icon: Grid,
    image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=800&auto=format&fit=crop",
    description: "Explore everything we offer"
  },
  {
    value: "Beauty & Wellness",
    label: "Beauty",
    icon: Sparkles,
    image: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?q=80&w=800&auto=format&fit=crop",
    description: "Salon, makeup & spa"
  },
  {
    value: "Home Services",
    label: "Home Fixes",
    icon: Wrench,
    image: "https://images.unsplash.com/photo-1581578731117-104f8a746956?q=80&w=800&auto=format&fit=crop",
    description: "Plumbing, electrical & repairs"
  },
  {
    value: "Professional Services",
    label: "Pros",
    icon: Briefcase,
    image: "https://images.unsplash.com/photo-1664575602276-acd073f104c1?q=80&w=800&auto=format&fit=crop",
    description: "Consulting & legal help"
  },
  {
    value: "Health & Fitness",
    label: "Health",
    icon: HeartPulse,
    image: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=800&auto=format&fit=crop",
    description: "Yoga, gym & training"
  },
  {
    value: "Education & Training",
    label: "Learning",
    icon: BookOpen,
    image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=800&auto=format&fit=crop",
    description: "Tutors & classes"
  },
];

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
  const filteredServices = services;

  return (
    <DashboardLayout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6 p-6"
      >
        <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-start md:items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Browse Services</h1>
            <p className="text-sm text-muted-foreground">
              Tap an icon to choose the vibe you need.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
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

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {categoryTiles.map((tile) => {
            const isActive = filters.category === tile.value;
            return (
              <motion.div
                key={tile.value}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div
                  onClick={() => handleFilterChange("category", tile.value)}
                  className={`
                    relative cursor-pointer group overflow-hidden rounded-xl aspect-[4/5]
                    ${isActive ? 'ring-2 ring-primary ring-offset-2' : ''}
                  `}
                >
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors z-10" />
                  <img
                    src={tile.image}
                    alt={tile.label}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 z-20 p-4 flex flex-col justify-end text-white">
                    <tile.icon className="h-6 w-6 mb-2 opacity-90" />
                    <h3 className="font-bold text-lg leading-tight mb-1">{tile.label}</h3>
                    <p className="text-xs text-white/80 line-clamp-2">{tile.description}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
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
        )}
      </motion.div>
    </DashboardLayout>
  );
}
