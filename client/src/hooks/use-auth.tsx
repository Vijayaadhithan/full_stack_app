import React from 'react';
import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User as SelectUser, InsertUser, RuralRegisterData, PinLoginData } from "@shared/schema";
import {
  getQueryFn,
  apiRequest,
  queryClient,
  resetCsrfTokenCache,
  getCsrfToken,
} from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type PublicUser = Omit<SelectUser, "password" | "pin">;

type AuthContextType = {
  user: PublicUser | null;
  isFetching: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<PublicUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<PublicUser, Error, InsertUser>;
  // Rural-first auth mutations
  pinLoginMutation: UseMutationResult<PublicUser, Error, PinLoginData>;
  ruralRegisterMutation: UseMutationResult<PublicUser, Error, RuralRegisterData>;
  checkUserMutation: UseMutationResult<{ exists: boolean; name?: string; isPhoneVerified?: boolean }, Error, { phone: string }>;
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
    isFetching,
  } = useQuery<PublicUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 10000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Legacy username/password login
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

  // PIN-based login (rural-first, no SMS cost)
  const pinLoginMutation = useMutation<PublicUser, Error, PinLoginData>({
    mutationFn: async (credentials: PinLoginData) => {
      const res = await apiRequest("POST", "/api/auth/login-pin", credentials);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Login failed");
      }
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

  // Check if phone number exists
  const checkUserMutation = useMutation<
    { exists: boolean; name?: string; isPhoneVerified?: boolean },
    Error,
    { phone: string }
  >({
    mutationFn: async ({ phone }) => {
      const res = await apiRequest("POST", "/api/auth/check-user", { phone });
      return await res.json();
    },
  });

  // Rural registration (phone + PIN)
  const ruralRegisterMutation = useMutation<PublicUser, Error, RuralRegisterData>({
    mutationFn: async (data: RuralRegisterData) => {
      const res = await apiRequest("POST", "/api/auth/rural-register", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Registration failed");
      }
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

  // Legacy registration
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
      // Clear stored phone on logout
      localStorage.removeItem("appMode");
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
        isFetching,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        // Rural-first auth
        pinLoginMutation,
        ruralRegisterMutation,
        checkUserMutation,
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

