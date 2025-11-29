import React from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Edit2, Trash2 } from "lucide-react-native";
import { useAuth } from "@/hooks/use-auth";

interface Service {
    id: number;
    name: string;
    description: string;
    price: string;
    duration: number;
    category: string;
    isActive: boolean;
}

export default function ProviderServicesScreen() {
    const router = useRouter();
    const { user } = useAuth();

    const { data: services, isLoading } = useQuery<Service[]>({
        queryKey: ["/api/services/provider"],
        queryFn: async () => {
            // Assuming this endpoint exists or similar logic to fetch provider's services
            const res = await apiRequest("GET", `/api/services/provider/${user?.id}`);
            if (!res.ok) throw new Error("Failed to fetch services");
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
            <Stack.Screen options={{ headerShown: false }} />

            <View className="px-4 py-2 border-b border-border flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                    <Button variant="ghost" size="icon" onPress={() => router.back()}>
                        <ArrowLeft size={24} className="text-foreground" />
                    </Button>
                    <Text className="text-lg font-semibold">My Services</Text>
                </View>
                <Button size="sm" onPress={() => router.push("/provider/services/manage")}>
                    <Plus size={20} className="text-primary-foreground mr-1" />
                    <Text className="text-primary-foreground">Add</Text>
                </Button>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {!services?.length ? (
                    <View className="py-20 items-center justify-center space-y-4">
                        <Text className="text-xl font-semibold text-muted-foreground">
                            No services found
                        </Text>
                        <Text className="text-center text-muted-foreground px-8">
                            Start by adding your first service to accept bookings.
                        </Text>
                    </View>
                ) : (
                    <View className="space-y-4">
                        {services.map((service) => (
                            <Card key={service.id}>
                                <CardContent className="p-4">
                                    <View className="flex-row justify-between items-start mb-2">
                                        <View className="flex-1 mr-2">
                                            <Text className="font-bold text-lg">{service.name}</Text>
                                            <Text className="text-sm text-muted-foreground capitalize">
                                                {service.category} • {service.duration} mins
                                            </Text>
                                        </View>
                                        <Text className="font-bold text-lg">₹{service.price}</Text>
                                    </View>

                                    <Text className="text-muted-foreground text-sm mb-4 line-clamp-2">
                                        {service.description}
                                    </Text>

                                    <View className="flex-row gap-2 justify-end border-t border-border pt-3">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onPress={() => router.push(`/provider/services/manage?id=${service.id}`)}
                                        >
                                            <Edit2 size={16} className="text-foreground mr-2" />
                                            <Text>Edit</Text>
                                        </Button>
                                        {/* Delete functionality would go here */}
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
