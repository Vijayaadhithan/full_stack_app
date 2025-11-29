import React from "react";
import {
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    Image,
    Alert,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Edit2, Trash2, ArrowLeft } from "lucide-react-native";
import { Product } from "@/components/shop/product-card";

export default function ShopProductsScreen() {
    const { user } = useAuth();
    const router = useRouter();

    const { data: products, isLoading } = useQuery<Product[]>({
        queryKey: [`/api/products/shop/${user?.shopProfile?.id}`],
        queryFn: async () => {
            // Fallback to pending if shop ID is missing, though it should exist for shop owner
            const endpoint = user?.shopProfile?.id
                ? `/api/products/shop/${user.shopProfile.id}`
                : `/api/products/shop/pending`;
            const res = await apiRequest("GET", endpoint);
            return res.json();
        },
        enabled: !!user?.id,
    });

    const deleteProductMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await apiRequest("DELETE", `/api/products/${id}`);
            if (!res.ok) throw new Error("Failed to delete product");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/products/shop/${user?.shopProfile?.id}`] });
        },
    });

    const handleDelete = (id: number) => {
        Alert.alert(
            "Delete Product",
            "Are you sure you want to delete this product?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => deleteProductMutation.mutate(id),
                },
            ]
        );
    };

    if (isLoading) {
        return (
            <View className="flex-1 items-center justify-center bg-background">
                <ActivityIndicator size="large" color="#2563eb" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
            <Stack.Screen options={{ headerShown: false }} />

            <View className="px-4 py-2 border-b border-border flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                    <Button variant="ghost" size="icon" onPress={() => router.back()}>
                        <ArrowLeft size={24} className="text-foreground" />
                    </Button>
                    <Text className="text-lg font-semibold">My Products</Text>
                </View>
                <Button
                    size="sm"
                    onPress={() => router.push("/shop/products/manage")}
                >
                    <Plus size={16} className="mr-1 text-primary-foreground" />
                    <Text className="text-primary-foreground">Add</Text>
                </Button>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {!products?.length ? (
                    <View className="py-20 items-center justify-center">
                        <Text className="text-muted-foreground">No products found.</Text>
                        <Button
                            variant="outline"
                            className="mt-4"
                            onPress={() => router.push("/shop/products/manage")}
                        >
                            <Text>Add your first product</Text>
                        </Button>
                    </View>
                ) : (
                    <View className="space-y-4">
                        {products.map((product) => (
                            <Card key={product.id}>
                                <CardContent className="p-4 flex-row gap-4">
                                    <Image
                                        source={{
                                            uri: product.images?.[0] || "https://via.placeholder.com/100",
                                        }}
                                        className="w-20 h-20 rounded-md bg-muted"
                                        resizeMode="cover"
                                    />
                                    <View className="flex-1 justify-between">
                                        <View>
                                            <Text className="font-semibold text-base" numberOfLines={1}>
                                                {product.name}
                                            </Text>
                                            <Text className="text-sm text-muted-foreground">
                                                Stock: {product.stock}
                                            </Text>
                                        </View>
                                        <View className="flex-row justify-between items-center mt-2">
                                            <Text className="font-bold">₹{product.price}</Text>
                                            <View className="flex-row gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onPress={() => router.push({
                                                        pathname: "/shop/products/manage",
                                                        params: { id: product.id }
                                                    })}
                                                >
                                                    <Edit2 size={14} className="text-foreground" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onPress={() => handleDelete(product.id)}
                                                >
                                                    <Trash2 size={14} className="text-destructive" />
                                                </Button>
                                            </View>
                                        </View>
                                    </View>
                                </CardContent>
                            </Card>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
