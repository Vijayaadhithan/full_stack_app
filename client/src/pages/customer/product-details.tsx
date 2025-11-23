import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ProductReview } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useParams, Link } from "wouter";
import { ShoppingCart, Heart, ArrowLeft, Store, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Meta from "@/components/meta";
import { ProductDetail } from "@shared/api-contract";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/hooks/use-auth";
import type { PublicShop } from "@/types/public-shop";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useLocation } from "wouter";
const MotionButton = motion(Button);

export default function ProductDetails() {
  const { toast } = useToast();
  const params = useParams();
  const shopId = params.shopId ? parseInt(params.shopId) : undefined;
  const productId = params.productId ? parseInt(params.productId) : undefined;
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [showFloatingBar, setShowFloatingBar] = useState(false);

  const { data: product, isLoading: isLoadingProduct } = useQuery<ProductDetail>({
    queryKey: [`/api/shops/${shopId}/products/${productId}`],
    queryFn: () => {
      if (shopId === undefined || productId === undefined) {
        throw new Error("Missing product context");
      }
      return apiClient.get("/api/shops/:shopId/products/:productId", {
        params: {
          shopId,
          productId,
        },
      });
    },
    enabled: !!shopId && !!productId,
  });

  const { data: shop, isLoading: isLoadingShop } = useQuery<PublicShop>({
    queryKey: [`/api/shops/${shopId}`],
    enabled: !!shopId,
  });

  useEffect(() => {
    const handleScroll = () => {
      setShowFloatingBar(window.scrollY > 260);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const enableReviews = Boolean(productId && user);
  const {
    data: reviewsData,
    isLoading: isLoadingReviews,
  } = useQuery<ProductReview[]>({
    queryKey: [`/api/reviews/product/${productId}`],
    enabled: enableReviews,
  });
  const reviews = reviewsData ?? [];

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((total, review) => total + review.rating, 0) /
        reviews.length
      : null;

  type CartItem = {
    product: ProductDetail;
    quantity: number;
  };

  const addToCartMutation = useMutation<
    unknown,
    Error,
    ProductDetail,
    { previousCart?: CartItem[] }
  >({
    mutationFn: async (product) => {
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
    onSuccess: () => {
      toast({
        title: "Added to cart",
        description: "Product has been added to your cart.",
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
    ProductDetail,
    { previousWishlist: ProductDetail[] }
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
        queryClient.getQueryData<ProductDetail[]>(["/api/wishlist"]) ?? [];

      if (!previousWishlist.find((item) => item.id === product.id)) {
        queryClient.setQueryData<ProductDetail[]>(["/api/wishlist"], [
          ...previousWishlist,
          product,
        ]);
      }

      return { previousWishlist };
    },
    onSuccess: () => {
      toast({
        title: "Added to wishlist",
        description: "Product has been added to your wishlist.",
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

  const galleryImages = useMemo(
    () =>
      product?.images?.length
        ? product.images
        : ["https://via.placeholder.com/600"],
    [product?.images],
  );
  const primaryImage = galleryImages[0];
  const handleBuyNow = () => {
    addToCartMutation.mutate(product, {
      onSuccess: () => navigate("/customer/cart"),
    });
  };

  if (isLoadingProduct || isLoadingShop) {
    return (
      <DashboardLayout>
        <Meta title="Loading Product..." />
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
          <Skeleton className="h-9 w-48" />
          <Card>
            <CardHeader className="space-y-3">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <Skeleton className="aspect-square rounded-lg" />
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-3 pt-4">
                  <Skeleton className="h-11 flex-1 rounded-md" />
                  <Skeleton className="h-11 w-12 rounded-md" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!product || !shop) {
    return (
      <DashboardLayout>
        <Meta title="Product Not Found" />
        <div className="text-center py-10">
          <p>Product or Shop not found.</p>
          <Link href="/customer/browse-products">
            <Button variant="link" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Products
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Meta
        title={`${product.name} - ${shop.shopProfile?.shopName || shop.name}`}
        description={`View details and buy ${product.name} from ${shop.shopProfile?.shopName || shop.name}.`}
        schema={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.description,
          image: product.images?.[0],
          offers: {
            "@type": "Offer",
            priceCurrency: "INR",
            price: product.price,
          },
        }}
      />
      <LayoutGroup>
        <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <Link href="/customer/browse-products">
              <MotionButton variant="outline" size="sm" whileTap={{ scale: 0.95 }}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Products
              </MotionButton>
            </Link>
            <Link href={`/customer/shops/${shop.id}`}>
              <MotionButton variant="outline" size="sm" whileTap={{ scale: 0.95 }}>
                <Store className="mr-2 h-4 w-4" /> Visit Shop
              </MotionButton>
            </Link>
          </div>

          <section className="space-y-3">
            <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory rounded-3xl border bg-muted/40 p-2 md:hidden">
              {galleryImages.map((image, index) => (
                <motion.img
                  key={image + index}
                  layoutId={index === 0 ? `product-${product.id}-image` : undefined}
                  src={image}
                  alt={`${product.name} ${index + 1}`}
                  className="h-72 w-[85vw] flex-shrink-0 snap-center rounded-2xl object-cover"
                />
              ))}
            </div>
            <div className="hidden gap-4 rounded-3xl border bg-muted/40 p-4 md:grid md:grid-cols-[2fr_1fr]">
              <motion.img
                layoutId={`product-${product.id}-image`}
                src={primaryImage}
                alt={product.name}
                className="h-full w-full rounded-2xl object-cover"
              />
              <div className="grid grid-cols-2 gap-3">
                {galleryImages.slice(1, 5).map((image, index) => (
                  <motion.img
                    key={image + index}
                    src={image}
                    alt={`${product.name} ${index + 2}`}
                    className="h-full w-full rounded-xl object-cover"
                  />
                ))}
              </div>
            </div>
          </section>

          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-2xl md:text-3xl">
                    {product.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Sold by{" "}
                    <Link
                      href={`/customer/shops/${shop.id}`}
                      className="text-primary hover:underline"
                    >
                      {shop.shopProfile?.shopName || shop.name}
                    </Link>
                  </CardDescription>
                </div>
                {averageRating !== null && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    {averageRating.toFixed(1)} ({reviews?.length})
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-[2fr_1fr]">
              <div className="space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  {product.description}
                </p>
                {product.category && (
                  <p className="text-sm text-muted-foreground">
                    Category: {product.category}
                  </p>
                )}
                <div className="rounded-xl border bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Availability
                  </p>
                  <p
                    className={`text-sm font-semibold ${product.isAvailable && product.stock > 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {product.isAvailable && product.stock > 0
                      ? `In Stock (${product.stock} available)`
                      : "Out of Stock"}
                  </p>
                </div>
              </div>
              <div className="space-y-4 rounded-2xl border bg-muted/40 p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Price</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">₹{product.price}</span>
                    {product.mrp && product.price < product.mrp && (
                      <span className="text-sm text-muted-foreground line-through">
                        ₹{product.mrp}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <MotionButton
                    size="lg"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => addToCartMutation.mutate(product)}
                    disabled={
                      !product.isAvailable ||
                      product.stock <= 0 ||
                      addToCartMutation.isPending
                    }
                    className="flex-1"
                  >
                    <ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart
                  </MotionButton>
                  <MotionButton
                    size="lg"
                    variant="outline"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => addToWishlistMutation.mutate(product)}
                    disabled={addToWishlistMutation.isPending}
                  >
                    <Heart className="h-5 w-5" />
                  </MotionButton>
                </div>
                <MotionButton
                  whileTap={{ scale: 0.95 }}
                  size="lg"
                  className="w-full"
                  onClick={handleBuyNow}
                  disabled={
                    !product.isAvailable ||
                    product.stock <= 0 ||
                    addToCartMutation.isPending
                  }
                >
                  Buy Now
                </MotionButton>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-500" />
                Ratings & Reviews
              </CardTitle>
              <CardDescription>
                {averageRating !== null
                  ? `${averageRating.toFixed(1)} out of 5 • ${reviews.length} review${
                      reviews.length !== 1 ? "s" : ""
                    }`
                  : enableReviews
                    ? "No reviews yet"
                    : "Sign in to view customer reviews"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!enableReviews && (
                <p className="text-sm text-muted-foreground">
                  Sign in to view customer reviews.
                </p>
              )}
              {enableReviews ? (
                isLoadingReviews ? (
                  <div className="space-y-3 py-2">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={index}
                        className="rounded-lg border p-4 space-y-2 bg-muted/30"
                      >
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : reviews.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Customers haven’t reviewed this product yet.
                  </p>
                ) : (
                  reviews.map((review) => (
                    <div
                      key={review.id}
                      className="rounded-lg border p-4 space-y-2 bg-muted/30"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <Star
                              key={index}
                              className={`h-4 w-4 ${
                                index < review.rating
                                  ? "fill-yellow-400 text-yellow-500"
                                  : "text-muted-foreground"
                              }`}
                            />
                          ))}
                        </div>
                        {review.createdAt && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {review.review ? (
                        <p className="text-sm text-muted-foreground">
                          {review.review}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No written feedback provided.
                        </p>
                      )}
                      {review.shopReply && (
                        <div className="rounded-md bg-background/80 border border-dashed p-3 text-sm">
                          <p className="font-medium">Shop reply</p>
                          <p className="text-muted-foreground mt-1">
                            {review.shopReply}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )
              ) : null}
            </CardContent>
          </Card>
        </div>

        <AnimatePresence>
          {showFloatingBar && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="fixed bottom-4 left-4 right-4 z-40 md:hidden"
            >
              <Card className="border-primary/30 shadow-2xl backdrop-blur">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Buy now</p>
                    <p className="text-xl font-bold">₹{product.price}</p>
                  </div>
                  <MotionButton
                    whileTap={{ scale: 0.95 }}
                    size="lg"
                    onClick={handleBuyNow}
                    disabled={
                      !product.isAvailable ||
                      product.stock <= 0 ||
                      addToCartMutation.isPending
                    }
                  >
                    Buy Now
                  </MotionButton>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </LayoutGroup>
    </DashboardLayout>
  );
}
