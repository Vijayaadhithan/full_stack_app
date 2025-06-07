import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, UseQueryResult, UseMutationResult } from "@tanstack/react-query";
import { Product, User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Search, ShoppingCart, Heart, Store, MapPin, ArrowLeft, Loader2 } from "lucide-react";
import { useState } from "react";
import { useParams, Link } from "wouter";
import Meta from "@/components/meta";
// Helper function to format address
const formatAddress = (user: User | undefined): string => {
  if (!user) return "Location not specified";
  const parts = [
    user.addressStreet,
    user.addressCity,
    user.addressState,
    user.addressPostalCode,
    user.addressCountry,
  ].filter(Boolean); // Filter out null/undefined/empty strings
  return parts.length > 0 ? parts.join(', ') : "Location not specified";
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function ShopDetails() {
  const { id } = useParams<{ id: string }>();
  console.log("ShopDetails component - Shop ID from params:", id);
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);

  const { data: shop, isLoading: shopLoading, isError: isShopError, error: shopError } = useQuery<User, Error>({
    queryKey: [`/api/users/${id}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/users/${id}`);
      if (!res.ok) {
        throw new Error('Failed to fetch shop details');
      }
      const data = await res.json();
      console.log("Successfully fetched shop data:", data);
      return data;
    },
    enabled: !!id,
  });

  if (isShopError) {
    console.error("Error fetching shop:", shopError);
    console.error("Query key:", [`/api/users/${id}`]);
    // Optionally show a toast or specific error message here
  }

  const { data: products, isLoading: productsLoading, isError: isProductsError, error: productsError } = useQuery<Product[], Error>({
    queryKey: [`/api/products/shop/${id}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/products/shop/${id}`);
      if (!res.ok) {
        throw new Error('Failed to fetch shop products');
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

  const addToCartMutation: UseMutationResult<any, Error, number> = useMutation({
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
        description = "You can only add items from one shop at a time. Please clear your cart or checkout first.";
      }
      toast({
        title: "Error Adding to Cart",
        description: description,
        variant: "destructive",
      });
    },
  });

  const addToWishlistMutation: UseMutationResult<any, Error, number> = useMutation({
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

  const filteredProducts = products?.filter(product =>
    (!selectedCategory || product.category === selectedCategory) &&
    (product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase())))
  ) ?? []; // Provide default empty array if products is undefined

  const isLoading = shopLoading || productsLoading;

  if (isLoading) {
    return (
      <DashboardLayout>
        <Meta title="Loading Shop..." />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
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
                    alt={shop.name}
                    className="h-full w-full rounded-lg object-cover"
                  />
                ) : (
                  <Store className="h-12 w-12 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{shop.shopProfile?.shopName ?? shop.name}</h1>
                <div className="flex items-center text-muted-foreground mt-1">
                  <MapPin className="h-4 w-4 mr-1" />
                  <span>{formatAddress(shop)}</span>
                </div>
                <p className="mt-4">{shop.shopProfile?.description ?? "No description available"}</p>
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
              <Select value={selectedCategory ?? ''} onValueChange={(value) => setSelectedCategory(value === '' ? undefined : value)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {/* <SelectItem value="">All Categories</SelectItem> */}
                  <SelectItem value="electronics">Electronics</SelectItem>
                  <SelectItem value="clothing">Clothing</SelectItem>
                  <SelectItem value="books">Books</SelectItem>
                  <SelectItem value="home">Home & Living</SelectItem>
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
                  <Card className="h-full flex flex-col">
                    <div className="aspect-square relative overflow-hidden">
                      <img
                        src={product.images?.[0] || "https://via.placeholder.com/400"}
                        alt={product.name}
                        className="object-cover w-full h-full"
                      />
                      {product.mrp && parseFloat(product.mrp) > parseFloat(product.price) && (
                        <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold">
                          {Math.round(((parseFloat(product.mrp) - parseFloat(product.price)) / parseFloat(product.mrp)) * 100)}% OFF
                        </div>
                      )}
                    </div>
                    <CardContent className="flex-1 p-4">
                      <h3 className="font-semibold truncate">{product.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {product.description ?? 'No description'}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">₹{product.price}</p>
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => addToWishlistMutation.mutate(product.id)}
                            disabled={addToWishlistMutation.isPending}
                          >
                            <Heart className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            onClick={() => addToCartMutation.mutate(product.id)}
                            disabled={!product.isAvailable || addToCartMutation.isPending}
                          >
                            <ShoppingCart className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </DashboardLayout>
  );
}