import { createContext, ReactNode, useContext } from "react";
import { useQuery, useMutation, UseMutationResult } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";

type Admin = { id: string; email: string; roleId: string | null };

type AdminContextType = {
  admin: Admin | null;
  isFetching: boolean;
  loginMutation: UseMutationResult<Admin, Error, { email: string; password: string }>;
  logoutMutation: UseMutationResult<void, Error, void>;
};

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const { data: admin, isFetching } = useQuery<Admin | null>({
    queryKey: ["/api/admin/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/admin/login", credentials);
      return res.json();
    },
    onSuccess: (data: Admin) => {
      queryClient.setQueryData(["/api/admin/me"], data);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/admin/me"], null);
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
