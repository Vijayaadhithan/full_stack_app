import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../../../lib/queryClient";
import { Button } from "../../../components/ui/button";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react-native";
import { addDays, format, addMinutes, isBefore, startOfDay } from "date-fns";
import { cn } from "../../../lib/utils";

// Simplified TimeSlot type
type TimeSlot = {
    start: Date;
    end: Date;
    available: boolean;
};

// Simplified slot generation (mock logic for now to avoid complex timezone/break logic in MVP)
// In a real app, this should match the web logic exactly or be handled by the backend.
function generateSimpleSlots(date: Date, duration: number = 60): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const startHour = 9; // 9 AM
    const endHour = 18; // 6 PM

    let currentTime = new Date(date);
    currentTime.setHours(startHour, 0, 0, 0);

    const endTime = new Date(date);
    endTime.setHours(endHour, 0, 0, 0);

    while (currentTime < endTime) {
        const slotEnd = addMinutes(currentTime, duration);
        if (slotEnd > endTime) break;

        slots.push({
            start: new Date(currentTime),
            end: slotEnd,
            available: Math.random() > 0.3, // Random availability for MVP demo
        });

        currentTime = slotEnd;
    }
    return slots;
}

export default function BookService() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

    const { data: service, isLoading } = useQuery({
        queryKey: [`/api/services/${id}`],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/services/${id}`);
            return res.json();
        },
        enabled: !!id,
    });

    const slots = useMemo(() => {
        if (!service) return [];
        return generateSimpleSlots(selectedDate, service.duration || 60);
    }, [selectedDate, service]);

    const createBookingMutation = useMutation({
        mutationFn: async () => {
            if (!selectedSlot || !service) return;
            const res = await apiRequest("POST", "/api/bookings", {
                serviceId: Number(id),
                bookingDate: selectedSlot.start.toISOString(),
                serviceLocation: "provider", // Defaulting to provider for MVP
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Booking failed");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
            Alert.alert("Success", "Booking request sent!", [
                { text: "OK", onPress: () => router.replace("/(app)/dashboard") }
            ]);
        },
        onError: (error: Error) => {
            Alert.alert("Error", error.message);
        },
    });

    const handleBook = () => {
        if (!selectedSlot) return;
        createBookingMutation.mutate();
    };

    // Date Picker Logic (Next 14 days)
    const dates = useMemo(() => {
        return Array.from({ length: 14 }).map((_, i) => addDays(new Date(), i));
    }, []);

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center bg-background">
                <Text>Loading...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background">
            <Stack.Screen options={{ headerShown: false }} />
            <View className="flex-row items-center p-4 border-b border-border">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <ArrowLeft size={24} color="#000" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-foreground">Book Service</Text>
            </View>

            <ScrollView contentContainerClassName="p-4 pb-24 space-y-6">
                {/* Service Summary */}
                <View className="bg-muted/30 p-4 rounded-lg">
                    <Text className="font-semibold text-lg text-foreground">{service?.name}</Text>
                    <Text className="text-muted-foreground">Duration: {service?.duration} mins</Text>
                    <Text className="text-primary font-bold mt-1">₹{service?.price}</Text>
                </View>

                {/* Date Selection */}
                <View className="space-y-3">
                    <Text className="font-semibold text-foreground">Select Date</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                        {dates.map((date) => {
                            const isSelected = format(date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
                            return (
                                <TouchableOpacity
                                    key={date.toISOString()}
                                    onPress={() => {
                                        setSelectedDate(date);
                                        setSelectedSlot(null);
                                    }}
                                    className={cn(
                                        "mr-3 p-3 rounded-xl items-center min-w-[60px] border",
                                        isSelected ? "bg-primary border-primary" : "bg-card border-border"
                                    )}
                                >
                                    <Text className={cn("text-xs mb-1", isSelected ? "text-primary-foreground" : "text-muted-foreground")}>
                                        {format(date, "EEE")}
                                    </Text>
                                    <Text className={cn("text-lg font-bold", isSelected ? "text-primary-foreground" : "text-foreground")}>
                                        {format(date, "d")}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Time Selection */}
                <View className="space-y-3">
                    <Text className="font-semibold text-foreground">Select Time</Text>
                    <View className="flex-row flex-wrap gap-3">
                        {slots.map((slot, index) => {
                            const isSelected = selectedSlot?.start.toISOString() === slot.start.toISOString();
                            return (
                                <TouchableOpacity
                                    key={index}
                                    disabled={!slot.available}
                                    onPress={() => setSelectedSlot(slot)}
                                    className={cn(
                                        "w-[30%] p-3 rounded-lg border items-center justify-center",
                                        isSelected
                                            ? "bg-primary border-primary"
                                            : slot.available
                                                ? "bg-card border-border"
                                                : "bg-muted border-transparent opacity-50"
                                    )}
                                >
                                    <Text className={cn(
                                        "text-sm font-medium",
                                        isSelected ? "text-primary-foreground" : "text-foreground"
                                    )}>
                                        {format(slot.start, "h:mm a")}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Action Bar */}
            <View className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
                <Button
                    className="w-full"
                    disabled={!selectedSlot || createBookingMutation.isPending}
                    onPress={handleBook}
                >
                    <Text>
                        {createBookingMutation.isPending ? "Booking..." : "Confirm Booking"}
                    </Text>
                </Button>
            </View>
        </SafeAreaView>
    );
}
