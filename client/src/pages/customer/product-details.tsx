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
import { Product, User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useParams, Link } from "wouter";
import { ShoppingCart, Heart, ArrowLeft, Store } from "lucide-react";
import Meta from "@/components/meta";

export default function ProductDetails() {
  const { toast } = useToast();
  const params = useParams();
  const shopId = params.shopId ? parseInt(params.shopId) : undefined;
  const productId = params.productId ? parseInt(params.productId) : undefined;

  const { data: product, isLoading: isLoadingProduct } = useQuery<Product>({
    queryKey: [`/api/shops/${shopId}/products/${productId}`],
    enabled: !!shopId && !!productId,
  });

  const { data: shop, isLoading: isLoadingShop } = useQuery<User>({
    queryKey: [`/api/shops/${shopId}`],
    enabled: !!shopId,
  });

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

  if (isLoadingProduct || isLoadingShop) {
    return (
      <DashboardLayout>
        <Meta title="Loading Product..." />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
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
            <div className="aspect-square relative overflow-hidden rounded-lg border">
              <img
                src={product.images?.[0] || "https://via.placeholder.com/600"}
                alt={product.name}
                className="object-cover w-full h-full"
              />
              {/* Discount display removed as 'discount' property doesn't exist on Product type */}
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
              <p
                className={`text-sm font-medium ${product.isAvailable && product.stock > 0 ? "text-green-600" : "text-red-600"}`}
              >
                {product.isAvailable && product.stock > 0
                  ? `In Stock (${product.stock} available)`
                  : "Out of Stock"}
              </p>
              {product.category && (
                <p className="text-sm text-muted-foreground">
                  Category: {product.category}
                </p>
              )}
              {/* Add more product details here if needed, e.g., specifications */}
              <div className="flex gap-3 pt-4">
                <Button
                  size="lg"
                  onClick={() => addToCartMutation.mutate(product.id)}
                  disabled={
                    !product.isAvailable ||
                    product.stock <= 0 ||
                    addToCartMutation.isPending
                  }
                  className="flex-1"
                >
                  <ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => addToWishlistMutation.mutate(product.id)}
                  disabled={addToWishlistMutation.isPending}
                >
                  <Heart className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
