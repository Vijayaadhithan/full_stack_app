import React, { useEffect } from "react";
import {
    View,
    Text,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    Switch,
} from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react-native";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

const productSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    price: z.string().min(1, "Price is required"),
    mrp: z.string().optional(),
    stock: z.string().min(1, "Stock is required"),
    category: z.string().min(1, "Category is required"),
    isAvailable: z.boolean().default(true),
    // Simplified for mobile MVP - image handling would need a proper picker
    images: z.array(z.string()).default([]),
});

type ProductFormData = z.infer<typeof productSchema>;

export default function ManageProductScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const isEditing = !!id;
    const router = useRouter();
    const { toast } = useToast();
    const { user } = useAuth();

    const { control, handleSubmit, reset, setValue, formState: { errors } } = useForm<ProductFormData>({
        resolver: zodResolver(productSchema) as any,
        defaultValues: {
            name: "",
            description: "",
            price: "",
            mrp: "",
            stock: "",
            category: "",
            isAvailable: true,
            images: [],
        },
    });

    const { data: product, isLoading: isLoadingProduct } = useQuery({
        queryKey: [`/api/products/${id}`],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/products/${id}`);
            return res.json();
        },
        enabled: isEditing,
    });

    useEffect(() => {
        if (product) {
            reset({
                name: product.name,
                description: product.description || "",
                price: String(product.price),
                mrp: product.mrp ? String(product.mrp) : "",
                stock: String(product.stock),
                category: product.category || "",
                isAvailable: product.isAvailable,
                images: product.images || [],
            });
        }
    }, [product, reset]);

    const mutation = useMutation({
        mutationFn: async (data: ProductFormData) => {
            const payload = {
                ...data,
                price: parseFloat(data.price),
                mrp: data.mrp ? parseFloat(data.mrp) : undefined,
                stock: parseInt(data.stock),
                shopId: user?.shopProfile?.id,
            };

            if (isEditing) {
                const res = await apiRequest("PATCH", `/api/products/${id}`, payload);
                if (!res.ok) throw new Error("Failed to update product");
                return res.json();
            } else {
                const res = await apiRequest("POST", "/api/products", payload);
                if (!res.ok) throw new Error("Failed to create product");
                return res.json();
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/products/shop/${user?.shopProfile?.id}`] });
            toast("Success", `Product ${isEditing ? "updated" : "created"} successfully`);
            router.back();
        },
        onError: (error: Error) => {
            toast("Error", error.message);
        },
    });

    const onSubmit = (data: ProductFormData) => {
        mutation.mutate(data);
    };

    if (isEditing && isLoadingProduct) {
        return (
            <View className="flex-1 items-center justify-center bg-background">
                <ActivityIndicator size="large" color="#2563eb" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
            <Stack.Screen options={{ headerShown: false }} />

            <View className="px-4 py-2 border-b border-border flex-row items-center gap-2">
                <Button variant="ghost" size="icon" onPress={() => router.back()}>
                    <ArrowLeft size={24} className="text-foreground" />
                </Button>
                <Text className="text-lg font-semibold">
                    {isEditing ? "Edit Product" : "Add Product"}
                </Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <View className="space-y-4">
                    <View className="space-y-2">
                        <Label>Product Name</Label>
                        <Controller
                            control={control}
                            name="name"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className="h-10 px-3 rounded-md border border-input bg-background"
                                    placeholder="Enter product name"
                                    value={value}
                                    onChangeText={onChange}
                                />
                            )}
                        />
                        {errors.name && (
                            <Text className="text-destructive text-sm">{errors.name.message}</Text>
                        )}
                    </View>

                    <View className="space-y-2">
                        <Label>Description</Label>
                        <Controller
                            control={control}
                            name="description"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className="h-24 px-3 py-2 rounded-md border border-input bg-background"
                                    placeholder="Enter description"
                                    multiline
                                    textAlignVertical="top"
                                    value={value}
                                    onChangeText={onChange}
                                />
                            )}
                        />
                    </View>

                    <View className="flex-row gap-4">
                        <View className="flex-1 space-y-2">
                            <Label>Price (₹)</Label>
                            <Controller
                                control={control}
                                name="price"
                                render={({ field: { onChange, value } }) => (
                                    <TextInput
                                        className="h-10 px-3 rounded-md border border-input bg-background"
                                        placeholder="0.00"
                                        keyboardType="numeric"
                                        value={value}
                                        onChangeText={onChange}
                                    />
                                )}
                            />
                            {errors.price && (
                                <Text className="text-destructive text-sm">{errors.price.message}</Text>
                            )}
                        </View>

                        <View className="flex-1 space-y-2">
                            <Label>MRP (₹)</Label>
                            <Controller
                                control={control}
                                name="mrp"
                                render={({ field: { onChange, value } }) => (
                                    <TextInput
                                        className="h-10 px-3 rounded-md border border-input bg-background"
                                        placeholder="0.00"
                                        keyboardType="numeric"
                                        value={value}
                                        onChangeText={onChange}
                                    />
                                )}
                            />
                        </View>
                    </View>

                    <View className="flex-row gap-4">
                        <View className="flex-1 space-y-2">
                            <Label>Stock</Label>
                            <Controller
                                control={control}
                                name="stock"
                                render={({ field: { onChange, value } }) => (
                                    <TextInput
                                        className="h-10 px-3 rounded-md border border-input bg-background"
                                        placeholder="0"
                                        keyboardType="numeric"
                                        value={value}
                                        onChangeText={onChange}
                                    />
                                )}
                            />
                            {errors.stock && (
                                <Text className="text-destructive text-sm">{errors.stock.message}</Text>
                            )}
                        </View>

                        <View className="flex-1 space-y-2">
                            <Label>Category</Label>
                            <Controller
                                control={control}
                                name="category"
                                render={({ field: { onChange, value } }) => (
                                    <TextInput
                                        className="h-10 px-3 rounded-md border border-input bg-background"
                                        placeholder="Category"
                                        value={value}
                                        onChangeText={onChange}
                                    />
                                )}
                            />
                            {errors.category && (
                                <Text className="text-destructive text-sm">{errors.category.message}</Text>
                            )}
                        </View>
                    </View>

                    <View className="flex-row items-center justify-between py-2">
                        <Label>Available for Sale</Label>
                        <Controller
                            control={control}
                            name="isAvailable"
                            render={({ field: { onChange, value } }) => (
                                <Switch
                                    value={value}
                                    onValueChange={onChange}
                                    trackColor={{ false: "#767577", true: "#2563eb" }}
                                />
                            )}
                        />
                    </View>

                    <Button
                        className="mt-6"
                        onPress={handleSubmit(onSubmit) as any}
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-primary-foreground font-bold">
                                {isEditing ? "Update Product" : "Create Product"}
                            </Text>
                        )}
                    </Button>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
