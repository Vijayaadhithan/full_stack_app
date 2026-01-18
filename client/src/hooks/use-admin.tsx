import { createContext, ReactNode, useContext } from "react";
import { useQuery, useMutation, UseMutationResult } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  apiRequest,
  getQueryFn,
  queryClient,
  resetCsrfTokenCache,
} from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Admin = {
  id: string;
  email: string;
  roleId: string | null;
  permissions?: string[];
  mustChangePassword?: boolean;
};

type AdminContextType = {
  admin: Admin | null;
  isFetching: boolean;
  loginMutation: UseMutationResult<Admin, Error, { email: string; password: string }>;
  logoutMutation: UseMutationResult<void, Error, void>;
};

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [location] = useLocation();
  const isAdminRoute = location.startsWith("/admin");
  const { data: admin, isFetching } = useQuery<Admin | null>({
    queryKey: ["/api/admin/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAdminRoute,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/admin/login", credentials);
      return res.json();
    },
    onSuccess: (data: Admin) => {
      resetCsrfTokenCache();
      queryClient.setQueryData(["/api/admin/me"], data);
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/me"] });
      toast({ title: "Welcome back", description: data.email });
    },
    onError: (e: any) => {
      const message = e?.message?.toString?.() ?? "Login failed";
      toast({ title: "Login failed", description: message, variant: "destructive" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/logout");
    },
    onSuccess: () => {
      resetCsrfTokenCache();
      queryClient.setQueryData(["/api/admin/me"], null);
      toast({ title: "Signed out" });
    },
  });

  return (
    <AdminContext.Provider
      value={{ admin: admin ?? null, isFetching, loginMutation, logoutMutation }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within an AdminProvider");
  return ctx;
}
