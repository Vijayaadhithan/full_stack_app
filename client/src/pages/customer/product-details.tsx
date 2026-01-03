import React from 'react';
import { formatIndianDisplay } from "@shared/date-utils";
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
import { CategoryIcon, ProductCategoryBadge } from "@/components/ui/category-icon";
import { getProductImage } from "@shared/predefinedImages";

export default function ProductDetails() {
  const { toast } = useToast();
  const params = useParams();
  const shopId = params.shopId ? parseInt(params.shopId) : undefined;
  const productId = params.productId ? parseInt(params.productId) : undefined;
  const { user } = useAuth();

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
  const openOrderAllowed = Boolean(
    product?.openOrderMode || product?.catalogModeEnabled,
  );

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

  const stockCount = Number(product.stock ?? 0);
  const hasTrackedStock = typeof product.stock === "number";
  const isAvailable = product.isAvailable !== false;
  const inStock = isAvailable && hasTrackedStock && stockCount > 0;

  const availabilityLabel = !isAvailable
    ? "Out of Stock"
    : inStock
      ? `In Stock (${stockCount} available)`
      : openOrderAllowed
        ? "Available on request — shop will confirm availability"
        : "Out of Stock";
  const disableAddToCart =
    !isAvailable ||
    (!openOrderAllowed && stockCount <= 0) ||
    addToCartMutation.isPending;

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
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        <Link href="/customer/browse-products">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Products
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl md:text-3xl">
                  {product.name}
                </CardTitle>
                <CardDescription className="mt-1">
                  Sold by:{" "}
                  <Link
                    href={`/customer/shops/${shop.id}`}
                    className="text-primary hover:underline"
                  >
                    {shop.shopProfile?.shopName || shop.name}
                  </Link>
                </CardDescription>
              </div>
              <Link href={`/customer/shops/${shop.id}`}>
                <Button variant="outline" size="sm">
                  <Store className="mr-2 h-4 w-4" /> Visit Shop
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            <div className="aspect-square relative overflow-hidden rounded-lg border flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted">
              {(() => {
                const categoryImage = getProductImage(product.category || 'other');
                return (
                  <CategoryIcon
                    category={categoryImage}
                    size="xl"
                    showLabel={false}
                  />
                );
              })()}
            </div>
            <div className="space-y-4">
              <p className="text-muted-foreground">{product.description}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">₹{product.price}</span>
                {product.mrp && product.price < product.mrp && (
                  <span className="text-sm text-muted-foreground line-through">
                    ₹{product.mrp}
                  </span>
                )}
              </div>
              {averageRating !== null && (
                <div className="flex items-center gap-2 text-sm">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-500" />
                  <span>
                    {averageRating.toFixed(1)} out of 5 ({reviews?.length} reviews)
                  </span>
                </div>
              )}
              <p
                className={`text-sm font-medium ${inStock ? "text-green-600" : "text-amber-700"}`}
              >
                {availabilityLabel}
              </p>
              {!inStock && openOrderAllowed && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  Stock counts are not enforced for this shop. Add to cart and the shop owner will confirm availability.
                </p>
              )}
              {product.category && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Category:</span>
                  <ProductCategoryBadge category={getProductImage(product.category)} />
                </div>
              )}
              {/* Add more product details here if needed, e.g., specifications */}
              <div className="flex gap-3 pt-4">
                <Button
                  size="lg"
                  onClick={() => addToCartMutation.mutate(product)}
                  disabled={disableAddToCart}
                  className="flex-1"
                >
                  <ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => addToWishlistMutation.mutate(product)}
                  disabled={addToWishlistMutation.isPending}
                >
                  <Heart className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-500" />
              Ratings & Reviews
            </CardTitle>
            <CardDescription>
              {averageRating !== null
                ? `${averageRating.toFixed(1)} out of 5 • ${reviews.length} review${reviews.length !== 1 ? "s" : ""
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
                            className={`h-4 w-4 ${index < review.rating
                              ? "fill-yellow-400 text-yellow-500"
                              : "text-muted-foreground"
                              }`}
                          />
                        ))}
                      </div>
                      {review.createdAt && (
                        <span className="text-xs text-muted-foreground">
                          {formatIndianDisplay(review.createdAt, "date")}
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
    </DashboardLayout>
  );
}
