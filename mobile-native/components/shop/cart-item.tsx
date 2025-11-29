import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2 } from "lucide-react-native";
import { Product } from "./product-card";

interface CartItemProps {
    item: {
        product: Product;
        quantity: number;
    };
    onUpdateQuantity: (productId: number, quantity: number) => void;
    onRemove: (productId: number) => void;
    isUpdating?: boolean;
    isRemoving?: boolean;
}

export function CartItem({
    item,
    onUpdateQuantity,
    onRemove,
    isUpdating,
    isRemoving,
}: CartItemProps) {
    const { product, quantity } = item;

    return (
        <View className="flex-row gap-4 py-4 border-b border-border">
            <Image
                source={{
                    uri: product.images?.[0] || "https://via.placeholder.com/100",
                }}
                className="w-20 h-20 rounded-md bg-muted"
                resizeMode="cover"
            />
            <View className="flex-1 justify-between">
                <View>
                    <Text className="font-semibold text-base" numberOfLines={1}>
                        {product.name}
                    </Text>
                    <Text className="text-sm text-muted-foreground mt-1">
                        ₹{product.price} × {quantity}
                    </Text>
                </View>
                <View className="flex-row items-center gap-3 mt-2">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onPress={() => onUpdateQuantity(product.id, quantity - 1)}
                        disabled={quantity <= 1 || isUpdating}
                    >
                        <Minus size={14} className="text-foreground" />
                    </Button>
                    <Text className="w-6 text-center font-medium">{quantity}</Text>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onPress={() => onUpdateQuantity(product.id, quantity + 1)}
                        disabled={quantity >= product.stock || isUpdating}
                    >
                        <Plus size={14} className="text-foreground" />
                    </Button>
                </View>
            </View>
            <View className="justify-between items-end">
                <Text className="font-bold text-base">
                    ₹{(parseFloat(product.price) * quantity).toFixed(2)}
                </Text>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onPress={() => onRemove(product.id)}
                    disabled={isRemoving}
                >
                    <Trash2 size={18} className="text-destructive" />
                </Button>
            </View>
        </View>
    );
}
