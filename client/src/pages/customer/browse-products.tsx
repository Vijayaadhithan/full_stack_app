import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { LayoutGroup, motion } from "framer-motion";
import { Search, ShoppingCart, Heart, Filter, Plus } from "lucide-react";
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

  const imageRefs = useRef<Record<number, HTMLImageElement | null>>({});

  const triggerFlyToCart = useCallback((image?: HTMLImageElement | null) => {
    if (typeof document === "undefined" || !image) return;
    const cartIcon = document.querySelector(
      "[data-cart-icon]",
    ) as HTMLElement | null;
    if (!cartIcon) return;

    const imgRect = image.getBoundingClientRect();
    const cartRect = cartIcon.getBoundingClientRect();
    const ghost = image.cloneNode(true) as HTMLImageElement;
    ghost.style.position = "fixed";
    ghost.style.top = `${imgRect.top}px`;
    ghost.style.left = `${imgRect.left}px`;
    ghost.style.width = `${imgRect.width}px`;
    ghost.style.height = `${imgRect.height}px`;
    ghost.style.borderRadius = "16px";
    ghost.style.zIndex = "9999";
    ghost.style.boxShadow = "0 15px 45px rgba(0,0,0,0.25)";
    ghost.style.pointerEvents = "none";
    document.body.appendChild(ghost);

    const translateX = cartRect.left - imgRect.left;
    const translateY = cartRect.top - imgRect.top;

    const animation = ghost.animate(
      [
        { transform: "translate(0px, 0px) scale(1)", opacity: 0.9 },
        {
          transform: `translate(${translateX}px, ${translateY}px) scale(0.2)`,
          opacity: 0.3,
        },
      ],
      { duration: 650, easing: "ease-in-out" },
    );

    animation.onfinish = () => ghost.remove();
  }, []);

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
        title: "Error fetching products",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [error, toast]);

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
        title: "Added to cart",
        description: `${product.name} has been added to your cart.`,
      });
    },
    onError: (error: Error, _product, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(["/api/cart"], context.previousCart);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to add product to cart",
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
        title: "Added to wishlist",
        description: `${product.name} has been added to your wishlist.`,
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
        title: "Error",
        description: error.message || "Failed to add product to wishlist",
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
      <LayoutGroup>
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6"
        >
          <div className="sticky top-[76px] z-30 space-y-3">
            <motion.div
              layout
              className="rounded-3xl border bg-background/90 px-4 py-4 shadow-sm backdrop-blur md:px-6 md:py-5 supports-[backdrop-filter]:bg-background/80"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Shop smarter
                  </p>
                  <h1 className="text-2xl font-bold leading-tight">
                    Masonry view of products
                  </h1>
                </div>
                <div className="text-sm text-muted-foreground">
                  {filteredProducts.length
                    ? `${filteredProducts.length} products`
                    : "No matches yet"}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 items-center md:grid-cols-[1.6fr_1fr_1fr_1fr]">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
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
                  <SelectTrigger className="w-full">
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
                <LocationFilterPopover state={locationFilter} />
              </div>
            </motion.div>
            <div className="rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">
              {locationFilter.location ? (
                <>
                  Showing products from shops within{" "}
                  <span className="font-semibold">{locationFilter.radius} km</span>{" "}
                  of{" "}
                  <span className="font-mono">
                    {locationFilter.location.latitude.toFixed(3)},{" "}
                    {locationFilter.location.longitude.toFixed(3)}
                  </span>
                  .
                </>
              ) : (
                <>Set a location filter to hide shops that are too far away.</>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="columns-1 gap-6 sm:columns-2 xl:columns-3 [column-fill:_balance]">
              {Array.from({ length: 8 }).map((_, index) => (
                <Card
                  key={index}
                  className="mb-6 break-inside-avoid shadow-sm"
                  style={{ breakInside: "avoid" }}
                >
                  <div className="aspect-[4/5] relative overflow-hidden">
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
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="columns-1 gap-6 space-y-6 sm:columns-2 xl:columns-3 [column-fill:_balance]"
              >
                {filteredProducts.map((product) => (
                  <motion.div
                    key={product.id}
                    variants={item}
                    layout
                    className="mb-6 break-inside-avoid"
                    style={{ breakInside: "avoid" }}
                  >
                    <Link
                      href={`/customer/shops/${product.shopId}/products/${product.id}`}
                      className="block h-full"
                    >
                      <Card className="h-full overflow-hidden shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                        <div className="relative overflow-hidden rounded-2xl">
                          <motion.img
                            ref={(node) => {
                              imageRefs.current[product.id] = node;
                            }}
                            layoutId={`product-${product.id}-image`}
                            src={
                              product.images?.[0] ||
                              "https://via.placeholder.com/400"
                            }
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                          <motion.button
                            whileTap={{ scale: 0.94 }}
                            className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-primary shadow-lg backdrop-blur hover:bg-primary hover:text-white"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              triggerFlyToCart(imageRefs.current[product.id]);
                              addToCartMutation.mutate(product);
                            }}
                            disabled={
                              !product.isAvailable ||
                              product.stock <= 0 ||
                              addToCartMutation.isPending
                            }
                          >
                            <Plus className="h-4 w-4" />
                          </motion.button>
                          {product.mrp &&
                            parseFloat(product.mrp) > parseFloat(product.price) && (
                              <div className="absolute left-3 top-3 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white shadow">
                                {Math.round(
                                  ((parseFloat(product.mrp) -
                                    parseFloat(product.price)) /
                                    parseFloat(product.mrp)) *
                                    100,
                                )}
                                % OFF
                              </div>
                            )}
                        </div>
                        <CardContent className="flex flex-col gap-3 p-4">
                          <div className="space-y-1">
                            <h3 className="font-semibold leading-tight">
                              {product.name}
                            </h3>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {product.description}
                            </p>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-lg font-semibold">
                              ₹{product.price}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  addToWishlistMutation.mutate(product);
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
                                  triggerFlyToCart(imageRefs.current[product.id]);
                                  addToCartMutation.mutate(product);
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
              </motion.div>
              {productsResponse?.hasMore ? (
                <p className="text-sm text-muted-foreground mt-6">
                  Showing the first {productsResponse.pageSize} matches. Refine
                  your filters to narrow the results further.
                </p>
              ) : null}
            </>
          )}
        </motion.div>
      </LayoutGroup>
    </DashboardLayout>
  );
}
