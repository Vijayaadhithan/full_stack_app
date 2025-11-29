import React, { useState } from "react";
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, Check, X, Navigation } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { useLocalSearchParams } from "expo-router";

export default function ProviderBookings() {
    const { user } = useAuth();
    const { status } = useLocalSearchParams<{ status?: string }>();
    const [selectedStatus, setSelectedStatus] = useState<string>(status || "all");

    const { data: bookings, isLoading } = useQuery({
        queryKey: ["/api/bookings/provider"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/bookings/provider");
            return res.json();
        },
        enabled: !!user?.id,
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: number; status: string }) => {
            const res = await apiRequest("PATCH", `/ api / bookings / ${id}/status`, { status });
            if (!res.ok) throw new Error("Failed to update status");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider"] });
            Alert.alert("Success", "Booking status updated");
        },
        onError: (error: Error) => {
            Alert.alert("Error", error.message);
        },
    });

    const filteredBookings = bookings?.filter((b: any) =>
        selectedStatus === "all" ? true : b.status === selectedStatus
    );

    const handleStatusUpdate = (id: number, newStatus: string) => {
        updateStatusMutation.mutate({ id, status: newStatus });
    };

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center bg-background">
                <ActivityIndicator size="large" />
            </SafeAreaView>
        );
    }

    const tabs = ["all", "pending", "accepted", "completed", "rejected"];

    return (
        <SafeAreaView className="flex-1 bg-background">
            <View className="p-4 border-b border-border bg-background">
                <Text className="text-2xl font-bold text-foreground mb-4">Bookings</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                    {tabs.map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            onPress={() => setSelectedStatus(tab)}
                            className={cn(
                                "mr-2 px-4 py-2 rounded-full border",
                                selectedStatus === tab
                                    ? "bg-primary border-primary"
                                    : "bg-background border-border"
                            )}
                        >
                            <Text className={cn(
                                "capitalize text-sm font-medium",
                                selectedStatus === tab ? "text-primary-foreground" : "text-foreground"
                            )}>
                                {tab}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView contentContainerClassName="p-4 space-y-4">
                {filteredBookings?.length === 0 ? (
                    <Text className="text-center text-muted-foreground mt-8">No bookings found.</Text>
                ) : (
                    filteredBookings?.map((booking: any) => (
                        <Card key={booking.id} className="border-border">
                            <CardContent className="p-4 space-y-3">
                                <View className="flex-row justify-between items-start">
                                    <View>
                                        <Text className="font-bold text-lg text-foreground">{booking.service?.name}</Text>
                                        <Text className="text-sm text-muted-foreground">Customer: {booking.customer?.name}</Text>
                                    </View>
                                    <View className={cn(
                                        "px-2 py-1 rounded-full",
                                        booking.status === 'pending' ? 'bg-yellow-100' :
                                            booking.status === 'accepted' ? 'bg-green-100' :
                                                booking.status === 'rejected' ? 'bg-red-100' : 'bg-gray-100'
                                    )}>
                                        <Text className={cn(
                                            "text-xs capitalize font-medium",
                                            booking.status === 'pending' ? 'text-yellow-800' :
                                                booking.status === 'accepted' ? 'text-green-800' :
                                                    booking.status === 'rejected' ? 'text-red-800' : 'text-gray-800'
                                        )}>
                                            {booking.status}
                                        </Text>
                                    </View>
                                </View>

                                <View className="space-y-1">
                                    <View className="flex-row items-center gap-2">
                                        <Calendar size={14} className="text-muted-foreground" color="#6b7280" />
                                        <Text className="text-sm text-foreground">
                                            {new Date(booking.bookingDate).toLocaleDateString()}
                                        </Text>
                                    </View>
                                    <View className="flex-row items-center gap-2">
                                        <Clock size={14} className="text-muted-foreground" color="#6b7280" />
                                        <Text className="text-sm text-foreground">
                                            {new Date(booking.bookingDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    </View>
                                    <View className="flex-row items-center gap-2">
                                        <MapPin size={14} className="text-muted-foreground" color="#6b7280" />
                                        <Text className="text-sm text-foreground flex-1">
                                            {booking.serviceLocation === 'customer'
                                                ? "Customer Location"
                                                : "Provider Location"}
                                        </Text>
                                    </View>
                                </View>

                                {/* Actions */}
                                {booking.status === 'pending' && (
                                    <View className="flex-row gap-2 mt-2">
                                        <Button
                                            className="flex-1 bg-green-600"
                                            size="sm"
                                            onPress={() => handleStatusUpdate(booking.id, 'accepted')}
                                        >
                                            <Check size={16} color="#fff" className="mr-1" />
                                            <Text className="text-white">Accept</Text>
                                        </Button>
                                        <Button
                                            className="flex-1 bg-red-600"
                                            size="sm"
                                            variant="destructive"
                                            onPress={() => handleStatusUpdate(booking.id, 'rejected')}
                                        >
                                            <X size={16} color="#fff" className="mr-1" />
                                            <Text className="text-white">Reject</Text>
                                        </Button>
                                    </View>
                                )}

                                {booking.status === 'accepted' && (
                                    <Button
                                        className="w-full mt-2"
                                        variant="outline"
                                        onPress={() => handleStatusUpdate(booking.id, 'completed')}
                                    >
                                        <Check size={16} color="#000" className="mr-1" />
                                        <Text>Mark Complete</Text>
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
