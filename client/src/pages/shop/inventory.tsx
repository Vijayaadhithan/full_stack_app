import React, { useState } from "react";
import { ShopLayout } from "@/components/layout/shop-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Product } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle } from "lucide-react";
import { useShopContext } from "@/hooks/use-shop-context";

export default function ShopInventory() {
  const {
    shopId: shopContextId,
    isWorker,
    permissionsLoading: workerPermissionsLoading,
    hasPermission,
  } = useShopContext();
  const { toast } = useToast();
  const [stockDrafts, setStockDrafts] = useState<Record<number, string>>({});

  const waitingOnPermissions = isWorker && workerPermissionsLoading;
  const canReadProducts = hasPermission("products:read");
  const canAdjustInventory = hasPermission("products:write");

  const resolvedProductsQueryKey =
    shopContextId !== null ? [`/api/products/shop/${shopContextId}`] : null;

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: resolvedProductsQueryKey ?? [`/api/products/shop/pending`],
    enabled:
      Boolean(resolvedProductsQueryKey) &&
      canReadProducts &&
      !waitingOnPermissions,
  });

  const invalidateProductsQuery = () => {
    if (resolvedProductsQueryKey) {
      queryClient.invalidateQueries({ queryKey: resolvedProductsQueryKey });
    }
  };

  const updateProductMutation = useMutation({
    mutationFn: async ({
      productId,
      patch,
    }: {
      productId: number;
      patch: Partial<Pick<Product, "stock" | "isAvailable">>;
    }) => {
      if (!canAdjustInventory) {
        throw new Error("You do not have permission to update inventory.");
      }
      const res = await apiRequest("PATCH", `/api/products/${productId}`, patch);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update product");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      invalidateProductsQuery();
      if (Object.prototype.hasOwnProperty.call(variables.patch, "stock")) {
        setStockDrafts((prev) => {
          if (!(variables.productId in prev)) return prev;
          const next = { ...prev };
          delete next[variables.productId];
          return next;
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAvailabilityToggle = (productId: number, checked: boolean) => {
    if (!canAdjustInventory) {
      toast({
        title: "Permission required",
        description: "You do not have access to update inventory.",
        variant: "destructive",
      });
      return;
    }

    updateProductMutation.mutate({ productId, patch: { isAvailable: checked } });
  };

  const handleSaveStock = (product: Product) => {
    if (!canAdjustInventory) {
      toast({
        title: "Permission required",
        description: "You do not have access to update inventory.",
        variant: "destructive",
      });
      return;
    }

    const rawDraft = stockDrafts[product.id];
    const current =
      typeof product.stock === "number" ? String(product.stock) : "";
    const draft = (rawDraft ?? current).trim();
    if (draft === current) return;

    const nextStock = draft === "" ? null : Number.parseInt(draft, 10);

    if (nextStock !== null && (!Number.isFinite(nextStock) || nextStock < 0)) {
      toast({
        title: "Invalid stock",
        description: "Enter a whole number (0 or more), or leave it blank.",
        variant: "destructive",
      });
      return;
    }

    updateProductMutation.mutate({
      productId: product.id,
      patch: { stock: nextStock },
    });
  };

  const renderLoadingIndicator = (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );

  const renderStatusCard = (message: string) => (
    <Card>
      <CardContent className="p-6 text-center">
        <p className="text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );

  const inventoryContent = (() => {
    if (waitingOnPermissions) {
      return renderLoadingIndicator;
    }
    if (shopContextId === null) {
      return renderStatusCard(
        isWorker
          ? "Your worker account is not linked to a shop yet."
          : "No products found.",
      );
    }
    if (!canReadProducts) {
      return renderStatusCard(
        "You do not have permission to view this inventory.",
      );
    }
    if (productsLoading) {
      return renderLoadingIndicator;
    }
    if (!products?.length) {
      return renderStatusCard("No products found");
    }

    return (
      <div className="space-y-4">
        <Card className="border-dashed">
          <CardContent className="p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Availability</h3>
                <p className="text-sm text-muted-foreground">
                  Toggle In Stock / Out of Stock. Exact counts are optional.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={invalidateProductsQuery}
                  disabled={productsLoading}
                >
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {products.map((product) => {
          const trackedStock =
            typeof product.stock === "number" ? product.stock : null;
          const lowStock =
            trackedStock !== null &&
            trackedStock <= (product.lowStockThreshold ?? 5);
          const stockInputValue =
            stockDrafts[product.id] ??
            (trackedStock === null ? "" : String(trackedStock));
          const normalizedCurrent =
            trackedStock === null ? "" : String(trackedStock);
          const normalizedDraft = stockInputValue.trim();
          const stockDirty = normalizedDraft !== normalizedCurrent;

          return (
            <Card
              key={product.id}
              className={lowStock ? "border-yellow-500" : ""}
            >
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      SKU: {product.sku || "N/A"}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:items-end">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {product.isAvailable === false
                          ? "Out of stock"
                          : "In stock"}
                      </span>
                      <Switch
                        checked={product.isAvailable !== false}
                        onCheckedChange={(checked) =>
                          handleAvailabilityToggle(product.id, checked)
                        }
                        disabled={
                          !canAdjustInventory ||
                          updateProductMutation.isPending
                        }
                      />
                    </div>

                    <details className="w-full rounded-lg border bg-muted/30 px-3 py-2">
                      <summary className="cursor-pointer select-none text-sm font-medium">
                        Exact stock count (optional)
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {trackedStock === null
                            ? "(not set)"
                            : `(current: ${trackedStock})`}
                        </span>
                      </summary>

                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          placeholder="Leave blank to not track a count"
                          value={stockInputValue}
                          onChange={(e) => {
                            if (!canAdjustInventory) return;
                            setStockDrafts((prev) => ({
                              ...prev,
                              [product.id]: e.target.value,
                            }));
                          }}
                          className="w-full sm:w-64"
                          disabled={!canAdjustInventory}
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setStockDrafts((prev) => ({
                                ...prev,
                                [product.id]: "",
                              }))
                            }
                            disabled={!canAdjustInventory}
                          >
                            Clear
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSaveStock(product)}
                            disabled={
                              !canAdjustInventory ||
                              updateProductMutation.isPending ||
                              !stockDirty
                            }
                          >
                            {updateProductMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Save count"
                            )}
                          </Button>
                        </div>
                      </div>
                    </details>
                  </div>
                </div>

                {lowStock && (
                  <div className="mt-4 flex items-center gap-2 rounded bg-yellow-50 p-2 text-yellow-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">
                      Low stock alert! Current stock is below threshold.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  })();

  return (
    <ShopLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Inventory</h1>
        {inventoryContent}
      </div>
    </ShopLayout>
  );
}

