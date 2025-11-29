import React, { useState } from "react";
import {
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    Alert,
} from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Phone, Mail } from "lucide-react-native";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface OrderDetails {
    id: number;
    status: string;
    total: string;
    subtotal: string;
    orderDate: string;
    deliveryMethod: string;
    paymentMethod: string;
    paymentStatus: string;
    shippingAddress?: string;
    customer?: {
        name: string;
        email: string;
        phone: string;
    };
    items: {
        id: number;
        name: string;
        quantity: number;
        price: string;
        total: string;
    }[];
}

export default function ShopOrderDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { toast } = useToast();

    const { data: order, isLoading } = useQuery<OrderDetails>({
        queryKey: [`/api/orders/${id}`],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/orders/${id}`);
            if (!res.ok) throw new Error("Failed to fetch order details");
            return res.json();
        },
        enabled: !!id,
    });

    const updateStatusMutation = useMutation({
        mutationFn: async (status: string) => {
            const res = await apiRequest("PATCH", `/api/orders/${id}/status`, {
                status,
            });
            if (!res.ok) throw new Error("Failed to update status");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
            queryClient.invalidateQueries({ queryKey: ["orders", "shop"] });
            toast("Success", "Order status updated");
        },
        onError: (error: Error) => {
            toast("Error", error.message);
        },
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

    const nextStatusOptions: Record<string, string[]> = {
        pending: ["confirmed", "cancelled"],
        confirmed: ["packed", "cancelled"],
        packed: ["dispatched"],
        dispatched: ["delivered"],
        delivered: [],
        cancelled: [],
    };

    const availableActions = nextStatusOptions[order.status] || [];

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
                    <CardContent className="p-4 space-y-4">
                        <View className="flex-row justify-between items-center">
                            <Text className="text-muted-foreground">
                                {format(new Date(order.orderDate), "PPP p")}
                            </Text>
                            <Badge className={getStatusColor(order.status)}>
                                <Text className="text-white capitalize">{order.status}</Text>
                            </Badge>
                        </View>

                        <View className="h-[1px] bg-border" />

                        <View className="space-y-2">
                            <Text className="font-semibold text-lg">Customer Details</Text>
                            <Text className="text-base">{order.customer?.name}</Text>
                            <View className="flex-row items-center gap-2">
                                <Mail size={16} className="text-muted-foreground" />
                                <Text className="text-muted-foreground">{order.customer?.email}</Text>
                            </View>
                            <View className="flex-row items-center gap-2">
                                <Phone size={16} className="text-muted-foreground" />
                                <Text className="text-muted-foreground">{order.customer?.phone}</Text>
                            </View>
                        </View>

                        <View className="h-[1px] bg-border" />

                        <View className="space-y-2">
                            <Text className="font-semibold text-lg">Delivery Details</Text>
                            <Text className="capitalize">Method: {order.deliveryMethod}</Text>
                            {order.deliveryMethod === "delivery" && (
                                <View className="flex-row items-start gap-2 mt-1">
                                    <MapPin size={16} className="text-muted-foreground mt-1" />
                                    <Text className="text-muted-foreground flex-1">
                                        {order.shippingAddress || "No address provided"}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </CardContent>
                </Card>

                <Card className="mb-4">
                    <CardContent className="p-4 space-y-4">
                        <Text className="font-semibold text-lg">Order Items</Text>
                        {order.items.map((item) => (
                            <View key={item.id} className="flex-row justify-between items-center py-2 border-b border-border last:border-0">
                                <View className="flex-1">
                                    <Text className="font-medium">{item.name}</Text>
                                    <Text className="text-sm text-muted-foreground">
                                        {item.quantity} x ₹{item.price}
                                    </Text>
                                </View>
                                <Text className="font-semibold">₹{item.total}</Text>
                            </View>
                        ))}

                        <View className="flex-row justify-between items-center pt-2">
                            <Text className="font-bold text-lg">Total</Text>
                            <Text className="font-bold text-lg">₹{order.total}</Text>
                        </View>
                    </CardContent>
                </Card>

                {availableActions.length > 0 && (
                    <View className="space-y-2 mb-8">
                        <Text className="font-semibold text-lg mb-2">Update Status</Text>
                        <View className="flex-row flex-wrap gap-2">
                            {availableActions.map((status) => (
                                <Button
                                    key={status}
                                    className="flex-1 min-w-[120px]"
                                    variant={status === "cancelled" ? "destructive" : "default"}
                                    onPress={() => updateStatusMutation.mutate(status)}
                                    disabled={updateStatusMutation.isPending}
                                >
                                    {updateStatusMutation.isPending ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text className="text-primary-foreground capitalize">
                                            Mark as {status}
                                        </Text>
                                    )}
                                </Button>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
