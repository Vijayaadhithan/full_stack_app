import { useMemo } from "react";
import { useAuth } from "./use-auth";
import { useWorkerPermissions } from "./use-worker-permissions";

export function useShopContext() {
  const { user } = useAuth();
  const worker = useWorkerPermissions();

  const isShopOwner = user?.role === "shop";
  const shopId = isShopOwner ? user?.id ?? null : worker.shopId ?? null;

  const hasPermission = useMemo(() => worker.has, [worker.has]);

  return {
    user,
    shopId,
    isShopOwner,
    isWorker: worker.isWorker,
    workerShopId: worker.shopId,
    permissionsLoading: worker.isWorker ? worker.isLoading : false,
    hasPermission,
    workerResponsibilities: worker.responsibilities,
  };
}
