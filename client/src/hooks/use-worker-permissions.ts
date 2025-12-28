import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { isShopUser } from "@/lib/role-access";

export function useWorkerPermissions() {
  const { user } = useAuth();
  const isWorker = user?.role === "worker";

  const { data, isLoading } = useQuery<{ shopId: number; responsibilities: string[]; active: boolean } | null>({
    queryKey: ["/api/worker/me"],
    enabled: isWorker,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/worker/me");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const has = (perm: string) => {
    if (isShopUser(user)) return true;
    if (!isWorker) return false;
    return !!data?.responsibilities?.includes(perm);
  };

  return {
    isLoading,
    isWorker,
    shopId: data?.shopId ?? null,
    responsibilities: data?.responsibilities ?? [],
    has,
  };
}
