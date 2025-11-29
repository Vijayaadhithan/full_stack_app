import React, { useEffect } from "react";
import {
    View,
    Text,
    ScrollView,
    TextInput,
    ActivityIndicator,
} from "react-native";
import { useRouter, Stack } from "expo-router";
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

const shopProfileSchema = z.object({
    name: z.string().min(1, "Shop name is required"),
    description: z.string().optional(),
    address: z.string().min(1, "Address is required"),
    phone: z.string().min(1, "Phone is required"),
});

type ShopProfileData = z.infer<typeof shopProfileSchema>;

export default function ShopProfileScreen() {
    const router = useRouter();
    const { toast } = useToast();
    const { user } = useAuth();

    const { control, handleSubmit, reset, formState: { errors } } = useForm<ShopProfileData>({
        resolver: zodResolver(shopProfileSchema) as any,
        defaultValues: {
            name: "",
            description: "",
            address: "",
            phone: "",
        },
    });

    const { data: shop, isLoading } = useQuery({
        queryKey: [`/api/shops/${user?.shopProfile?.id}`],
        queryFn: async () => {
            if (!user?.shopProfile?.id) return null;
            const res = await apiRequest("GET", `/api/shops/${user.shopProfile.id}`);
            return res.json();
        },
        enabled: !!user?.shopProfile?.id,
    });

    useEffect(() => {
        if (shop) {
            reset({
                name: shop.name,
                description: shop.description || "",
                address: shop.address || "",
                phone: shop.phone || "",
            });
        }
    }, [shop, reset]);

    const mutation = useMutation({
        mutationFn: async (data: ShopProfileData) => {
            const res = await apiRequest("PATCH", `/api/shops/${user?.shopProfile?.id}`, data);
            if (!res.ok) throw new Error("Failed to update shop profile");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/shops/${user?.shopProfile?.id}`] });
            toast("Success", "Shop profile updated successfully");
        },
        onError: (error: Error) => {
            toast("Error", error.message);
        },
    });

    const onSubmit = (data: ShopProfileData) => {
        mutation.mutate(data);
    };

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

            <View className="px-4 py-2 border-b border-border flex-row items-center gap-2">
                <Button variant="ghost" size="icon" onPress={() => router.back()}>
                    <ArrowLeft size={24} className="text-foreground" />
                </Button>
                <Text className="text-lg font-semibold">Shop Settings</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <View className="space-y-4">
                    <View className="space-y-2">
                        <Label>Shop Name</Label>
                        <Controller
                            control={control}
                            name="name"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className="h-10 px-3 rounded-md border border-input bg-background"
                                    placeholder="Enter shop name"
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

                    <View className="space-y-2">
                        <Label>Address</Label>
                        <Controller
                            control={control}
                            name="address"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className="h-20 px-3 py-2 rounded-md border border-input bg-background"
                                    placeholder="Enter shop address"
                                    multiline
                                    textAlignVertical="top"
                                    value={value}
                                    onChangeText={onChange}
                                />
                            )}
                        />
                        {errors.address && (
                            <Text className="text-destructive text-sm">{errors.address.message}</Text>
                        )}
                    </View>

                    <View className="space-y-2">
                        <Label>Phone</Label>
                        <Controller
                            control={control}
                            name="phone"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className="h-10 px-3 rounded-md border border-input bg-background"
                                    placeholder="Enter phone number"
                                    keyboardType="phone-pad"
                                    value={value}
                                    onChangeText={onChange}
                                />
                            )}
                        />
                        {errors.phone && (
                            <Text className="text-destructive text-sm">{errors.phone.message}</Text>
                        )}
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
                                Save Changes
                            </Text>
                        )}
                    </Button>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
