import React from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Clock, MapPin } from "lucide-react-native";
import { format } from "date-fns";

interface Booking {
    id: number;
    status: string;
    bookingDate: string;
    bookingTime: string;
    serviceName: string;
    providerName: string;
    price: string;
}

export default function CustomerBookingsScreen() {
    const router = useRouter();

    const { data: bookings, isLoading } = useQuery<Booking[]>({
        queryKey: ["/api/bookings"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/bookings");
            if (!res.ok) throw new Error("Failed to fetch bookings");
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
            case "completed":
                return "bg-green-500";
            case "cancelled":
                return "bg-red-500";
            case "confirmed":
                return "bg-blue-500";
            default:
                return "bg-yellow-500";
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
            <Stack.Screen options={{ headerShown: false }} />

            <View className="px-4 py-2 border-b border-border flex-row items-center gap-2">
                <Button variant="ghost" size="icon" onPress={() => router.back()}>
                    <ArrowLeft size={24} className="text-foreground" />
                </Button>
                <Text className="text-lg font-semibold">My Bookings</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {!bookings?.length ? (
                    <View className="py-20 items-center justify-center space-y-4">
                        <Calendar size={64} className="text-muted-foreground opacity-50" />
                        <Text className="text-xl font-semibold text-muted-foreground">
                            No bookings found
                        </Text>
                        <Button onPress={() => router.push("/(app)/dashboard")}>
                            <Text className="text-primary-foreground">Browse Services</Text>
                        </Button>
                    </View>
                ) : (
                    <View className="space-y-4">
                        {bookings.map((booking) => (
                            <Card key={booking.id}>
                                <CardContent className="p-4 space-y-3">
                                    <View className="flex-row justify-between items-start">
                                        <View className="flex-1">
                                            <Text className="font-bold text-lg">{booking.serviceName}</Text>
                                            <Text className="text-muted-foreground">{booking.providerName}</Text>
                                        </View>
                                        <Badge className={getStatusColor(booking.status)}>
                                            <Text className="text-white capitalize">{booking.status}</Text>
                                        </Badge>
                                    </View>

                                    <View className="flex-row items-center gap-4">
                                        <View className="flex-row items-center gap-1">
                                            <Calendar size={16} className="text-muted-foreground" />
                                            <Text className="text-sm">
                                                {format(new Date(booking.bookingDate), "MMM d, yyyy")}
                                            </Text>
                                        </View>
                                        <View className="flex-row items-center gap-1">
                                            <Clock size={16} className="text-muted-foreground" />
                                            <Text className="text-sm">{booking.bookingTime}</Text>
                                        </View>
                                    </View>

                                    <View className="flex-row justify-between items-center pt-2 border-t border-border">
                                        <Text className="font-semibold">₹{booking.price}</Text>
                                        {/* Add Cancel/Reschedule buttons here if needed */}
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
