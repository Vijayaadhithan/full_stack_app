
import "../global.css";
import { Slot } from "expo-router";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { AuthProvider } from "../hooks/use-auth";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <Slot />
                </AuthProvider>
            </QueryClientProvider>
        </SafeAreaProvider>
    );
}
