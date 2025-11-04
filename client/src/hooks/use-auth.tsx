import React from 'react';
import { createContext, ReactNode, useContext } from "react";
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
import { useToast } from "@/hooks/use-toast";

type PublicUser = Omit<SelectUser, "password">;

type AuthContextType = {
  user: PublicUser | null;
  isFetching: boolean; // Changed from isLoading
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
      toast({
        title: "Security error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to initialize secure session. Please refresh and try again.",
        variant: "destructive",
      });
    });

    return () => {
      isMounted = false;
    };
  }, [toast]);
  const {
    data: user,
    error,
    isFetching, // Changed from isLoading
  } = useQuery<PublicUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    // Increase staleTime to prevent unnecessary refetches that cause login page flash
    // while still allowing refetch on window focus for OAuth flows
    staleTime: 10000, // 10 seconds
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
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation<PublicUser, Error, InsertUser>({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: PublicUser) => {
      resetCsrfTokenCache();
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      resetCsrfTokenCache();
      queryClient.setQueryData(["/api/user"], null);
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isFetching, // Changed from isLoading
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
