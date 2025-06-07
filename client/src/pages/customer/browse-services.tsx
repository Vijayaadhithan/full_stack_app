import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, MapPin, Star, Clock, Search, Filter } from "lucide-react";
import { useState, useEffect } from "react";
import { Service } from "@shared/schema";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest } from "@/lib/queryClient"; 
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const categories = [
  "All",
  "Beauty & Wellness",
  "Home Services",
  "Professional Services",
  "Health & Fitness",
  "Education & Training"
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function BrowseServices() {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    searchTerm: "",
    category: "All",
    minPrice: "",
    maxPrice: "",
    locationCity: "",
    locationState: "",
  });

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const { data: services, isLoading, error } = useQuery<Service[]>({
    queryKey: ["/api/services", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.searchTerm) params.append("searchTerm", filters.searchTerm);
      if (filters.category && filters.category !== "All") params.append("category", filters.category);
      if (filters.minPrice) params.append("minPrice", filters.minPrice);
      if (filters.maxPrice) params.append("maxPrice", filters.maxPrice);
      if (filters.locationCity) params.append("locationCity", filters.locationCity);
      if (filters.locationState) params.append("locationState", filters.locationState);

      const queryString = params.toString();
      const response = await apiRequest("GET", `/api/services${queryString ? `?${queryString}` : ""}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to fetch services" }));
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
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Browse Services</h1>
          <div className="flex flex-wrap gap-4 w-full md:w-auto items-center">
            <div className="relative flex-1 min-w-[200px] md:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search services..."
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
                className="pl-10"
              />
            </div>
            <Select 
              value={filters.category} 
              onValueChange={(value) => handleFilterChange("category", value)}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
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
                    onChange={(e) => handleFilterChange("minPrice", e.target.value)}
                  />
                </div>
                 <div className="space-y-2">
                 <Label htmlFor="maxPrice">Max Price (₹)</Label>
                  <Input
                    id="maxPrice"
                    type="number"
                    value={filters.maxPrice}
                    onChange={(e) => handleFilterChange("maxPrice", e.target.value)}
                  />
                </div>
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
          </div>
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
            {filteredServices.map((service) => (
              <motion.div key={service.id} variants={item}>
                <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-4">
                      <div>
                        <h3 className="font-semibold">{service.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
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

                      <Link href={`/customer/service-details/${service.id}`}>
                        <Button 
                          className="w-full"
                          onClick={() => console.log("Navigating to service:", service.id)}
                        >
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
