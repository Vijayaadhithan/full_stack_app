import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { useWorkerPermissions } from "./use-worker-permissions";
import { apiRequest } from "@/lib/queryClient";
import { useUserContext } from "@/contexts/UserContext";
import { isShopUser } from "@/lib/role-access";
import type { PublicShop } from "@/types/public-shop";

export function useShopContext() {
  const { user } = useAuth();
  const worker = useWorkerPermissions();
  const { profiles } = useUserContext();

  const isShopOwner = isShopUser(user);
  const shopId = isShopOwner ? user?.id ?? null : worker.shopId ?? null;

  const { data: workerShop } = useQuery<PublicShop | null>({
    queryKey: ["/api/shops", shopId],
    enabled: worker.isWorker && typeof shopId === "number",
    queryFn: async () => {
      if (typeof shopId !== "number") return null;
      const res = await apiRequest("GET", `/api/shops/${shopId}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const hasPermission = useMemo(() => worker.has, [worker.has]);
  const shopName =
    profiles.shop?.shopName ||
    user?.shopProfile?.shopName ||
    workerShop?.shopProfile?.shopName ||
    workerShop?.name ||
    null;

  return {
    user,
    shopId,
    isShopOwner,
    isWorker: worker.isWorker,
    workerShopId: worker.shopId,
    permissionsLoading: worker.isWorker ? worker.isLoading : false,
    hasPermission,
    workerResponsibilities: worker.responsibilities,
    shopName,
  };
}
