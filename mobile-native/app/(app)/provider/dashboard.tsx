import React from "react";
import { View, Text, ScrollView, SafeAreaView, ActivityIndicator } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Star, Bell, Plus } from "lucide-react-native";
import { Link, useRouter } from "expo-router";

export default function ProviderDashboard() {
    const { user } = useAuth();
    const router = useRouter();

    const { data: services, isLoading: servicesLoading } = useQuery({
        queryKey: [`/api/services/provider/${user?.id}`],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/services/provider/${user?.id}`);
            return res.json();
        },
        enabled: !!user?.id,
    });

    const { data: bookings, isLoading: bookingsLoading } = useQuery({
        queryKey: [`/api/bookings/provider/${user?.id}`],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/bookings/provider/${user?.id}`);
            return res.json();
        },
        enabled: !!user?.id,
    });

    const activeServicesCount = services?.filter((s: any) => s.isAvailable).length || 0;
    const pendingBookingsCount = bookings?.filter((b: any) => b.status === "pending").length || 0;

    if (servicesLoading || bookingsLoading) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center bg-background">
                <ActivityIndicator size="large" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView contentContainerClassName="p-4 space-y-6">
                <View className="flex-row justify-between items-center">
                    <View>
                        <Text className="text-2xl font-bold text-foreground">Welcome, {user?.name}</Text>
                        <Text className="text-muted-foreground">Provider Dashboard</Text>
                    </View>
                    <Button size="sm" variant="outline" onPress={() => console.log("Add Service")}>
                        <Plus size={16} className="mr-1 text-foreground" color="#000" />
                        <Text>Add Service</Text>
                    </Button>
                </View>

                {/* Metrics */}
                <View className="flex-row gap-4">
                    <Card className="flex-1">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Active Services</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Text className="text-2xl font-bold text-foreground">{activeServicesCount}</Text>
                        </CardContent>
                    </Card>
                    <Card className="flex-1">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Requests</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Text className="text-2xl font-bold text-foreground">{pendingBookingsCount}</Text>
                        </CardContent>
                    </Card>
                </View>

                {/* Quick Actions */}
                <View className="space-y-4">
                    <Text className="text-lg font-semibold text-foreground">Quick Actions</Text>
                    <View className="flex-row gap-3">
                        <Button
                            className="flex-1"
                            variant="secondary"
                            onPress={() => router.push("/provider/bookings?status=pending")}
                        >
                            <Bell size={16} className="mr-2 text-foreground" color="#000" />
                            <Text>View Requests</Text>
                        </Button>
                        <Button
                            className="flex-1"
                            variant="secondary"
                            onPress={() => router.push("/provider/bookings")}
                        >
                            <Calendar size={16} className="mr-2 text-foreground" color="#000" />
                            <Text>All Bookings</Text>
                        </Button>
                    </View>
                </View>

                {/* Recent Bookings Preview */}
                <View className="space-y-4">
                    <Text className="text-lg font-semibold text-foreground">Recent Bookings</Text>
                    {bookings?.length === 0 ? (
                        <Text className="text-muted-foreground">No bookings yet.</Text>
                    ) : (
                        bookings?.slice(0, 3).map((booking: any) => (
                            <Card key={booking.id}>
                                <CardContent className="p-4">
                                    <View className="flex-row justify-between items-start">
                                        <View>
                                            <Text className="font-semibold text-foreground">{booking.service?.name}</Text>
                                            <Text className="text-sm text-muted-foreground">
                                                {new Date(booking.bookingDate).toLocaleDateString()}
                                            </Text>
                                        </View>
                                        <View className={`px-2 py-1 rounded-full ${booking.status === 'pending' ? 'bg-yellow-100' :
                                            booking.status === 'accepted' ? 'bg-green-100' : 'bg-gray-100'
                                            }`}>
                                            <Text className={`text-xs capitalize ${booking.status === 'pending' ? 'text-yellow-800' :
                                                booking.status === 'accepted' ? 'text-green-800' : 'text-gray-800'
                                                }`}>
                                                {booking.status}
                                            </Text>
                                        </View>
                                    </View>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
