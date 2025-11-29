import React, { useState, useMemo } from "react";
import {
    View,
    Text,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Link, Stack } from "expo-router";
import { Search, Filter, MapPin, Store } from "lucide-react-native";
import { apiRequest } from "@/lib/queryClient";
import { ShopCard } from "@/components/customer/shop-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

// Temporary type definition until we have a shared types file
interface PublicShop {
    id: number;
    name: string;
    email: string;
    role: string;
    shopProfile?: {
        id: number;
        shopName: string;
        description: string | null;
        isVerified: boolean;
    };
    profilePicture?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    addressStreet?: string | null;
    addressCity?: string | null;
    addressState?: string | null;
    addressPostalCode?: string | null;
    addressCountry?: string | null;
}

export default function BrowseShopsScreen() {
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState("");
    const [cityFilter, setCityFilter] = useState("");
    const [stateFilter, setStateFilter] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        locationCity: "",
        locationState: "",
    });
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const { data: shops, isLoading } = useQuery<PublicShop[]>({
        queryKey: ["/api/shops", filters.locationCity, filters.locationState],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters.locationCity)
                params.append("locationCity", filters.locationCity);
            if (filters.locationState)
                params.append("locationState", filters.locationState);
            const queryString = params.toString();
            const response = await apiRequest(
                "GET",
                `/api/shops${queryString ? `?${queryString}` : ""}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch shops");
            }
            return response.json();
        },
    });

    const filteredShops = useMemo(() => {
        if (!shops) return [];
        return shops.filter((shop) => {
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            const displayName = shop.shopProfile?.shopName || shop.name || "";
            const nameMatch = displayName.toLowerCase().includes(query);
            const descMatch = shop.shopProfile?.description
                ?.toLowerCase()
                .includes(query);
            return nameMatch || descMatch;
        });
    }, [shops, searchQuery]);

    const applyFilters = () => {
        setFilters({
            locationCity: cityFilter,
            locationState: stateFilter,
        });
        setShowFilters(false);
    };

    return (
        <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
            <Stack.Screen options={{ headerShown: false }} />

            <View className="p-4 space-y-4">
                <View className="flex-row items-center justify-between">
                    <Text className="text-2xl font-bold">Browse Shops</Text>
                </View>

                <View className="flex-row gap-2">
                    <View className="flex-1 relative">
                        <Search
                            size={20}
                            className="absolute left-3 top-3 text-muted-foreground z-10"
                        />
                        <TextInput
                            className="h-10 pl-10 pr-4 rounded-md border border-input bg-background"
                            placeholder="Search shops..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholderTextColor="#6b7280"
                        />
                    </View>
                    <Button
                        variant="outline"
                        size="icon"
                        onPress={() => setIsFilterOpen(!isFilterOpen)}
                    >
                        <Filter size={20} className="text-foreground" />
                    </Button>
                </View>

                {/* Removed the old isFilterOpen conditional block */}
            </View>

            <Modal
                visible={showFilters}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowFilters(false)}
            >
                <View className="flex-1 bg-background p-6">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-xl font-bold">Filters</Text>
                        <Button variant="ghost" onPress={() => setShowFilters(false)}>
                            <Text>Close</Text>
                        </Button>
                    </View>

                    <View className="space-y-4">
                        <View className="space-y-2">
                            <Label>City</Label>
                            <Input
                                placeholder="Filter by city"
                                value={cityFilter}
                                onChangeText={setCityFilter}
                            />
                        </View>
                        <View className="space-y-2">
                            <Label>State</Label>
                            <Input
                                placeholder="Filter by state"
                                value={stateFilter}
                                onChangeText={setStateFilter}
                            />
                        </View>
                        <Button className="mt-4" onPress={applyFilters}>
                            <Text className="text-primary-foreground">Apply Filters</Text>
                        </Button>
                    </View>
                </View>
            </Modal>

            <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0 }}>
                {isLoading ? (
                    <View className="py-10 items-center">
                        <ActivityIndicator size="large" color="#2563eb" />
                    </View>
                ) : filteredShops.length === 0 ? (
                    <View className="py-10 items-center">
                        <Text className="text-muted-foreground text-center">
                            No shops found matching your criteria.
                        </Text>
                    </View>
                ) : (
                    <View className="gap-4">
                        {filteredShops.map((shop) => (
                            <ShopCard key={shop.id} shop={shop} />
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
