import React from 'react';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Product } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { ShoppingCart, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function Wishlist() {
  const { toast } = useToast();

  const { data: wishlistItems, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/wishlist"],
  });

  type CartItem = { product: Product; quantity: number };

  const addToCartMutation = useMutation<
    unknown,
    Error,
    Product,
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

  const removeFromWishlistMutation = useMutation<
    unknown,
    Error,
    number,
    { previousWishlist: Product[] }
  >({
    mutationFn: async (productId: number) => {
      const res = await apiRequest("DELETE", `/api/wishlist/${productId}`);
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }
    },
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: ["/api/wishlist"] });
      const previousWishlist =
        queryClient.getQueryData<Product[]>(["/api/wishlist"]) ?? [];

      queryClient.setQueryData<Product[]>(
        ["/api/wishlist"],
        previousWishlist.filter((item) => item.id !== productId),
      );

      return { previousWishlist };
    },
    onSuccess: () => {
      toast({
        title: "Removed from wishlist",
        description: "Product has been removed from your wishlist.",
      });
    },
    onError: (error: Error, _productId, context) => {
      if (context?.previousWishlist) {
        queryClient.setQueryData(
          ["/api/wishlist"],
          context.previousWishlist,
        );
      }
      toast({
        title: "Error",
        description: error.message || "Failed to remove product from wishlist",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist"] });
    },
  });

  return (
    <DashboardLayout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-4xl mx-auto space-y-6"
      >
        <h1 className="text-2xl font-bold">Wishlist</h1>

        {isLoading ? (
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index}>
                <CardContent className="p-6 space-y-4">
                  <div className="flex gap-4">
                    <Skeleton className="w-24 h-24 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-10 w-10 rounded-md" />
                      <Skeleton className="h-10 w-10 rounded-md" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : wishlistItems?.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">Your wishlist is empty</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {wishlistItems?.map((product) => (
              <motion.div key={product.id} variants={item}>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <div className="w-24 h-24 rounded flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted border">
                        <CategoryIcon
                          category={getProductImage(product.category || 'other')}
                          size="md"
                          showLabel={false}
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{product.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {product.description}
                        </p>
                        <p className="font-semibold mt-2">₹{product.price}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          size="icon"
                          onClick={() => addToCartMutation.mutate(product)}
                          disabled={
                            !product.isAvailable || addToCartMutation.isPending
                          }
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() =>
                            removeFromWishlistMutation.mutate(product.id)
                          }
                          disabled={removeFromWishlistMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
