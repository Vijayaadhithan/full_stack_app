import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

// Placeholder type until we have the full schema
type Service = {
    id: number;
    name: string;
    description?: string;
    price: number;
    image?: string;
    providerName?: string;
};

type ServiceCardProps = {
    service: Service;
    onPress?: () => void;
    onBook?: () => void;
};

export function ServiceCard({ service, onPress, onBook }: ServiceCardProps) {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
            <Card className="w-[280px] mr-4 overflow-hidden">
                <View className="h-32 bg-muted items-center justify-center overflow-hidden">
                    {service.image ? (
                        <Image
                            source={{ uri: service.image }}
                            className="w-full h-full"
                            resizeMode="cover"
                        />
                    ) : (
                        <Text className="text-muted-foreground">No Image</Text>
                    )}
                </View>
                <CardHeader className="p-4 pb-2">
                    <View className="flex-row justify-between items-start">
                        <CardTitle className="text-lg line-clamp-1">{service.name}</CardTitle>
                        <Badge variant="secondary">₹{service.price}</Badge>
                    </View>
                    {service.providerName && (
                        <Text className="text-xs text-muted-foreground">{service.providerName}</Text>
                    )}
                </CardHeader>
                <CardContent className="p-4 pt-0 pb-2">
                    <Text className="text-sm text-muted-foreground line-clamp-2" numberOfLines={2}>
                        {service.description || "No description available"}
                    </Text>
                </CardContent>
                <CardFooter className="p-4 pt-2">
                    <Button className="w-full" onPress={onBook}>
                        <Text>Book Now</Text>
                    </Button>
                </CardFooter>
            </Card>
        </TouchableOpacity>
    );
}
