import React from 'react';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import MapLink from "@/components/location/MapLink";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Search,
  ShoppingCart,
  Heart,
  Store,
  MapPin,
  ArrowLeft,
} from "lucide-react";
import { useState } from "react";
import { useParams, Link } from "wouter";
import Meta from "@/components/meta";
import type { PublicShop } from "@/types/public-shop";
// Helper function to format address
const formatAddress = (user: PublicShop | undefined): string => {
  if (!user) return "Location not specified";
  const parts = [
    user.addressStreet,
    user.addressCity,
    user.addressState,
    user.addressPostalCode,
    user.addressCountry,
  ].filter(Boolean); // Filter out null/undefined/empty strings
  return parts.length > 0 ? parts.join(", ") : "Location not specified";
};

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

type ShopProductListItem = {
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
  catalogModeEnabled?: boolean;
  openOrderMode?: boolean;
  allowPayLater?: boolean;
};

type ShopProductListResponse = {
  page: number;
  pageSize: number;
  hasMore: boolean;
  items: ShopProductListItem[];
};

type CartItem = {
  product: ShopProductListItem;
  quantity: number;
};

export default function ShopDetails() {
  const { id } = useParams<{ id: string }>();
  console.log("ShopDetails component - Shop ID from params:", id);
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const {
    data: shop,
    isLoading: shopLoading,
    isError: isShopError,
    error: shopError,
  } = useQuery<PublicShop, Error>({
    queryKey: [`/api/shops/${id}`],
    queryFn: async () => {
      if (!id) {
        throw new Error("Missing shop id");
      }
      const res = await apiRequest("GET", `/api/shops/${id}`);
      if (!res.ok) {
        throw new Error("Failed to fetch shop details");
      }
      const data = await res.json();
      console.log("Successfully fetched shop data:", data);
      return data;
    },
    enabled: !!id,
  });

  if (isShopError) {
    console.error("Error fetching shop:", shopError);
    console.error("Query key:", [`/api/shops/${id}`]);
    // Optionally show a toast or specific error message here
  }

  const {
    data: productsResponse,
    isLoading: productsLoading,
    isError: isProductsError,
    error: productsError,
  } = useQuery<ShopProductListResponse, Error>({
    queryKey: ["/api/products", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Missing shop id");
      }
      const params = new URLSearchParams({
        shopId: id,
        pageSize: "100",
      });
      const res = await apiRequest(
        "GET",
        `/api/products?${params.toString()}`,
      );
      if (!res.ok) {
        throw new Error("Failed to fetch shop products");
      }
      const data = await res.json();
      console.log("Successfully fetched shop products:", data);
      return data;
    },
    enabled: !!id,
  });

  if (isProductsError) {
    console.error("Error fetching shop products:", productsError);
    // Optionally show a toast or specific error message here
  }

  const addToCartMutation = useMutation<
    unknown,
    Error,
    ShopProductListItem,
    { previousCart?: CartItem[] }
  >({
    mutationFn: async (product) => {
      const res = await apiRequest("POST", "/api/cart", {
        productId: product.id,
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
      let description = error.message || "Failed to add product to cart";
      if (error.message.includes("Cannot add items from different shops")) {
        description =
          "You can only add items from one shop at a time. Please clear your cart or checkout first.";
      }
      toast({
        title: "Error Adding to Cart",
        description: description,
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
    ShopProductListItem,
    { previousWishlist: ShopProductListItem[] }
  >({
    mutationFn: async (product) => {
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
        queryClient.getQueryData<ShopProductListItem[]>(["/api/wishlist"]) ??
        [];

      if (!previousWishlist.find((item) => item.id === product.id)) {
        queryClient.setQueryData<ShopProductListItem[]>(["/api/wishlist"], [
          ...previousWishlist,
          product,
        ]);
      }

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

  const products = productsResponse?.items ?? [];
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  const filteredProducts =
    products?.filter((product) => {
      const productCategory = product.category?.toLowerCase() ?? "";
      const matchesCategory =
        selectedCategory === "all" ||
        productCategory === selectedCategory.toLowerCase();

      if (!matchesCategory) return false;

      if (queryTokens.length === 0) return true;

      const searchableText = `${product.name} ${product.description ?? ""}`.toLowerCase();
      return queryTokens.every((token) => searchableText.includes(token));
    }) ?? []; // Provide default empty array if products is undefined

  const isLoading = shopLoading || productsLoading;

  if (isLoading) {
    return (
      <DashboardLayout>
        <Meta title="Loading Shop..." />
        <div className="max-w-7xl mx-auto space-y-6 p-6">
          <Skeleton className="h-6 w-28" />
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <Skeleton className="h-24 w-24 rounded-lg" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-7 w-64" />
                  <Skeleton className="h-4 w-80" />
                  <Skeleton className="h-4 w-56" />
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex gap-4 w-full md:w-auto">
            <Skeleton className="h-10 flex-1 md:w-80" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Card key={index} className="h-full">
                <div className="aspect-square">
                  <Skeleton className="h-full w-full" />
                </div>
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <div className="flex items-center justify-between pt-2">
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
        </div>
      </DashboardLayout>
    );
  }

  if (!shop) {
    return (
      <DashboardLayout>
        <Meta title="Shop Not Found" />
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <h2 className="text-2xl font-bold mb-4">Shop not found</h2>
          <Link href="/customer/browse-shops">
            <Button>Back to Shops</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Meta
        title={`${shop.shopProfile?.shopName || shop.name} - Shop`}
        description={`Explore products available from ${shop.shopProfile?.shopName || shop.name}.`}
        schema={{
          "@context": "https://schema.org",
          "@type": "Store",
          name: shop.shopProfile?.shopName || shop.name,
          image: shop.profilePicture,
          address: formatAddress(shop),
        }}
      />
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-7xl mx-auto space-y-6 p-6"
      >
        <Link href="/customer/browse-shops">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Shops
          </Button>
        </Link>

        {/* Shop Header */}
        <Card className="mb-8">
          <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="h-24 w-24 rounded-lg bg-primary/10 flex items-center justify-center">
                    {shop.profilePicture ? (
                      <img
                        src={shop.profilePicture}
                        alt={shop.shopProfile?.shopName || shop.name || "Shop"}
                        className="h-full w-full rounded-lg object-cover"
                      />
                ) : (
                  <Store className="h-12 w-12 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">
                  {shop.shopProfile?.shopName ?? shop.name}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-muted-foreground mt-1">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {formatAddress(shop)}
                  </span>
                  <MapLink
                    latitude={shop.latitude}
                    longitude={shop.longitude}
                  />
                </div>
                <p className="mt-4">
                  {shop.shopProfile?.description ?? "No description available"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/customer/shops/${shop.id}/quick-order`}>
                    <Button>Quick Order</Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products Section */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <h2 className="text-xl font-semibold">Products</h2>
            <div className="flex gap-4 w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={selectedCategory}
                onValueChange={(value) => setSelectedCategory(value)}
              >
                <SelectTrigger className="w-40">
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
            </div>
          </div>

          {!filteredProducts?.length ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">No products found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => {
                const openOrderAllowed = Boolean(
                  product.openOrderMode || product.catalogModeEnabled,
                );
                const outOfStock =
                  product.stock <= 0 && !openOrderAllowed;
                return (
                  <motion.div key={product.id} variants={item}>
                    <Link
                      href={`/customer/shops/${product.shopId}/products/${product.id}`}
                      className="block h-full"
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
                          {product.mrp &&
                            parseFloat(product.mrp) > parseFloat(product.price) && (
                              <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold">
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
                        <CardContent className="flex-1 p-4">
                          <h3 className="font-semibold truncate">{product.name}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {product.description ?? "No description"}
                          </p>
                          <div className="flex items-center justify-between">
                            <p className="font-semibold">₹{product.price}</p>
                            <div className="flex gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  addToWishlistMutation.mutate(product);
                                }}
                                disabled={addToWishlistMutation.isPending}
                              >
                                <Heart className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  addToCartMutation.mutate(product);
                                }}
                                disabled={
                                  !product.isAvailable ||
                                  outOfStock ||
                                  addToCartMutation.isPending
                                }
                              >
                                <ShoppingCart className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {product.stock <= 0 && openOrderAllowed && (
                            <p className="text-xs text-amber-700 mt-1">
                              Available on request. The shop will confirm availability.
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
