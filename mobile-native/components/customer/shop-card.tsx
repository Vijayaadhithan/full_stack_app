import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";

type Shop = {
    id: number;
    name: string;
    description?: string;
    image?: string;
    location?: string;
};

type ShopCardProps = {
    shop: Shop;
    onPress?: () => void;
};

export function ShopCard({ shop, onPress }: ShopCardProps) {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
            <Card className="w-[240px] mr-4 overflow-hidden">
                <View className="h-28 bg-muted items-center justify-center overflow-hidden">
                    {shop.image ? (
                        <Image
                            source={{ uri: shop.image }}
                            className="w-full h-full"
                            resizeMode="cover"
                        />
                    ) : (
                        <Text className="text-muted-foreground">No Image</Text>
                    )}
                </View>
                <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-base line-clamp-1">{shop.name}</CardTitle>
                    {shop.location && (
                        <Text className="text-xs text-muted-foreground">{shop.location}</Text>
                    )}
                </CardHeader>
                <CardContent className="p-3 pt-1">
                    <Text className="text-xs text-muted-foreground line-clamp-2" numberOfLines={2}>
                        {shop.description || "No description available"}
                    </Text>
                </CardContent>
            </Card>
        </TouchableOpacity>
    );
}
