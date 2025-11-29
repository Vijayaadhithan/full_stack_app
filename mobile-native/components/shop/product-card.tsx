import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Link } from "expo-router";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Heart, ShoppingCart } from "lucide-react-native";

export interface Product {
    id: number;
    name: string;
    description: string | null;
    price: string;
    mrp: string | null;
    images: string[];
    shopId: number | null;
    isAvailable: boolean;
    stock: number;
    category?: string;
}

interface ProductCardProps {
    product: Product;
    onAddToCart?: (product: Product) => void;
    onAddToWishlist?: (product: Product) => void;
    isAddingToCart?: boolean;
    isAddingToWishlist?: boolean;
}

export function ProductCard({
    product,
    onAddToCart,
    onAddToWishlist,
    isAddingToCart,
    isAddingToWishlist,
}: ProductCardProps) {
    const discountPercentage =
        product.mrp && parseFloat(product.mrp) > parseFloat(product.price)
            ? Math.round(
                ((parseFloat(product.mrp) - parseFloat(product.price)) /
                    parseFloat(product.mrp)) *
                100
            )
            : 0;

    return (
        <Link
            href={`/shops/${product.shopId}/products/${product.id}`}
            asChild
        >
            <TouchableOpacity activeOpacity={0.9}>
                <Card className="overflow-hidden h-full">
                    <View className="aspect-square relative bg-muted">
                        <Image
                            source={{
                                uri: product.images?.[0] || "https://via.placeholder.com/400",
                            }}
                            className="w-full h-full object-cover"
                            resizeMode="cover"
                        />
                        {discountPercentage > 0 && (
                            <View className="absolute top-2 right-2 bg-red-500 rounded px-2 py-1">
                                <Text className="text-white text-xs font-bold">
                                    {discountPercentage}% OFF
                                </Text>
                            </View>
                        )}
                        {!product.isAvailable && (
                            <View className="absolute inset-0 bg-black/50 items-center justify-center">
                                <Badge variant="destructive">Out of Stock</Badge>
                            </View>
                        )}
                    </View>
                    <CardContent className="p-3 space-y-2">
                        <Text className="font-semibold text-lg line-clamp-1" numberOfLines={1}>
                            {product.name}
                        </Text>
                        <Text
                            className="text-sm text-muted-foreground line-clamp-2 h-10"
                            numberOfLines={2}
                        >
                            {product.description || "No description available"}
                        </Text>
                        <View className="flex-row items-baseline gap-2">
                            <Text className="font-bold text-lg">₹{product.price}</Text>
                            {product.mrp && parseFloat(product.mrp) > parseFloat(product.price) && (
                                <Text className="text-sm text-muted-foreground line-through">
                                    ₹{product.mrp}
                                </Text>
                            )}
                        </View>
                    </CardContent>
                    <CardFooter className="p-3 pt-0 flex-row gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            className="w-10 h-10"
                            onPress={(e) => {
                                e.preventDefault();
                                onAddToWishlist?.(product);
                            }}
                            disabled={isAddingToWishlist}
                        >
                            <Heart
                                size={18}
                                className={isAddingToWishlist ? "opacity-50" : "text-foreground"}
                            />
                        </Button>
                        <Button
                            className="flex-1"
                            onPress={(e) => {
                                e.preventDefault();
                                onAddToCart?.(product);
                            }}
                            disabled={!product.isAvailable || isAddingToCart}
                        >
                            <ShoppingCart size={18} className="mr-2 text-primary-foreground" />
                            <Text className="text-primary-foreground font-medium">Add</Text>
                        </Button>
                    </CardFooter>
                </Card>
            </TouchableOpacity>
        </Link>
    );
}
