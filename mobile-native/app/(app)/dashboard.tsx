import React from "react";
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity } from "react-native";
import { useAuth } from "../../hooks/use-auth";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ServiceCard } from "../../components/customer/service-card";
import { ShopCard } from "../../components/customer/shop-card";
import { Calendar, ShoppingBag, Store, Package, Search } from "lucide-react-native";
import { Input } from "../../components/ui/input";
import { useRouter } from "expo-router";

// Placeholder data
const POPULAR_SERVICES = [
    {
        id: 1,
        name: "House Cleaning",
        description: "Professional house cleaning service for all room types.",
        price: 1500,
        providerName: "CleanPro Services",
        image: "https://images.unsplash.com/photo-1581578731117-104f2a863a38?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    },
    {
        id: 2,
        name: "AC Repair",
        description: "Expert AC repair and maintenance.",
        price: 800,
        providerName: "CoolAir Tech",
        image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    },
    {
        id: 3,
        name: "Plumbing Fix",
        description: "Quick fix for leaks and blocks.",
        price: 500,
        providerName: "Mario Plumbers",
        image: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    },
];

const FEATURED_SHOPS = [
    {
        id: 1,
        name: "Green Grocers",
        description: "Fresh vegetables and fruits delivered daily.",
        location: "Anna Nagar, Chennai",
        image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    },
    {
        id: 2,
        name: "Style Salon",
        description: "Premium hair and beauty salon.",
        location: "T. Nagar, Chennai",
        image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    },
];

export default function Dashboard() {
    const { user } = useAuth();
    const router = useRouter();

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView contentContainerClassName="p-4 pb-20 space-y-6">
                {/* Header */}
                <View>
                    <Text className="text-2xl font-bold text-foreground">
                        Welcome, {user?.name || user?.username}!
                    </Text>
                    <Text className="text-muted-foreground">
                        Find services and shops near you.
                    </Text>
                </View>

                {/* Search Bar */}
                <View className="relative">
                    <View className="absolute left-3 top-3 z-10">
                        <Search size={20} className="text-muted-foreground" color="#6b7280" />
                    </View>
                    <Input
                        placeholder="Search for services, shops..."
                        className="pl-10 bg-muted/50 border-muted"
                    />
                </View>

                {/* Quick Actions */}
                <View className="flex-row flex-wrap gap-3">
                    <QuickAction
                        icon={Calendar}
                        label="Services"
                        onPress={() => console.log("Browse Services")}
                    />
                    <QuickAction
                        icon={Store}
                        label="Shops"
                        onPress={() => console.log("Browse Shops")}
                    />
                    <QuickAction
                        icon={ShoppingBag}
                        label="Products"
                        onPress={() => console.log("Browse Products")}
                    />
                    <QuickAction
                        icon={Package}
                        label="Orders"
                        onPress={() => console.log("My Orders")}
                    />
                </View>

                {/* Popular Services */}
                <View className="space-y-3">
                    <View className="flex-row justify-between items-center">
                        <Text className="text-lg font-semibold text-foreground">Popular Services</Text>
                        <TouchableOpacity>
                            <Text className="text-primary text-sm">See All</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {POPULAR_SERVICES.map((service) => (
                            <ServiceCard
                                key={service.id}
                                service={service}
                                onBook={() => console.log(`Book ${service.id}`)}
                            />
                        ))}
                    </ScrollView>
                </View>

                {/* Featured Shops */}
                <View className="space-y-3">
                    <View className="flex-row justify-between items-center">
                        <Text className="text-lg font-semibold text-foreground">Featured Shops</Text>
                        <TouchableOpacity>
                            <Text className="text-primary text-sm">See All</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {FEATURED_SHOPS.map((shop) => (
                            <ShopCard
                                key={shop.id}
                                shop={shop}
                                onPress={() => console.log(`View Shop ${shop.id}`)}
                            />
                        ))}
                    </ScrollView>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

function QuickAction({ icon: Icon, label, onPress }: { icon: any, label: string, onPress: () => void }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            className="flex-1 min-w-[45%] bg-card border border-border rounded-xl p-4 items-center justify-center space-y-2 shadow-sm"
        >
            <View className="bg-primary/10 p-3 rounded-full">
                <Icon size={24} className="text-primary" color="#2563eb" />
            </View>
            <Text className="font-medium text-foreground">{label}</Text>
        </TouchableOpacity>
    );
}
