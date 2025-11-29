import React, { useState } from "react";
import {
    View,
    Text,
    ScrollView,
    Image,
    ActivityIndicator,
    TextInput,
} from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProductCard, Product } from "@/components/shop/product-card";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Search, ArrowLeft, Store } from "lucide-react-native";
import { Badge } from "@/components/ui/badge";

export default function ShopDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");

    const { data: shop, isLoading: shopLoading } = useQuery({
        queryKey: [`/api/shops/${id}`],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/shops/${id}`);
            if (!res.ok) throw new Error("Failed to fetch shop details");
            return res.json();
        },
        enabled: !!id,
    });

    const { data: productsResponse, isLoading: productsLoading } = useQuery({
        queryKey: ["/api/products", id],
        queryFn: async () => {
            const params = new URLSearchParams({
                shopId: id!,
                pageSize: "100",
            });
            const res = await apiRequest("GET", `/api/products?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch shop products");
            return res.json();
        },
        enabled: !!id,
    });

    const addToCartMutation = useMutation({
        mutationFn: async (product: Product) => {
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
        onSuccess: (_, product) => {
            queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
            toast("Added to cart", `${product.name} has been added to your cart.`);
        },
        onError: (error: Error) => {
            let description = error.message || "Failed to add product to cart";
            if (error.message.includes("Cannot add items from different shops")) {
                description =
                    "You can only add items from one shop at a time. Please clear your cart or checkout first.";
            }
            toast("Error Adding to Cart", description);
        },
    });

    const addToWishlistMutation = useMutation({
        mutationFn: async (product: Product) => {
            const res = await apiRequest("POST", "/api/wishlist", {
                productId: product.id,
            });
            if (!res.ok) throw new Error("Failed to add to wishlist");
            return res.json();
        },
        onSuccess: (_, product) => {
            queryClient.invalidateQueries({ queryKey: ["/api/wishlist"] });
            toast("Added to wishlist", `${product.name} added to wishlist.`);
        },
        onError: (error: Error) => {
            toast("Error", error.message);
        },
    });

    const products = productsResponse?.items ?? [];
    const filteredProducts = products.filter((product: Product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (shopLoading || productsLoading) {
        return (
            <View className="flex-1 items-center justify-center bg-background">
                <ActivityIndicator size="large" color="#2563eb" />
            </View>
        );
    }

    if (!shop) {
        return (
            <View className="flex-1 items-center justify-center bg-background p-4">
                <Text className="text-lg font-semibold mb-4">Shop not found</Text>
                <Button onPress={() => router.back()}>
                    <Text className="text-primary-foreground">Go Back</Text>
                </Button>
            </View>
        );
    }

    const formatAddress = (s: any) => {
        return [
            s.addressStreet,
            s.addressCity,
            s.addressState,
            s.addressPostalCode,
        ]
            .filter(Boolean)
            .join(", ");
    };

    return (
        <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
            <Stack.Screen options={{ headerShown: false }} />

            <View className="px-4 py-2 border-b border-border flex-row items-center gap-2">
                <Button variant="ghost" size="icon" onPress={() => router.back()}>
                    <ArrowLeft size={24} className="text-foreground" />
                </Button>
                <Text className="text-lg font-semibold flex-1" numberOfLines={1}>
                    {shop.shopProfile?.shopName || shop.name}
                </Text>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                {/* Shop Header */}
                <View className="p-4 bg-card border-b border-border">
                    <View className="flex-row gap-4">
                        <View className="w-20 h-20 rounded-lg bg-primary/10 items-center justify-center overflow-hidden">
                            {shop.profilePicture ? (
                                <Image
                                    source={{ uri: shop.profilePicture }}
                                    className="w-full h-full"
                                    resizeMode="cover"
                                />
                            ) : (
                                <Store size={32} className="text-primary" />
                            )}
                        </View>
                        <View className="flex-1 justify-center">
                            <Text className="text-xl font-bold">
                                {shop.shopProfile?.shopName || shop.name}
                            </Text>
                            <View className="flex-row items-center mt-1">
                                <MapPin size={14} className="text-muted-foreground mr-1" />
                                <Text className="text-sm text-muted-foreground flex-1" numberOfLines={2}>
                                    {formatAddress(shop)}
                                </Text>
                            </View>
                        </View>
                    </View>
                    {shop.shopProfile?.description && (
                        <Text className="mt-3 text-muted-foreground">
                            {shop.shopProfile.description}
                        </Text>
                    )}
                </View>

                {/* Products Section */}
                <View className="p-4">
                    <View className="flex-row items-center justify-between mb-4">
                        <Text className="text-lg font-semibold">Products</Text>
                        <Badge variant="secondary">
                            <Text>{filteredProducts.length} Items</Text>
                        </Badge>
                    </View>

                    <View className="relative mb-4">
                        <Search
                            size={18}
                            className="absolute left-3 top-3 text-muted-foreground z-10"
                        />
                        <TextInput
                            className="h-10 pl-10 pr-4 rounded-md border border-input bg-background"
                            placeholder="Search products..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholderTextColor="#6b7280"
                        />
                    </View>

                    <View className="flex-row flex-wrap gap-4">
                        {filteredProducts.map((product: Product) => (
                            <View key={product.id} className="w-[47%]">
                                <ProductCard
                                    product={product}
                                    onAddToCart={(p) => addToCartMutation.mutate(p)}
                                    onAddToWishlist={(p) => addToWishlistMutation.mutate(p)}
                                    isAddingToCart={addToCartMutation.isPending}
                                    isAddingToWishlist={addToWishlistMutation.isPending}
                                />
                            </View>
                        ))}
                    </View>

                    {filteredProducts.length === 0 && (
                        <View className="py-10 items-center">
                            <Text className="text-muted-foreground">No products found</Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
