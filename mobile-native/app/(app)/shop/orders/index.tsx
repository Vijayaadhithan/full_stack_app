import React, { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, Filter } from "lucide-react-native";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";

interface Order {
    id: number;
    status: string;
    total: string;
    orderDate: string;
    customer?: {
        name: string;
    };
    items: any[];
}

export default function ShopOrdersScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [statusFilter, setStatusFilter] = useState("all");

    const { data: orders, isLoading } = useQuery<Order[]>({
        queryKey: ["orders", "shop", statusFilter],
        queryFn: async () => {
            const url =
                statusFilter === "all"
                    ? "/api/orders/shop"
                    : `/api/orders/shop?status=${statusFilter}`;
            const res = await apiRequest("GET", url);
            if (!res.ok) throw new Error("Failed to fetch orders");
            return res.json();
        },
        enabled: !!user?.id,
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
            case "confirmed":
                return "bg-blue-500";
            case "packed":
                return "bg-purple-500";
            case "dispatched":
                return "bg-indigo-500";
            default:
                return "bg-gray-500";
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
            <Stack.Screen options={{ headerShown: false }} />

            <View className="px-4 py-2 border-b border-border flex-row items-center gap-2">
                <Button variant="ghost" size="icon" onPress={() => router.back()}>
                    <ArrowLeft size={24} className="text-foreground" />
                </Button>
                <Text className="text-lg font-semibold">Shop Orders</Text>
            </View>

            <View className="p-4 border-b border-border">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                    {["all", "pending", "confirmed", "packed", "dispatched", "delivered", "cancelled"].map((status) => (
                        <TouchableOpacity
                            key={status}
                            onPress={() => setStatusFilter(status)}
                            className={`px-4 py-2 rounded-full border ${statusFilter === status
                                    ? "bg-primary border-primary"
                                    : "bg-background border-border"
                                }`}
                        >
                            <Text
                                className={`capitalize ${statusFilter === status ? "text-primary-foreground" : "text-foreground"
                                    }`}
                            >
                                {status}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {!orders?.length ? (
                    <View className="py-20 items-center justify-center space-y-4">
                        <Package size={64} className="text-muted-foreground opacity-50" />
                        <Text className="text-xl font-semibold text-muted-foreground">
                            No orders found
                        </Text>
                    </View>
                ) : (
                    <View className="space-y-4">
                        {orders.map((order) => (
                            <TouchableOpacity
                                key={order.id}
                                activeOpacity={0.9}
                                onPress={() => router.push(`/shop/orders/${order.id}`)}
                            >
                                <Card>
                                    <CardContent className="p-4">
                                        <View className="flex-row justify-between items-start mb-2">
                                            <View>
                                                <Text className="font-bold text-base">
                                                    Order #{order.id}
                                                </Text>
                                                <Text className="text-sm text-muted-foreground">
                                                    {order.customer?.name || "Customer"}
                                                </Text>
                                                <Text className="text-xs text-muted-foreground mt-1">
                                                    {format(new Date(order.orderDate), "PPP p")}
                                                </Text>
                                            </View>
                                            <Badge className={getStatusColor(order.status)}>
                                                <Text className="text-white capitalize">
                                                    {order.status}
                                                </Text>
                                            </Badge>
                                        </View>

                                        <View className="mt-2 flex-row justify-between items-center border-t border-border pt-2">
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
