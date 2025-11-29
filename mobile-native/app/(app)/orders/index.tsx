import React from "react";
import {
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package } from "lucide-react-native";
import { format } from "date-fns";

interface Order {
    id: number;
    status: string;
    total: string;
    orderDate: string;
    items: any[];
}

export default function OrdersScreen() {
    const router = useRouter();

    const { data: orders, isLoading } = useQuery<Order[]>({
        queryKey: ["/api/orders/customer"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/orders/customer");
            if (!res.ok) throw new Error("Failed to fetch orders");
            return res.json();
        },
    });

    if (isLoading) {
        return (
            <View className="flex-1 items-center justify-center bg-background">
                <ActivityIndicator size="large" color="#2563eb" />
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
                <Text className="text-lg font-semibold">My Orders</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {!orders?.length ? (
                    <View className="py-20 items-center justify-center space-y-4">
                        <Package size={64} className="text-muted-foreground opacity-50" />
                        <Text className="text-xl font-semibold text-muted-foreground">
                            No orders yet
                        </Text>
                        <Button
                            variant="outline"
                            onPress={() => router.push("/shops")}
                            className="mt-4"
                        >
                            <Text>Start Shopping</Text>
                        </Button>
                    </View>
                ) : (
                    <View className="space-y-4">
                        {orders.map((order) => (
                            <TouchableOpacity
                                key={order.id}
                                activeOpacity={0.9}
                            // onPress={() => router.push(`/orders/${order.id}`)} // Detail view to be implemented
                            >
                                <Card>
                                    <CardContent className="p-4">
                                        <View className="flex-row justify-between items-start mb-2">
                                            <View>
                                                <Text className="font-bold text-base">
                                                    Order #{order.id}
                                                </Text>
                                                <Text className="text-sm text-muted-foreground">
                                                    {format(new Date(order.orderDate), "PPP")}
                                                </Text>
                                            </View>
                                            <Badge className={getStatusColor(order.status)}>
                                                <Text className="text-white capitalize">
                                                    {order.status}
                                                </Text>
                                            </Badge>
                                        </View>

                                        <View className="mt-2 flex-row justify-between items-center">
                                            <Text className="text-muted-foreground">
                                                {order.items?.length || 0} Items
                                            </Text>
                                            <Text className="font-bold text-lg">
                                                ₹{parseFloat(order.total).toFixed(2)}
                                            </Text>
                                        </View>
                                    </CardContent>
                                </Card>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

// Temporary Button component import fix if needed, but we used it above
import { Button } from "@/components/ui/button";
