import React from 'react';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { productFilterConfig } from "@shared/config";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Search, ShoppingCart, Heart, Filter } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function BrowseProducts() {
  const { toast } = useToast();

  type ProductFilters = {
    searchTerm: string;
    category: string;
    minPrice: string;
    maxPrice: string;
    locationCity: string;
    locationState: string;
    attributes: Record<string, string>;
  };

  const createAttributeDefaults = () =>
    Object.fromEntries(
      productFilterConfig.attributeFilters.map(({ key }) => [key, ""]),
    ) as Record<string, string>;

  const [filters, setFilters] = useState<ProductFilters>(() => ({
    searchTerm: "",
    category: "all",
    minPrice: "",
    maxPrice: "",
    locationCity: "",
    locationState: "",
    attributes: createAttributeDefaults(),
  }));

  const handleFilterChange = (
    key: keyof Omit<ProductFilters, "attributes">,
    value: string,
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleAttributeChange = (key: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [key]: value,
      },
    }));
  };

  type ProductListItem = {
    id: number;
    name: string;
    description: string | null;
    price: string;
    mrp: string | null;
    category: string | null;
    images: string[];
    shopId: number | null;
    isAvailable: boolean;
    stock: number;
  };

  type ProductListResponse = {
    page: number;
    pageSize: number;
    hasMore: boolean;
    items: ProductListItem[];
  };

  const {
    data: productsResponse,
    isLoading,
    error,
  } = useQuery<ProductListResponse>({
    queryKey: ["/api/products", filters],
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
      const attributeEntries = Object.entries(filters.attributes).filter(
        ([, value]) => value,
      );
      if (attributeEntries.length > 0)
        params.append(
          "attributes",
          JSON.stringify(Object.fromEntries(attributeEntries)),
        );

      const queryString = params.toString();
      const response = await apiRequest(
        "GET",
        `/api/products${queryString ? `?${queryString}` : ""}`,
      );
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Failed to fetch products" }));
        throw new Error(errorData.message || "Failed to fetch products");
      }
      return response.json();
    },
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Error fetching products",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const addToCartMutation = useMutation({
    mutationFn: async (productId: number) => {
      const res = await apiRequest("POST", "/api/cart", {
        productId,
        quantity: 1,
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Added to cart",
        description: "Product has been added to your cart.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add product to cart",
        variant: "destructive",
      });
    },
  });

  const addToWishlistMutation = useMutation({
    mutationFn: async (productId: number) => {
      const res = await apiRequest("POST", "/api/wishlist", { productId });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist"] });
      toast({
        title: "Added to wishlist",
        description: "Product has been added to your wishlist.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add product to wishlist",
        variant: "destructive",
      });
    },
  });

  // Client-side filtering is no longer needed as it's done server-side
  const filteredProducts = productsResponse?.items ?? [];

  return (
    <DashboardLayout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-7xl mx-auto space-y-6"
      >
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <h1 className="text-2xl font-bold">Browse Products</h1>
          <div className="flex flex-wrap gap-4 w-full md:w-auto items-center">
            <div className="relative flex-1 min-w-[200px] md:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search products..."
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
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {productFilterConfig.categories.map((category) => (
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
                    placeholder="e.g., 100"
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
                    placeholder="e.g., 1000"
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
                {productFilterConfig.attributeFilters.map((attribute) => (
                  <div className="space-y-2" key={attribute.key}>
                    <Label htmlFor={`attribute-${attribute.key}`}>
                      {attribute.label}
                    </Label>
                    {attribute.type === "select" && attribute.options ? (
                      <Select
                        value={filters.attributes[attribute.key] ?? ""}
                        onValueChange={(value) =>
                          handleAttributeChange(attribute.key, value)
                        }
                      >
                        <SelectTrigger id={`attribute-${attribute.key}`}>
                          <SelectValue placeholder={attribute.label} />
                        </SelectTrigger>
                        <SelectContent>
                          {attribute.options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={`attribute-${attribute.key}`}
                        placeholder={attribute.placeholder ?? attribute.label}
                        value={filters.attributes[attribute.key] ?? ""}
                        onChange={(e) =>
                          handleAttributeChange(attribute.key, e.target.value)
                        }
                      />
                    )}
                  </div>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <motion.div key={product.id} variants={item}>
                  <Link
                    href={`/customer/shops/${product.shopId}/products/${product.id}`}
                  >
                    <Card className="h-full flex flex-col cursor-pointer hover:shadow-lg transition-shadow duration-200">
                      <div className="aspect-square relative overflow-hidden">
                        <img
                          src={
                            product.images?.[0] ||
                            "https://via.placeholder.com/400"
                          }
                          alt={product.name}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <CardContent className="flex-1 p-4">
                        <h3 className="font-semibold truncate">
                          {product.name}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {product.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">₹{product.price}</p>
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                addToWishlistMutation.mutate(product.id);
                              }}
                              disabled={addToWishlistMutation.isPending}
                            >
                              <Heart className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                addToCartMutation.mutate(product.id);
                              }}
                              disabled={
                                !product.isAvailable ||
                                product.stock <= 0 ||
                                addToCartMutation.isPending
                              }
                            >
                              <ShoppingCart className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
            {productsResponse?.hasMore ? (
              <p className="text-sm text-muted-foreground mt-6">
                Showing the first {productsResponse.pageSize} matches. Refine
                your filters to narrow the results further.
              </p>
            ) : null}
          </>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
