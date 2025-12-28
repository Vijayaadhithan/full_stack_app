import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import type { User, AppMode, Shop, Provider } from "@shared/schema";

// Theme configuration for each mode
const MODE_THEMES: Record<AppMode, { class: string; primary: string; label: string }> = {
    CUSTOMER: {
        class: "mode-customer",
        primary: "hsl(25, 95%, 53%)", // Orange/Saffron
        label: "வாடிக்கையாளர்", // Customer in Tamil
    },
    SHOP: {
        class: "mode-shop",
        primary: "hsl(142, 71%, 45%)", // Green
        label: "கடை", // Shop in Tamil
    },
    PROVIDER: {
        class: "mode-provider",
        primary: "hsl(217, 91%, 60%)", // Blue
        label: "சேவை", // Provider in Tamil
    },
};

interface UserProfiles {
    hasShop: boolean;
    shop: Shop | null;
    hasProvider: boolean;
    provider: Provider | null;
}

interface UserContextType {
    user: Omit<User, "password" | "pin"> | null;
    isLoading: boolean;
    appMode: AppMode;
    setAppMode: (mode: AppMode) => void;
    profiles: UserProfiles;
    isLoadingProfiles: boolean;
    themeClass: string;
    currentTheme: typeof MODE_THEMES[AppMode];
    refetchProfiles: () => void;
}

const defaultProfiles: UserProfiles = {
    hasShop: false,
    shop: null,
    hasProvider: false,
    provider: null,
};

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
    const [appMode, setAppModeInternal] = useState<AppMode>("CUSTOMER");

    // Fetch current user
    const {
        data: user,
        isLoading: isUserLoading,
    } = useQuery<Omit<User, "password" | "pin"> | null>({
        queryKey: ["/api/user"],
        queryFn: getQueryFn({ on401: "returnNull" }),
        staleTime: 10000,
        refetchOnWindowFocus: true,
    });

    // Fetch user profiles (shop and provider)
    const {
        data: profilesData,
        isLoading: isLoadingProfiles,
        refetch: refetchProfiles,
    } = useQuery<UserProfiles>({
        queryKey: ["/api/auth/profiles"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/auth/profiles");
            return res.json();
        },
        enabled: !!user,
        staleTime: 30000,
    });

    const profiles = profilesData ?? defaultProfiles;

    // Apply theme class to document body
    useEffect(() => {
        const theme = MODE_THEMES[appMode];
        const body = document.body;

        // Remove all mode classes
        Object.values(MODE_THEMES).forEach((t) => {
            body.classList.remove(t.class);
        });

        // Add current mode class
        body.classList.add(theme.class);

        // Update CSS variable for primary color
        document.documentElement.style.setProperty("--mode-primary", theme.primary);

        return () => {
            body.classList.remove(theme.class);
        };
    }, [appMode]);

    // Load saved mode from localStorage
    useEffect(() => {
        const savedMode = localStorage.getItem("appMode") as AppMode | null;
        if (savedMode && Object.keys(MODE_THEMES).includes(savedMode)) {
            // Validate the user can access this mode
            if (savedMode === "SHOP" && !profiles.hasShop) {
                setAppModeInternal("CUSTOMER");
            } else if (savedMode === "PROVIDER" && !profiles.hasProvider) {
                setAppModeInternal("CUSTOMER");
            } else {
                setAppModeInternal(savedMode);
            }
        }
    }, [profiles]);

    const setAppMode = useCallback((mode: AppMode) => {
        // Validate mode access
        if (mode === "SHOP" && !profiles.hasShop) {
            console.warn("User does not have a shop profile");
            return;
        }
        if (mode === "PROVIDER" && !profiles.hasProvider) {
            console.warn("User does not have a provider profile");
            return;
        }

        setAppModeInternal(mode);
        localStorage.setItem("appMode", mode);
    }, [profiles]);

    const currentTheme = MODE_THEMES[appMode];

    return (
        <UserContext.Provider
            value={{
                user: user ?? null,
                isLoading: isUserLoading,
                appMode,
                setAppMode,
                profiles,
                isLoadingProfiles,
                themeClass: currentTheme.class,
                currentTheme,
                refetchProfiles,
            }}
        >
            {children}
        </UserContext.Provider>
    );
}

export function useUserContext() {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error("useUserContext must be used within a UserProvider");
    }
    return context;
}

// Export helper hook for just the app mode
export function useAppMode() {
    const { appMode, setAppMode, currentTheme, refetchProfiles } = useUserContext();
    return { appMode, setAppMode, theme: currentTheme, refetchProfiles };
}
