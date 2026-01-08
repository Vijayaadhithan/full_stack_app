import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
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

    // Track if this is the first mode initialization (to avoid navigating on every render)
    const hasInitializedMode = useRef(false);
    const [, setLocation] = useLocation();

    // Load saved mode from localStorage or initialize based on user's primary role
    useEffect(() => {
        // Wait for profiles to actually load before initializing
        // isLoadingProfiles is true when the query is in progress
        // We need profiles data to correctly determine the user's role
        if (!user || isLoadingProfiles) {
            return;
        }

        const savedMode = localStorage.getItem("appMode") as AppMode | null;

        // Helper function to set mode and optionally navigate
        const setModeAndNavigate = (mode: AppMode, shouldNavigate: boolean) => {
            setAppModeInternal(mode);
            localStorage.setItem("appMode", mode);

            // Only navigate if this is the first initialization and we're on a mismatched page
            if (shouldNavigate && !hasInitializedMode.current) {
                const currentPath = window.location.pathname;
                const modeToPath: Record<AppMode, string> = {
                    "SHOP": "/shop",
                    "PROVIDER": "/provider",
                    "CUSTOMER": "/customer"
                };
                const expectedPath = modeToPath[mode];

                // Navigate if we're on a different role's dashboard (or root/generic pages)
                if (currentPath === "/customer" || currentPath === "/" || currentPath === "/auth") {
                    setLocation(expectedPath);
                }
            }
            hasInitializedMode.current = true;
        };

        if (savedMode && Object.keys(MODE_THEMES).includes(savedMode)) {
            // Validate the user can access the saved mode
            if (savedMode === "SHOP" && !profiles.hasShop) {
                setModeAndNavigate("CUSTOMER", false);
            } else if (savedMode === "PROVIDER" && !profiles.hasProvider) {
                setModeAndNavigate("CUSTOMER", false);
            } else {
                setAppModeInternal(savedMode);
                hasInitializedMode.current = true;
            }
        } else {
            // No saved mode - initialize based on user's primary role or profile
            // Priority: 1) User's explicit role, 2) Shop profile, 3) Provider profile, 4) Customer
            if (user.role === "shop" || user.role === "worker") {
                setModeAndNavigate("SHOP", true);
            } else if (user.role === "provider") {
                setModeAndNavigate("PROVIDER", true);
            } else if (profiles.hasShop) {
                // Customer with shop profile - default to shop mode
                setModeAndNavigate("SHOP", true);
            } else if (profiles.hasProvider) {
                // Customer with provider profile - default to provider mode  
                setModeAndNavigate("PROVIDER", true);
            } else {
                // Pure customer
                hasInitializedMode.current = true;
            }
        }
    }, [user, profiles, isLoadingProfiles, setLocation]);

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
