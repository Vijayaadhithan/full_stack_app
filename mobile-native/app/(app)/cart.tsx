import React, { useState } from "react";
import {
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    Alert,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CartItem } from "@/components/shop/cart-item";
import { ArrowLeft, ShoppingBag } from "lucide-react-native";
import { Product } from "@/components/shop/product-card";

interface CartItemData {
    product: Product;
    quantity: number;
}

export default function CartScreen() {
    const router = useRouter();
    const { toast } = useToast();
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    const { data: cartItems, isLoading } = useQuery<CartItemData[]>({
        queryKey: ["/api/cart"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/cart");
            if (!res.ok) throw new Error("Failed to fetch cart");
            return res.json();
        },
    });

    const updateCartMutation = useMutation({
        mutationFn: async ({
            productId,
            quantity,
        }: {
            productId: number;
            quantity: number;
        }) => {
            const res = await apiRequest("POST", "/api/cart", {
                productId,
                quantity,
            });
            if (!res.ok) throw new Error("Failed to update cart");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
        },
        onError: (error: Error) => {
            toast("Error", error.message);
        },
    });

    const removeFromCartMutation = useMutation({
        mutationFn: async (productId: number) => {
            const res = await apiRequest("DELETE", `/api/cart/${productId}`);
            if (!res.ok) throw new Error("Failed to remove from cart");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
            toast("Removed", "Item removed from cart");
        },
        onError: (error: Error) => {
            toast("Error", error.message);
        },
    });

    const createOrderMutation = useMutation({
        mutationFn: async () => {
            if (!cartItems || cartItems.length === 0) throw new Error("Cart is empty");

            const subtotal = cartItems.reduce(
                (total, item) => total + parseFloat(item.product.price) * item.quantity,
                0
            );

            // Simplified order creation for MVP - assuming defaults for now
            // In a real app, we'd have a checkout screen to select address/payment
            const orderData = {
                items: cartItems.map((item) => ({
                    productId: item.product.id,
                    quantity: item.quantity,
                    price: item.product.price,
                })),
                total: (subtotal + 10).toString(), // Adding simplified platform fee
                subtotal: subtotal.toString(),
                discount: "0",
                deliveryMethod: "pickup", // Defaulting for MVP
                paymentMethod: "upi", // Defaulting for MVP
            };

            const res = await apiRequest("POST", "/api/orders", orderData);
            if (!res.ok) throw new Error("Failed to create order");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
            setIsCheckingOut(false);
            Alert.alert("Success", "Order placed successfully!", [
                { text: "OK", onPress: () => router.push("/(app)/orders") },
            ]);
        },
        onError: (error: Error) => {
            setIsCheckingOut(false);
            toast("Checkout Failed", error.message);
        },
    });

    const subtotal =
        cartItems?.reduce(
            (total, item) => total + parseFloat(item.product.price) * item.quantity,
            0
        ) ?? 0;

    const platformFee = 10; // Simplified
    const totalAmount = subtotal + platformFee;

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

            <View className="px-4 py-2 border-b border-border flex-row items-center gap-2">
                <Button variant="ghost" size="icon" onPress={() => router.back()}>
                    <ArrowLeft size={24} className="text-foreground" />
                </Button>
                <Text className="text-lg font-semibold">Shopping Cart</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {!cartItems?.length ? (
                    <View className="py-20 items-center justify-center space-y-4">
                        <ShoppingBag size={64} className="text-muted-foreground opacity-50" />
                        <Text className="text-xl font-semibold text-muted-foreground">
                            Your cart is empty
                        </Text>
                        <Button
                            variant="outline"
                            onPress={() => router.push("/shops")}
                            className="mt-4"
                        >
                            <Text>Browse Shops</Text>
                        </Button>
                    </View>
                ) : (
                    <View className="space-y-6">
                        <Card>
                            <CardContent className="p-0">
                                {cartItems.map((item) => (
                                    <View key={item.product.id} className="px-4">
                                        <CartItem
                                            item={item}
                                            onUpdateQuantity={(pid, qty) =>
                                                updateCartMutation.mutate({ productId: pid, quantity: qty })
                                            }
                                            onRemove={(pid) => removeFromCartMutation.mutate(pid)}
                                            isUpdating={updateCartMutation.isPending}
                                            isRemoving={removeFromCartMutation.isPending}
                                        />
                                    </View>
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4 space-y-4">
                                <Text className="font-semibold text-lg">Order Summary</Text>

                                <View className="flex-row justify-between">
                                    <Text className="text-muted-foreground">Subtotal</Text>
                                    <Text>₹{subtotal.toFixed(2)}</Text>
                                </View>

                                <View className="flex-row justify-between">
                                    <Text className="text-muted-foreground">Platform Fee</Text>
                                    <Text>₹{platformFee.toFixed(2)}</Text>
                                </View>

                                <View className="h-[1px] bg-border my-2" />

                                <View className="flex-row justify-between items-center">
                                    <Text className="font-bold text-lg">Total</Text>
                                    <Text className="font-bold text-lg">₹{totalAmount.toFixed(2)}</Text>
                                </View>

                                <Button
                                    className="w-full mt-4"
                                    onPress={() => {
                                        setIsCheckingOut(true);
                                        createOrderMutation.mutate();
                                    }}
                                    disabled={isCheckingOut || createOrderMutation.isPending}
                                >
                                    {isCheckingOut ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text className="text-primary-foreground font-bold">
                                            Place Order
                                        </Text>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
