import React, { useMemo, useRef, useState } from "react";
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
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Search,
  ShoppingCart,
  Heart,
  Store,
  MapPin,
  ArrowLeft,
} from "lucide-react";
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
  const bannerRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const bannerBlur = useTransform(scrollY, [0, 220], ["blur(0px)", "blur(12px)"]);
  const bannerOpacity = useTransform(scrollY, [0, 220], [1, 0.7]);
  const titleScale = useTransform(scrollY, [0, 220], [1, 0.9]);

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

  const promotions = useMemo(() => {
    if (!shop) return [];
    const direct = (shop as unknown as { promotions?: { id: number; title: string; imageUrl?: string }[] }).promotions;
    const profilePromos =
      (shop.shopProfile as unknown as { promotions?: { id: number; title: string; imageUrl?: string }[] } | null | undefined)?.promotions;
    return (
      direct ||
      profilePromos || [
        {
          id: 1,
          title: "New Drop",
          imageUrl: shop.shopBannerImageUrl ?? undefined,
        },
        {
          id: 2,
          title: "Bestsellers",
          imageUrl: shop.shopLogoImageUrl ?? undefined,
        },
        {
          id: 3,
          title: "Seasonal Picks",
          imageUrl: undefined,
        },
      ]
    );
  }, [shop]);

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
        <motion.div
          ref={bannerRef}
          className="relative mb-6 overflow-hidden rounded-3xl border bg-muted/40"
        >
          <motion.div
            className="absolute inset-0"
            style={{ filter: bannerBlur, opacity: bannerOpacity }}
          >
            <img
              src={
                shop.shopBannerImageUrl ||
                "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1400&q=80"
              }
              alt={shop.shopProfile?.shopName ?? shop.name ?? "Shop banner"}
              className="h-full w-full object-cover"
            />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/30 to-background" />
          <div className="relative z-10 flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center border border-white/30">
                {shop.profilePicture ? (
                  <img
                    src={shop.profilePicture}
                    alt={shop.shopProfile?.shopName || shop.name || "Shop"}
                    className="h-full w-full rounded-2xl object-cover"
                  />
                ) : (
                  <Store className="h-10 w-10 text-white" />
                )}
              </div>
              <div>
                <motion.h1
                  style={{ scale: titleScale }}
                  className="text-3xl font-bold text-white drop-shadow"
                >
                  {shop.shopProfile?.shopName ?? shop.name}
                </motion.h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-white/80">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {formatAddress(shop)}
                  </span>
                  <MapLink latitude={shop.latitude} longitude={shop.longitude} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-white backdrop-blur">
              <Store className="h-4 w-4" />
              <span className="text-sm">Returns {shop.returnsEnabled ? "enabled" : "policy applies"}</span>
            </div>
          </div>
        </motion.div>

        <div className="mb-8 overflow-hidden rounded-2xl border bg-background/80 p-3 shadow-sm">
          <p className="px-2 text-sm font-semibold text-muted-foreground">
            Promotions
          </p>
          <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
            {promotions.map((promo) => (
              <motion.div
                key={promo.id}
                whileHover={{ y: -4 }}
                className="flex w-20 flex-col items-center gap-2"
              >
                <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-primary/60 bg-muted">
                  {promo.imageUrl ? (
                    <img
                      src={promo.imageUrl}
                      alt={promo.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Store className="m-auto h-6 w-6 text-primary" />
                  )}
                </div>
                <span className="text-center text-xs font-medium">
                  {promo.title}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

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
              {filteredProducts.map((product) => (
                <motion.div key={product.id} variants={item}>
                  <Link
                    href={`/customer/shops/${product.shopId}/products/${product.id}`}
                    className="block h-full"
                  >
                    <Card className="h-full flex flex-col overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
                      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-muted to-muted/40">
                        <img
                          src={
                            product.images?.[0] ||
                            "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80"
                          }
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
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
                        {!product.isAvailable && (
                          <div className="absolute inset-0 grid place-items-center bg-black/40 text-sm font-semibold text-white">
                            Out of stock
                          </div>
                        )}
                      </div>
                      <CardContent className="flex flex-1 flex-col gap-3 p-4">
                        <div className="space-y-1">
                          <h3 className="font-semibold line-clamp-1">
                            {product.name}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {product.description ?? "No description"}
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-baseline gap-2">
                            <p className="text-lg font-semibold">
                              ₹{product.price}
                            </p>
                            {product.mrp &&
                              parseFloat(product.mrp) > parseFloat(product.price) && (
                                <span className="text-xs text-muted-foreground line-through">
                                  ₹{product.mrp}
                                </span>
                              )}
                          </div>
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
          )}
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
