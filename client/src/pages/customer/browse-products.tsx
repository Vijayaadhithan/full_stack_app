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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLocationFilter } from "@/hooks/use-location-filter";
import { LocationFilterPopover } from "@/components/location/location-filter-popover";
import { useLanguage } from "@/contexts/language-context";

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
  const { t } = useLanguage();
  const locationFilter = useLocationFilter({ storageKey: "products-radius" });
  const locationQuery = locationFilter.location
    ? {
        lat: locationFilter.location.latitude,
        lng: locationFilter.location.longitude,
        radius: locationFilter.radius,
      }
    : null;

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
  const quickCategories = productFilterConfig.categories.slice(0, 4);

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
  stock: number | null;
  catalogModeEnabled?: boolean;
  openOrderMode?: boolean;
  allowPayLater?: boolean;
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
    queryKey: [
      "/api/products",
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
        title: t("products_load_failed_title"),
        description: error.message || t("products_load_failed_description"),
        variant: "destructive",
      });
    }
  }, [error, toast, t]);

  type CartItem = {
    product: ProductListItem;
    quantity: number;
  };

  const addToCartMutation = useMutation<
    unknown,
    Error,
    ProductListItem,
    { previousCart?: CartItem[] }
  >({
    mutationFn: async (product: ProductListItem) => {
      const productId = product.id;
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
    onMutate: async (product) => {
      await queryClient.cancelQueries({ queryKey: ["/api/cart"] });
      const previousCart = queryClient.getQueryData<CartItem[]>(["/api/cart"]);

      const existingItem = previousCart?.find(
        (item) => item.product.id === product.id,
      );
      const optimisticCart = previousCart
        ? existingItem
          ? previousCart.map((item) =>
              item.product.id === product.id
                ? { ...item, quantity: item.quantity + 1 }
                : item,
            )
          : [...previousCart, { product, quantity: 1 }]
        : [{ product, quantity: 1 }];

      queryClient.setQueryData(["/api/cart"], optimisticCart);
      return { previousCart };
    },
    onSuccess: (_data, product) => {
      toast({
        title: t("added_to_cart_title"),
        description: t("added_to_cart_item").replace("{product}", product.name),
      });
    },
    onError: (error: Error, _product, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(["/api/cart"], context.previousCart);
      }
      toast({
        title: t("add_to_cart_failed_title"),
        description: error.message || t("add_to_cart_failed_description"),
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
  });

  const addToWishlistMutation = useMutation<
    unknown,
    Error,
    ProductListItem,
    { previousWishlist: ProductListItem[] }
  >({
    mutationFn: async (product: ProductListItem) => {
      const res = await apiRequest("POST", "/api/wishlist", {
        productId: product.id,
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }
      return res.json();
    },
    onMutate: async (product) => {
      await queryClient.cancelQueries({ queryKey: ["/api/wishlist"] });
      const previousWishlist =
        queryClient.getQueryData<ProductListItem[]>(["/api/wishlist"]) ?? [];

      if (previousWishlist.some((item) => item.id === product.id)) {
        return { previousWishlist };
      }

      queryClient.setQueryData<ProductListItem[]>(["/api/wishlist"], [
        ...previousWishlist,
        product,
      ]);

      return { previousWishlist };
    },
    onSuccess: (_data, product) => {
      toast({
        title: t("added_to_wishlist_title"),
        description: t("added_to_wishlist_item").replace("{product}", product.name),
      });
    },
    onError: (error: Error, _product, context) => {
      if (context?.previousWishlist) {
        queryClient.setQueryData(
          ["/api/wishlist"],
          context.previousWishlist,
        );
      }
      toast({
        title: t("wishlist_add_failed_title"),
        description: error.message || t("wishlist_add_failed_description"),
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist"] });
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
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{t("browse_products_title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("browse_products_subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" className="h-11 px-4">
              {t("products")}
            </Button>
            <Button asChild variant="outline" className="h-11 px-4">
              <Link href="/customer/browse-shops">{t("browse_shops")}</Link>
            </Button>
          </div>
        </div>

        <Card className="border-0 bg-gradient-to-br from-amber-50 via-white to-slate-50 shadow-sm">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder={t("browse_products_search_placeholder")}
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
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder={t("product_category")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all_categories")}</SelectItem>
                  {productFilterConfig.categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                      <Label htmlFor="minPrice">{t("min_price_label")}</Label>
                      <Input
                        id="minPrice"
                        type="number"
                        placeholder={t("min_price_placeholder")}
                        value={filters.minPrice}
                        onChange={(e) =>
                          handleFilterChange("minPrice", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxPrice">{t("max_price_label")}</Label>
                      <Input
                        id="maxPrice"
                        type="number"
                        placeholder={t("max_price_placeholder")}
                        value={filters.maxPrice}
                        onChange={(e) =>
                          handleFilterChange("maxPrice", e.target.value)
                        }
                      />
                    </div>
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
                <LocationFilterPopover state={locationFilter} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("quick_categories")}
              </span>
              <Button
                type="button"
                size="sm"
                variant={filters.category === "all" ? "secondary" : "outline"}
                onClick={() => handleFilterChange("category", "all")}
              >
                {t("all")}
              </Button>
              {quickCategories.map((category) => (
                <Button
                  key={category.value}
                  type="button"
                  size="sm"
                  variant={
                    filters.category === category.value ? "secondary" : "outline"
                  }
                  onClick={() => handleFilterChange("category", category.value)}
                >
                  {category.label}
                </Button>
              ))}
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              {locationFilter.location
                ? t("products_location_within")
                    .replace("{radius}", String(locationFilter.radius))
                    .replace(
                      "{lat}",
                      locationFilter.location.latitude.toFixed(3),
                    )
                    .replace(
                      "{lng}",
                      locationFilter.location.longitude.toFixed(3),
                    )
                : t("products_location_empty")}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Card key={index} className="h-full">
                <div className="aspect-square relative overflow-hidden">
                  <Skeleton className="h-full w-full" />
                </div>
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-16" />
                    <div className="flex gap-2">
                      <Skeleton className="h-10 w-10 rounded-md" />
                      <Skeleton className="h-10 w-10 rounded-md" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
	              {filteredProducts.map((product) => {
	                const openOrderAllowed = Boolean(
	                  product.openOrderMode || product.catalogModeEnabled,
	                );
	                const stockCount = Number(product.stock ?? 0);
	                const outOfStock = stockCount <= 0 && !openOrderAllowed;
                return (
                  <motion.div
                    key={product.id}
                    variants={item}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <Link
                      href={`/customer/shops/${product.shopId}/products/${product.id}`}
                    >
                      <Card className="h-full flex flex-col cursor-pointer overflow-hidden rounded-2xl border bg-white/80 shadow-sm transition-shadow duration-200 hover:shadow-lg">
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
                            {product.description || t("product_description_fallback")}
                          </p>
                          <div className="flex items-center justify-between">
                            <p className="text-lg font-semibold">₹{product.price}</p>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                addToWishlistMutation.mutate(product);
                              }}
                              disabled={addToWishlistMutation.isPending}
                            >
                              <Heart className="h-4 w-4 mr-1" />
                              {t("save_item")}
                            </Button>
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                addToCartMutation.mutate(product);
                              }}
                              disabled={
                                !product.isAvailable ||
                                outOfStock ||
                                addToCartMutation.isPending
                              }
                            >
                              <ShoppingCart className="h-4 w-4 mr-1" />
                              {t("add_to_cart_button")}
                            </Button>
                          </div>
                          {!product.isAvailable ? (
                            <p className="text-xs text-rose-600 mt-2">
                              {t("product_unavailable")}
                            </p>
                          ) : null}
                          {outOfStock ? (
                            <p className="text-xs text-rose-600 mt-2">
                              {t("product_out_of_stock")}
                            </p>
                          ) : null}
	                          {stockCount <= 0 && openOrderAllowed ? (
	                            <p className="text-xs text-amber-700 mt-1">
	                              {t("product_available_on_request")}
	                            </p>
	                          ) : null}
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
            {productsResponse?.hasMore ? (
              <p className="text-sm text-muted-foreground mt-6">
                {t("products_pagination_hint").replace(
                  "{count}",
                  String(productsResponse.pageSize),
                )}
              </p>
            ) : null}
          </>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
