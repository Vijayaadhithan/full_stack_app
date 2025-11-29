import React, { useEffect } from "react";
import {
    View,
    Text,
    ScrollView,
    TextInput,
    ActivityIndicator,
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

const serviceSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().min(1, "Description is required"),
    price: z.string().min(1, "Price is required"),
    duration: z.string().min(1, "Duration is required"),
    category: z.string().min(1, "Category is required"),
    isActive: z.boolean().default(true),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

export default function ManageServiceScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const isEditing = !!id;
    const router = useRouter();
    const { toast } = useToast();

    const { control, handleSubmit, reset, formState: { errors } } = useForm<ServiceFormData>({
        resolver: zodResolver(serviceSchema) as any,
        defaultValues: {
            name: "",
            description: "",
            price: "",
            duration: "",
            category: "",
            isActive: true,
        },
    });

    const { data: service, isLoading: isLoadingService } = useQuery({
        queryKey: [`/api/services/${id}`],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/services/${id}`);
            return res.json();
        },
        enabled: isEditing,
    });

    useEffect(() => {
        if (service) {
            reset({
                name: service.name,
                description: service.description,
                price: String(service.price),
                duration: String(service.duration),
                category: service.category,
                isActive: service.isActive,
            });
        }
    }, [service, reset]);

    const mutation = useMutation({
        mutationFn: async (data: ServiceFormData) => {
            const payload = {
                ...data,
                price: parseFloat(data.price),
                duration: parseInt(data.duration),
            };

            if (isEditing) {
                const res = await apiRequest("PATCH", `/api/services/${id}`, payload);
                if (!res.ok) throw new Error("Failed to update service");
                return res.json();
            } else {
                const res = await apiRequest("POST", "/api/services", payload);
                if (!res.ok) throw new Error("Failed to create service");
                return res.json();
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/services/provider"] });
            toast("Success", `Service ${isEditing ? "updated" : "created"} successfully`);
            router.back();
        },
        onError: (error: Error) => {
            toast("Error", error.message);
        },
    });

    const onSubmit = (data: ServiceFormData) => {
        mutation.mutate(data);
    };

    if (isEditing && isLoadingService) {
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
                    {isEditing ? "Edit Service" : "Add Service"}
                </Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <View className="space-y-4">
                    <View className="space-y-2">
                        <Label>Service Name</Label>
                        <Controller
                            control={control}
                            name="name"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className="h-10 px-3 rounded-md border border-input bg-background"
                                    placeholder="Enter service name"
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
                        {errors.description && (
                            <Text className="text-destructive text-sm">{errors.description.message}</Text>
                        )}
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
                            <Label>Duration (mins)</Label>
                            <Controller
                                control={control}
                                name="duration"
                                render={({ field: { onChange, value } }) => (
                                    <TextInput
                                        className="h-10 px-3 rounded-md border border-input bg-background"
                                        placeholder="60"
                                        keyboardType="numeric"
                                        value={value}
                                        onChangeText={onChange}
                                    />
                                )}
                            />
                            {errors.duration && (
                                <Text className="text-destructive text-sm">{errors.duration.message}</Text>
                            )}
                        </View>
                    </View>

                    <View className="space-y-2">
                        <Label>Category</Label>
                        <Controller
                            control={control}
                            name="category"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className="h-10 px-3 rounded-md border border-input bg-background"
                                    placeholder="e.g., Cleaning, Plumbing"
                                    value={value}
                                    onChangeText={onChange}
                                />
                            )}
                        />
                        {errors.category && (
                            <Text className="text-destructive text-sm">{errors.category.message}</Text>
                        )}
                    </View>

                    <View className="flex-row items-center justify-between py-2">
                        <Label>Active</Label>
                        <Controller
                            control={control}
                            name="isActive"
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
                                {isEditing ? "Update Service" : "Create Service"}
                            </Text>
                        )}
                    </Button>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
