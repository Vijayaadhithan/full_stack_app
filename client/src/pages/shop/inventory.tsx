import React, { useState } from "react";
import { ShopLayout } from "@/components/layout/shop-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  const [stockUpdates, setStockUpdates] = useState<Record<number, number>>({});

  const waitingOnPermissions = isWorker && workerPermissionsLoading;
  const canReadProducts = hasPermission("products:read");
  const canAdjustInventory = hasPermission("products:write");

  const resolvedProductsQueryKey =
    shopContextId !== null
      ? [`/api/products/shop/${shopContextId}`]
      : null;
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

  const updateStockMutation = useMutation({
    mutationFn: async ({
      productId,
      stock,
    }: {
      productId: number;
      stock: number;
    }) => {
      if (!canAdjustInventory) {
        throw new Error("You do not have permission to update inventory.");
      }
      const res = await apiRequest("PATCH", `/api/products/${productId}`, {
        stock,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update stock");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateProductsQuery();
      toast({
        title: "Success",
        description: "Stock updated successfully",
      });
      setStockUpdates({});
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStockUpdate = (productId: number, stock: number) => {
    if (!canAdjustInventory) return;
    setStockUpdates((prev) => ({ ...prev, [productId]: stock }));
  };

  const handleSave = (productId: number) => {
    if (!canAdjustInventory) {
      toast({
        title: "Permission required",
        description: "You do not have access to update inventory.",
        variant: "destructive",
      });
      return;
    }
    const newStock = stockUpdates[productId];
    if (newStock !== undefined) {
      updateStockMutation.mutate({ productId, stock: newStock });
    }
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
    if (!shopContextId) {
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
        {products.map((product) => (
          <Card
            key={product.id}
            className={
              product.stock <= (product.lowStockThreshold || 5)
                ? "border-yellow-500"
                : ""
            }
          >
            <CardContent className="p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">{product.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    SKU: {product.sku || "N/A"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      Current Stock:
                    </span>
                    <Input
                      type="number"
                      value={stockUpdates[product.id] ?? product.stock}
                      onChange={(e) =>
                        handleStockUpdate(
                          product.id,
                          parseInt(e.target.value, 10),
                        )
                      }
                      className="w-24"
                      disabled={!canAdjustInventory}
                    />
                  </div>
                  {stockUpdates[product.id] !== undefined && (
                    <Button
                      onClick={() => handleSave(product.id)}
                      disabled={
                        updateStockMutation.isPending || !canAdjustInventory
                      }
                    >
                      {updateStockMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </Button>
                  )}
                </div>
              </div>
              {product.stock <= (product.lowStockThreshold || 5) && (
                <div className="mt-4 flex items-center gap-2 text-yellow-600 bg-yellow-50 p-2 rounded">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">
                    Low stock alert! Current stock is below threshold.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  })();

  return (
    <ShopLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Inventory Management</h1>

        {inventoryContent}
      </div>
    </ShopLayout>
  );
}
