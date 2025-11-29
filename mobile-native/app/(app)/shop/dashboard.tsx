import React from "react";
import {
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Package,
    ShoppingCart,
    AlertTriangle,
    Star,
    Plus,
    List,
} from "lucide-react-native";

interface DashboardStats {
    pendingOrders: number;
    ordersInProgress: number;
    completedOrders: number;
    totalProducts: number;
    lowStockItems: number;
}

export default function ShopDashboardScreen() {
    const { user } = useAuth();
    const router = useRouter();

    const { data: stats, isLoading } = useQuery<DashboardStats>({
        queryKey: ["/api/shops/dashboard-stats"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/shops/dashboard-stats");
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

    return (
        <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <View className="mb-6">
                    <Text className="text-2xl font-bold">
                        Welcome, {user?.shopProfile?.shopName || user?.name}
                    </Text>
                    <Text className="text-muted-foreground">
                        Here's what's happening with your shop today.
                    </Text>
                </View>

                <View className="flex-row flex-wrap gap-4 mb-6">
                    <Button
                        className="flex-1"
                        onPress={() => router.push("/shop/products/manage")}
                    >
                        <Plus size={18} className="mr-2 text-primary-foreground" />
                        <Text className="text-primary-foreground font-medium">Add Product</Text>
                    </Button>
                    <Button
                        variant="outline"
                        className="flex-1"
                        onPress={() => router.push("/shop/orders")}
                    >
                        <List size={18} className="mr-2 text-foreground" />
                        <Text className="font-medium">View Orders</Text>
                    </Button>
                </View>

                <View className="flex-row flex-wrap gap-4">
                    <Card className="w-[47%]">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Total Products
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <View className="flex-row items-center justify-between">
                                <Text className="text-2xl font-bold">{stats?.totalProducts || 0}</Text>
                                <Package size={20} className="text-muted-foreground" />
                            </View>
                        </CardContent>
                    </Card>

                    <Card className="w-[47%]">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Pending Orders
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <View className="flex-row items-center justify-between">
                                <Text className="text-2xl font-bold">{stats?.pendingOrders || 0}</Text>
                                <ShoppingCart size={20} className="text-muted-foreground" />
                            </View>
                        </CardContent>
                    </Card>

                    <Card className="w-[47%]">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Low Stock
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <View className="flex-row items-center justify-between">
                                <Text className="text-2xl font-bold">{stats?.lowStockItems || 0}</Text>
                                <AlertTriangle size={20} className="text-yellow-500" />
                            </View>
                        </CardContent>
                    </Card>

                    <Card className="w-[47%]">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Completed
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <View className="flex-row items-center justify-between">
                                <Text className="text-2xl font-bold">
                                    {stats?.completedOrders || 0}
                                </Text>
                                <Package size={20} className="text-green-500" />
                            </View>
                        </CardContent>
                    </Card>
                </View>

                {/* Recent Orders Placeholder - could be expanded */}
                <View className="mt-8">
                    <Text className="text-lg font-bold mb-4">Recent Activity</Text>
                    <Card>
                        <CardContent className="p-4">
                            <Text className="text-muted-foreground text-center">
                                View orders tab for full details
                            </Text>
                        </CardContent>
                    </Card>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
