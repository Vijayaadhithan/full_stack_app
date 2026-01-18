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
import { useLanguage } from "@/contexts/language-context";
import { CategoryIcon } from "@/components/ui/category-icon";
import { getProductImage } from "@shared/predefinedImages";

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
  stock: number | null;
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
  const { toast } = useToast();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const formatAddress = (user?: PublicShop): string => {
    if (!user) return t("location_not_specified");
    const parts = [
      user.addressStreet,
      user.addressCity,
      user.addressState,
      user.addressPostalCode,
      user.addressCountry,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : t("location_not_specified");
  };

  const {
    data: shop,
    isLoading: shopLoading,
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
      return data;
    },
    enabled: !!id,
  });



  const {
    data: productsResponse,
    isLoading: productsLoading,
  } = useQuery<ShopProductListResponse, Error>({
    queryKey: ["/api/products", shop?.id],
    queryFn: async () => {
      if (!shop?.id) {
        throw new Error("Missing shop id");
      }
      const params = new URLSearchParams({
        shopId: String(shop.id),
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
      return data;
    },
    enabled: !!shop?.id,
  });



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
        title: t("added_to_cart_title"),
        description: t("added_to_cart_item").replace("{product}", product.name),
      });
    },
    onError: (error: Error, _product, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(["/api/cart"], context.previousCart);
      }
      let description = error.message || t("add_to_cart_failed_description");
      if (error.message.includes("Cannot add items from different shops")) {
        description =
          t("cart_single_shop_limit");
      }
      toast({
        title: t("add_to_cart_failed_title"),
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
          <h2 className="text-2xl font-bold mb-4">{t("shop_not_found")}</h2>
          <Link href="/customer/browse-shops">
            <Button>{t("back_to_shops")}</Button>
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
            {t("back_to_shops")}
          </Button>
        </Link>

        {/* Shop Header */}
        <Card className="mb-8 border-0 bg-gradient-to-br from-emerald-50 via-white to-slate-50 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="h-24 w-24 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden">
                {shop.profilePicture ? (
                  <img
                    src={shop.profilePicture}
                    alt={
                      shop.shopProfile?.shopName ||
                      shop.name ||
                      t("shop_alt_fallback")
                    }
                    className="h-full w-full object-cover"
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
                  {shop.shopProfile?.description ?? t("shop_description_fallback")}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/customer/shops/${shop.id}/quick-order`}>
                    <Button size="lg">{t("quick_order")}</Button>
                  </Link>
                  {shop.phone ? (
                    <Button asChild size="lg" variant="outline">
                      <a href={`tel:${shop.phone}`}>{t("call_shop")}</a>
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products Section */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <h2 className="text-xl font-semibold">{t("products")}</h2>
          </div>

          <Card className="border-0 bg-gradient-to-br from-slate-50 via-white to-emerald-50 shadow-sm">
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
              <div className="relative flex-1 md:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder={t("browse_products_search_placeholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={selectedCategory}
                onValueChange={(value) => setSelectedCategory(value)}
              >
                <SelectTrigger className="w-full md:w-44">
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
            </CardContent>
          </Card>

          {!filteredProducts?.length ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">{t("products_empty")}</p>
              </CardContent>
            </Card>
          ) : (
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
                      className="block h-full"
                    >
                      <Card className="h-full flex flex-col cursor-pointer overflow-hidden rounded-2xl border bg-white/80 shadow-sm transition-shadow duration-200 hover:shadow-lg">
                        <div className="aspect-square relative overflow-hidden flex items-center justify-center bg-gradient-to-br from-muted/30 to-muted/60">
                          <CategoryIcon
                            category={getProductImage(product.category || 'other')}
                            size="lg"
                            showLabel={false}
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
                            {product.description ?? t("product_description_fallback")}
                          </p>
                          <div className="flex items-center justify-between">
                            <p className="text-lg font-semibold">₹{product.price}</p>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                addToWishlistMutation.mutate(product);
                              }}
                              disabled={addToWishlistMutation.isPending}
                            >
                              <Heart className="h-4 w-4 mr-1" />
                              {t("save_item")}
                            </Button>
                            <Button
                              size="sm"
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
          )}
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
