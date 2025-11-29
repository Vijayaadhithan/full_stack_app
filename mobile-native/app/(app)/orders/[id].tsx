import React from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Package, CreditCard } from "lucide-react-native";
import { format } from "date-fns";

interface OrderItem {
    id: number;
    name: string;
    quantity: number;
    price: string;
    total: string;
}

interface Order {
    id: number;
    status: string;
    total: string;
    orderDate: string;
    deliveryMethod: string;
    paymentMethod: string;
    paymentStatus: string;
    shippingAddress?: string;
    items: OrderItem[];
}

export default function OrderDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    const { data: order, isLoading } = useQuery<Order>({
        queryKey: [`/api/orders/${id}`],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/orders/${id}`);
            if (!res.ok) throw new Error("Failed to fetch order");
            return res.json();
        },
        enabled: !!id,
    });

    if (isLoading) {
        return (
            <View className="flex-1 items-center justify-center bg-background">
                <ActivityIndicator size="large" color="#2563eb" />
            </View>
        );
    }

    if (!order) {
        return (
            <View className="flex-1 items-center justify-center bg-background">
                <Text>Order not found</Text>
            </View>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "delivered":
                return "bg-green-500";
            case "cancelled":
                return "bg-red-500";
            case "pending":
                return "bg-yellow-500";
            default:
                return "bg-blue-500";
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
            <Stack.Screen options={{ headerShown: false }} />

            <View className="px-4 py-2 border-b border-border flex-row items-center gap-2">
                <Button variant="ghost" size="icon" onPress={() => router.back()}>
                    <ArrowLeft size={24} className="text-foreground" />
                </Button>
                <Text className="text-lg font-semibold">Order #{order.id}</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <Card className="mb-4">
                    <CardHeader>
                        <View className="flex-row justify-between items-center">
                            <CardTitle>Order Status</CardTitle>
                            <Badge className={getStatusColor(order.status)}>
                                <Text className="text-white capitalize">{order.status}</Text>
                            </Badge>
                        </View>
                    </CardHeader>
                    <CardContent>
                        <Text className="text-muted-foreground mb-2">
                            Placed on {format(new Date(order.orderDate), "PPP p")}
                        </Text>
                        <View className="flex-row items-center gap-2 mt-2">
                            <Package size={16} className="text-muted-foreground" />
                            <Text className="capitalize">{order.deliveryMethod}</Text>
                        </View>
                        {order.shippingAddress && (
                            <View className="flex-row items-start gap-2 mt-2">
                                <MapPin size={16} className="text-muted-foreground mt-1" />
                                <Text className="flex-1">{order.shippingAddress}</Text>
                            </View>
                        )}
                        <View className="flex-row items-center gap-2 mt-2">
                            <CreditCard size={16} className="text-muted-foreground" />
                            <Text className="capitalize">
                                {order.paymentMethod} - {order.paymentStatus}
                            </Text>
                        </View>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {order.items.map((item) => (
                            <View
                                key={item.id}
                                className="flex-row justify-between items-center py-2 border-b border-border last:border-0"
                            >
                                <View className="flex-1">
                                    <Text className="font-medium">{item.name}</Text>
                                    <Text className="text-sm text-muted-foreground">
                                        {item.quantity} x ₹{item.price}
                                    </Text>
                                </View>
                                <Text className="font-semibold">₹{item.total}</Text>
                            </View>
                        ))}
                        <View className="flex-row justify-between items-center pt-4 mt-2 border-t border-border">
                            <Text className="font-bold text-lg">Total</Text>
                            <Text className="font-bold text-lg">₹{order.total}</Text>
                        </View>
                    </CardContent>
                </Card>
            </ScrollView>
        </SafeAreaView>
    );
}
