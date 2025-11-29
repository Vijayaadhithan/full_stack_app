import React from "react";
import {
    View,
    Text,
    ScrollView,
    Image,
    ActivityIndicator,
    TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ShoppingCart, Heart, Share2 } from "lucide-react-native";
import { Badge } from "@/components/ui/badge";
import { Product } from "@/components/shop/product-card";

export default function ProductDetailsScreen() {
    const { id, productId } = useLocalSearchParams<{ id: string; productId: string }>();
    const router = useRouter();
    const { toast } = useToast();

    const { data: product, isLoading } = useQuery<Product>({
        queryKey: [`/api/products/${productId}`],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/products/${productId}`);
            if (!res.ok) throw new Error("Failed to fetch product details");
            return res.json();
        },
        enabled: !!productId,
    });

    const addToCartMutation = useMutation({
        mutationFn: async () => {
            if (!product) return;
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
            toast("Added to cart", `${product?.name} has been added to your cart.`);
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

    if (isLoading) {
        return (
            <View className="flex-1 items-center justify-center bg-background">
                <ActivityIndicator size="large" color="#2563eb" />
            </View>
        );
    }

    if (!product) {
        return (
            <View className="flex-1 items-center justify-center bg-background p-4">
                <Text className="text-lg font-semibold mb-4">Product not found</Text>
                <Button onPress={() => router.back()}>
                    <Text className="text-primary-foreground">Go Back</Text>
                </Button>
            </View>
        );
    }

    const discountPercentage =
        product.mrp && parseFloat(product.mrp) > parseFloat(product.price)
            ? Math.round(
                ((parseFloat(product.mrp) - parseFloat(product.price)) /
                    parseFloat(product.mrp)) *
                100
            )
            : 0;

    return (
        <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
            <Stack.Screen options={{ headerShown: false }} />

            <View className="absolute top-0 left-0 right-0 z-10 p-4 flex-row justify-between items-center">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 bg-black/30 rounded-full items-center justify-center"
                >
                    <ArrowLeft size={24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                    className="w-10 h-10 bg-black/30 rounded-full items-center justify-center"
                >
                    <Share2 size={20} color="white" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                <View className="aspect-square w-full bg-muted relative">
                    <Image
                        source={{
                            uri: product.images?.[0] || "https://via.placeholder.com/400",
                        }}
                        className="w-full h-full"
                        resizeMode="cover"
                    />
                    {discountPercentage > 0 && (
                        <View className="absolute bottom-4 left-4 bg-red-500 px-3 py-1 rounded-full">
                            <Text className="text-white font-bold">
                                {discountPercentage}% OFF
                            </Text>
                        </View>
                    )}
                </View>

                <View className="p-4 space-y-4">
                    <View>
                        <Text className="text-2xl font-bold">{product.name}</Text>
                        <Text className="text-muted-foreground mt-1">
                            Category: {product.category || "General"}
                        </Text>
                    </View>

                    <View className="flex-row items-baseline gap-3">
                        <Text className="text-3xl font-bold text-primary">
                            ₹{product.price}
                        </Text>
                        {product.mrp && parseFloat(product.mrp) > parseFloat(product.price) && (
                            <Text className="text-lg text-muted-foreground line-through">
                                ₹{product.mrp}
                            </Text>
                        )}
                    </View>

                    {!product.isAvailable && (
                        <Badge variant="destructive" className="self-start">
                            <Text>Out of Stock</Text>
                        </Badge>
                    )}

                    <View className="space-y-2">
                        <Text className="text-lg font-semibold">Description</Text>
                        <Text className="text-muted-foreground leading-6">
                            {product.description || "No description available for this product."}
                        </Text>
                    </View>

                    {/* Specifications placeholder - if we had them in the type */}
                    {/* <View className="space-y-2">
            <Text className="text-lg font-semibold">Specifications</Text>
             ...
          </View> */}
                </View>
            </ScrollView>

            <View className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border flex-row gap-3">
                <Button
                    variant="outline"
                    size="icon"
                    className="w-14 h-14"
                >
                    <Heart size={24} className="text-foreground" />
                </Button>
                <Button
                    className="flex-1 h-14"
                    onPress={() => addToCartMutation.mutate()}
                    disabled={!product.isAvailable || addToCartMutation.isPending}
                >
                    {addToCartMutation.isPending ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <ShoppingCart size={20} className="mr-2 text-primary-foreground" />
                            <Text className="text-primary-foreground font-bold text-lg">
                                Add to Cart
                            </Text>
                        </>
                    )}
                </Button>
            </View>
        </SafeAreaView>
    );
}
