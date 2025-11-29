import React from "react";
import { View, Text, ScrollView, Image, ActivityIndicator, SafeAreaView } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../../lib/queryClient";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { MapPin, Clock, Star, ArrowLeft } from "lucide-react-native";
import { TouchableOpacity } from "react-native";

export default function ServiceDetails() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    const { data: service, isLoading, error } = useQuery({
        queryKey: [`/api/services/${id}`],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/services/${id}`);
            return res.json();
        },
        enabled: !!id,
    });

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center bg-background">
                <ActivityIndicator size="large" />
            </SafeAreaView>
        );
    }

    if (error || !service) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center bg-background p-4">
                <Text className="text-lg font-semibold text-destructive mb-2">Error loading service</Text>
                <Button onPress={() => router.back()}>
                    <Text>Go Back</Text>
                </Button>
            </SafeAreaView>
        );
    }

    const providerName = service.provider?.name ?? "Provider";
    const averageRating = service.rating || 0;
    const reviewCount = service.reviews?.length || 0;

    return (
        <SafeAreaView className="flex-1 bg-background">
            <Stack.Screen options={{ headerShown: false }} />
            <ScrollView contentContainerClassName="pb-24">
                {/* Header Image */}
                <View className="relative h-64 bg-muted">
                    {service.image ? (
                        <Image
                            source={{ uri: service.image }}
                            className="w-full h-full"
                            resizeMode="cover"
                        />
                    ) : (
                        <View className="w-full h-full items-center justify-center bg-muted">
                            <Text className="text-muted-foreground">No Image</Text>
                        </View>
                    )}
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="absolute top-4 left-4 bg-background/80 p-2 rounded-full"
                    >
                        <ArrowLeft size={24} color="#000" />
                    </TouchableOpacity>
                </View>

                <View className="p-4 space-y-6">
                    {/* Title and Price */}
                    <View className="flex-row justify-between items-start">
                        <View className="flex-1 mr-4">
                            <Text className="text-2xl font-bold text-foreground">{service.name}</Text>
                            <View className="flex-row items-center mt-1">
                                <Star size={16} className="text-yellow-500 fill-yellow-500" color="#eab308" />
                                <Text className="text-sm text-muted-foreground ml-1">
                                    {averageRating.toFixed(1)} ({reviewCount} reviews)
                                </Text>
                            </View>
                        </View>
                        <Text className="text-xl font-bold text-primary">₹{service.price}</Text>
                    </View>

                    {/* Provider Info */}
                    <Card>
                        <CardContent className="p-4 flex-row items-center gap-3">
                            <View className="h-12 w-12 rounded-full bg-muted items-center justify-center overflow-hidden">
                                {service.provider?.profilePicture ? (
                                    <Image
                                        source={{ uri: service.provider.profilePicture }}
                                        className="w-full h-full"
                                    />
                                ) : (
                                    <Text className="text-lg font-bold text-muted-foreground">
                                        {providerName.charAt(0).toUpperCase()}
                                    </Text>
                                )}
                            </View>
                            <View>
                                <Text className="font-semibold text-foreground">{providerName}</Text>
                                <Text className="text-xs text-muted-foreground">Service Provider</Text>
                            </View>
                        </CardContent>
                    </Card>

                    {/* Details */}
                    <View className="space-y-2">
                        <View className="flex-row items-center gap-2">
                            <Clock size={16} className="text-muted-foreground" color="#6b7280" />
                            <Text className="text-sm text-foreground">Duration: {service.duration} minutes</Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                            <MapPin size={16} className="text-muted-foreground" color="#6b7280" />
                            <Text className="text-sm text-foreground flex-1">
                                {service.addressStreet
                                    ? `${service.addressStreet}, ${service.addressCity}`
                                    : "Location not specified"}
                            </Text>
                        </View>
                    </View>

                    {/* Description */}
                    <View>
                        <Text className="text-lg font-semibold mb-2 text-foreground">About</Text>
                        <Text className="text-muted-foreground leading-relaxed">
                            {service.description}
                        </Text>
                    </View>

                    {/* Reviews Preview */}
                    <View>
                        <Text className="text-lg font-semibold mb-2 text-foreground">Reviews</Text>
                        {reviewCount === 0 ? (
                            <Text className="text-muted-foreground italic">No reviews yet.</Text>
                        ) : (
                            <View className="space-y-3">
                                {service.reviews.slice(0, 3).map((review: any) => (
                                    <Card key={review.id} className="bg-muted/30">
                                        <CardContent className="p-3">
                                            <View className="flex-row items-center gap-1 mb-1">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        size={12}
                                                        color={i < review.rating ? "#eab308" : "#d1d5db"}
                                                        fill={i < review.rating ? "#eab308" : "transparent"}
                                                    />
                                                ))}
                                            </View>
                                            <Text className="text-sm text-foreground">{review.review}</Text>
                                        </CardContent>
                                    </Card>
                                ))}
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Action Bar */}
            <View className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
                <Button
                    className="w-full"
                    onPress={() => router.push(`/book/${id}`)}
                >
                    <Text>Book Now</Text>
                </Button>
            </View>
        </SafeAreaView>
    );
}
