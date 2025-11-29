import React, { createContext, ReactNode, useContext } from "react";
import {
    useQuery,
    useMutation,
    UseMutationResult,
} from "@tanstack/react-query";
import { User as SelectUser, InsertUser } from "@shared/schema";
import {
    getQueryFn,
    apiRequest,
    queryClient,
    resetCsrfTokenCache,
    getCsrfToken,
} from "../lib/queryClient";
import { useToast } from "./use-toast";
import * as SecureStore from "expo-secure-store";

type PublicUser = Omit<SelectUser, "password"> & {
    shopProfile?: ShopProfile;
};

// Mock ShopProfile type if not available in schema
type ShopProfile = {
    id: number;
    name: string;
    description?: string;
    address?: string;
    // add other fields as needed
};

type AuthContextType = {
    user: PublicUser | null;
    isFetching: boolean;
    error: Error | null;
    loginMutation: UseMutationResult<PublicUser, Error, LoginData>;
    logoutMutation: UseMutationResult<void, Error, void>;
    registerMutation: UseMutationResult<PublicUser, Error, InsertUser>;
};

type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const { toast } = useToast();

    React.useEffect(() => {
        let isMounted = true;
        void getCsrfToken().catch((error: unknown) => {
            if (!isMounted) {
                return;
            }
            console.error("Failed to prefetch CSRF token:", error);
            toast(
                "Security error",
                error instanceof Error
                    ? error.message
                    : "Failed to initialize secure session. Please refresh and try again."
            );
        });

        return () => {
            isMounted = false;
        };
    }, []);

    const {
        data: user,
        error,
        isFetching,
    } = useQuery<PublicUser | undefined, Error>({
        queryKey: ["/api/user"],
        queryFn: getQueryFn({ on401: "returnNull" }),
        staleTime: 10000,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
    });

    const loginMutation = useMutation<PublicUser, Error, LoginData>({
        mutationFn: async (credentials: LoginData) => {
            const res = await apiRequest("POST", "/api/login", credentials);
            return await res.json();
        },
        onSuccess: (user: PublicUser) => {
            resetCsrfTokenCache();
            queryClient.setQueryData(["/api/user"], user);
            // Example of using SecureStore if we had a token
            // SecureStore.setItemAsync("user_token", "...");
        },
        onError: (error: Error) => {
            toast("Login failed", error.message);
        },
    });

    const registerMutation = useMutation<PublicUser, Error, InsertUser>({
        mutationFn: async (credentials: InsertUser) => {
            const res = await apiRequest("POST", "/api/register", credentials);
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Registration failed");
            }
            return await res.json();
        },
        onSuccess: (user: PublicUser) => {
            resetCsrfTokenCache();
            queryClient.setQueryData(["/api/user"], user);
        },
        onError: (error: Error) => {
            toast("Registration failed", error.message);
        },
    });

    const logoutMutation = useMutation({
        mutationFn: async () => {
            await apiRequest("POST", "/api/logout");
        },
        onSuccess: () => {
            resetCsrfTokenCache();
            queryClient.setQueryData(["/api/user"], null);
            // SecureStore.deleteItemAsync("user_token");
        },
        onError: (error: Error) => {
            toast("Logout failed", error.message);
        },
    });

    return (
        <AuthContext.Provider
            value={{
                user: user ?? null,
                isFetching,
                error,
                loginMutation,
                logoutMutation,
                registerMutation,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
