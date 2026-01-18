import React, { Suspense, lazy, useEffect, useState } from "react";
import { ShopLayout } from "@/components/layout/shop-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/language-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit2, Trash2 } from "lucide-react";
import { Product } from "@shared/schema";
import { productFilterConfig } from "@shared/config";
import { z } from "zod";
import { ToastAction } from "@/components/ui/toast";
import { useLocation } from "wouter";
import { getVerificationError, parseApiError } from "@/lib/api-error";
import { useShopContext } from "@/hooks/use-shop-context";
import { Label } from "@/components/ui/label";

const ProductFormDialogLazy = lazy(() => import("./components/ProductFormDialog"));

const productFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.coerce.number().positive("Price must be a positive number"),
  mrp: z.coerce.number().positive("MRP must be a positive number").optional(),
  stock: z.coerce
    .number()
    .min(0, "Stock must be a positive number")
    .nullable()
    .optional(),
  category: z.string().min(1, "Category is required"),
  images: z.array(z.string()).default([]),
  shopId: z.number().optional(),
  isAvailable: z.boolean().default(true),
  // New fields
  sku: z.string().optional(),
  barcode: z.string().optional(),
  weight: z.coerce.number().positive().optional(),
  dimensions: z
    .object({
      length: z.coerce.number().positive(),
      width: z.coerce.number().positive(),
      height: z.coerce.number().positive(),
    })
    .optional(),
  specifications: z.record(z.string(), z.string()).optional(),
  tags: z.array(z.string()).default([]),
  minOrderQuantity: z.coerce.number().positive().default(1),
  maxOrderQuantity: z.coerce.number().positive().optional(),
  lowStockThreshold: z.coerce.number().positive().optional(),
});

type ProductFormData = z.infer<typeof productFormSchema>;

export default function ShopProducts() {
  const {
    user: _user,
    shopId: shopContextId,
    isWorker,
    permissionsLoading: workerPermissionsLoading,
    hasPermission,
  } = useShopContext();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddPrice, setQuickAddPrice] = useState("");
  const [quickAddCategory, setQuickAddCategory] = useState("groceries");

  const findCategory = (value: string) => {
    const lower = value.toLowerCase();
    return (
      productFilterConfig.categories.find(
        (category) => category.value === lower,
      ) ??
      productFilterConfig.categories.find(
        (category) => category.label.toLowerCase() === lower,
      )
    );
  };

  const normalizeCategoryValue = (value: string | null | undefined) => {
    if (!value) return "";
    const match = findCategory(value);
    return match?.value ?? value.toLowerCase();
  };

  const getCategoryLabel = (value: string | null | undefined) => {
    if (!value) return "";
    const match = findCategory(value);
    return match?.label ?? value;
  };

  const waitingOnPermissions = isWorker && workerPermissionsLoading;
  const canReadProducts = hasPermission("products:read");
  const canWriteProducts = hasPermission("products:write");

  const resolvedProductsQueryKey =
    shopContextId !== null
      ? [`/api/products/shop/${shopContextId}`]
      : null;
  const invalidateProductsQuery = () => {
    if (resolvedProductsQueryKey) {
      queryClient.invalidateQueries({ queryKey: resolvedProductsQueryKey });
    }
  };

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: resolvedProductsQueryKey ?? [`/api/products/shop/pending`],
    enabled:
      Boolean(resolvedProductsQueryKey) &&
      canReadProducts &&
      !waitingOnPermissions,
  });

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      mrp: undefined,
      stock: null,
      category: "",
      isAvailable: true,
      images: [],
      shopId: shopContextId ?? 0,
      // New fields
      sku: "",
      barcode: "",
      weight: undefined,
      dimensions: undefined,
      specifications: {},
      tags: [],
      minOrderQuantity: 1,
      maxOrderQuantity: undefined,
      lowStockThreshold: undefined,
    },
  });

  useEffect(() => {
    if (shopContextId) {
      form.setValue("shopId", shopContextId);
    }
  }, [form, shopContextId]);

  // State for advanced options visibility
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  // State for specifications
  const [specKey, setSpecKey] = useState("");
  const [specValue, setSpecValue] = useState("");
  // State for tags input
  const [tagInput, setTagInput] = useState("");

  const resetFormWithProduct = (product: Product) => {
    form.reset({
      name: product.name,
      description: product.description || "",
      price: Number(product.price),
      mrp: Number(product.mrp),
      stock: product.stock,
      category: normalizeCategoryValue(product.category),
      images: product.images || [],
      isAvailable: product.isAvailable ?? true, // Default to true if null
      shopId: shopContextId ?? product.shopId ?? 0,
      // New fields
      sku: product.sku || "",
      barcode: product.barcode || "",
      weight: product.weight ? Number(product.weight) : undefined,
      dimensions: product.dimensions || undefined,
      specifications: product.specifications || {},
      tags: product.tags || [],
      minOrderQuantity: product.minOrderQuantity || 1,
      maxOrderQuantity: product.maxOrderQuantity || undefined,
      lowStockThreshold: product.lowStockThreshold || undefined,
    });

    // Show advanced options if any are set
    if (
      product.sku ||
      product.barcode ||
      product.weight ||
      product.dimensions ||
      product.minOrderQuantity !== 1 ||
      product.maxOrderQuantity ||
      product.lowStockThreshold
    ) {
      setShowAdvancedOptions(true);
    }
  };

  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      if (!shopContextId) {
        throw new Error("Unable to determine shop context for this action");
      }
      // Format the data for API submission
      const formattedData = {
        ...data,
        shopId: shopContextId,
        price: String(data.price),
        mrp: String(data.mrp),
        // Ensure dimensions are properly formatted
        dimensions: data.dimensions,
        // Convert weight to string if present
        weight: data.weight !== undefined ? String(data.weight) : undefined,
        specifications: data.specifications || {},
        tags: data.tags || [],
        minOrderQuantity: data.minOrderQuantity || 1,
        maxOrderQuantity: data.maxOrderQuantity,
        lowStockThreshold: data.lowStockThreshold,
      };

      const res = await apiRequest("POST", "/api/products", formattedData);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create product");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateProductsQuery();
      toast({
        title: t("success"),
        description: t("product_created_successfully"),
      });
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      const verificationError = getVerificationError(error);
      if (verificationError) {
        toast({
          title: t("error"),
          description: verificationError.message,
          variant: "destructive",
          action: (
            <ToastAction
              altText="Go to profile"
              onClick={() => navigate("/shop/profile")}
            >
              Go to profile
            </ToastAction>
          ),
        });
        setDialogOpen(false);
        return;
      }

      const parsed = parseApiError(error);
      toast({
        title: t("error"),
        description: parsed.message,
        variant: "destructive",
      });
    },
  });

  const quickAddMutation = useMutation({
    mutationFn: async () => {
      if (!shopContextId) {
        throw new Error("Unable to determine shop context for this action");
      }
      if (!quickAddName.trim()) {
        throw new Error("Enter a product name");
      }
      const numericPrice = Number(quickAddPrice);
      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        throw new Error("Enter a valid price");
      }

      const res = await apiRequest("POST", "/api/products/quick-add", {
        name: quickAddName.trim(),
        price: numericPrice.toFixed(2),
        category: quickAddCategory,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to quick add product");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateProductsQuery();
      setQuickAddName("");
      setQuickAddPrice("");
      setQuickAddCategory("groceries");
      toast({
        title: "Product added",
        description: "Quick add item created. You can enrich details later.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<ProductFormData>;
    }) => {
      const formattedData = {
        name: data.name,
        description: data.description,
        price: data.price !== undefined ? String(data.price) : undefined,
        mrp: data.mrp !== undefined ? String(data.mrp) : undefined,
        stock: data.stock,
        category: data.category,
        images: data.images,
        isAvailable: data.isAvailable,
        // New fields
        sku: data.sku,
        barcode: data.barcode,
        // Convert weight to string if present
        weight: data.weight !== undefined ? String(data.weight) : undefined,
        // Ensure dimensions are properly formatted
        dimensions: data.dimensions,
        specifications: data.specifications,
        tags: data.tags,
        minOrderQuantity: data.minOrderQuantity,
        maxOrderQuantity: data.maxOrderQuantity,
        lowStockThreshold: data.lowStockThreshold,
      };

      const res = await apiRequest(
        "PATCH",
        `/api/products/${id}`,
        formattedData,
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update product");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateProductsQuery();
      toast({
        title: t("success"),
        description: t("product_updated_successfully"),
      });
      setDialogOpen(false);
      setEditingProduct(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      const res = await apiRequest("DELETE", `/api/products/${productId}`);

      try {
        const data = await res.json();
        return data;
      } catch {
        return { message: "Product deleted successfully" };
      }
    },
    onSuccess: () => {
      invalidateProductsQuery();
      toast({
        title: t("success"),
        description: t("product_deleted_successfully"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteProduct = (productId: number) => {
    deleteProductMutation.mutate(productId);
  };

  const onSubmit = (data: ProductFormData) => {
    if (!shopContextId || !canWriteProducts) {
      toast({
        title: t("error"),
        description: "You do not have permission to manage products for this shop.",
        variant: "destructive",
      });
      return;
    }
    const resolvedMrp =
      typeof data.mrp === "number" && Number.isFinite(data.mrp) && data.mrp > 0
        ? data.mrp
        : data.price;
    const payload = {
      ...data,
      mrp: resolvedMrp,
      category: normalizeCategoryValue(data.category),
    };

    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, data: payload });
    } else {
      createProductMutation.mutate(payload);
    }
  };

  const resetForm = () => {
    form.reset({
      name: "",
      description: "",
      price: 0,
      mrp: undefined,
      stock: null,
      category: "",
      isAvailable: true,
      images: [],
      shopId: shopContextId ?? 0,
      // New fields
      sku: "",
      barcode: "",
      weight: undefined,
      dimensions: undefined,
      specifications: {},
      tags: [],
      minOrderQuantity: 1,
      maxOrderQuantity: undefined,
      lowStockThreshold: undefined,
    });
    setShowAdvancedOptions(false);
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

  const renderProductsList = () => {
    if (!products?.length) return null;
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const isAvailable = product.isAvailable !== false;
          return (
            <Card key={product.id}>
              <CardContent className="p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold break-words">{product.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {product.description}
                    </p>
                  </div>
                  {canWriteProducts && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingProduct(product);
                          resetFormWithProduct(product);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("delete_product_confirmation")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("delete_product_warning")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteProduct(product.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t("delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span>{t("price")}</span>
                    <div>
                      <span className="font-semibold">₹{product.price}</span>
                      {product.mrp > product.price && (
                        <span className="ml-2 line-through text-muted-foreground">
                          ₹{product.mrp}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>{t("availability")}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${isAvailable
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-muted text-muted-foreground"
                          }`}
                      >
                        {isAvailable
                          ? t("inventory_have_it")
                          : t("inventory_finished")}
                      </span>
                      <Switch
                        checked={isAvailable}
                        disabled={!canWriteProducts}
                        onCheckedChange={(checked) => {
                          if (!canWriteProducts) return;
                          updateProductMutation.mutate({
                            id: product.id,
                            data: { isAvailable: checked },
                          });
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>{t("category")}</span>
                    <span className="font-semibold">
                      {getCategoryLabel(product.category)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const productsSection = (() => {
    if (waitingOnPermissions) {
      return renderLoadingIndicator;
    }
    if (!shopContextId) {
      return renderStatusCard(
        isWorker
          ? "Your worker account is not linked to a shop yet."
          : t("no_products_created_yet"),
      );
    }
    if (!canReadProducts) {
      return renderStatusCard(
        "You do not have permission to view products for this shop.",
      );
    }
    if (productsLoading) {
      return renderLoadingIndicator;
    }
    if (!products?.length) {
      return renderStatusCard(t("no_products_created_yet"));
    }
    return renderProductsList();
  })();

  return (
    <ShopLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">{t("my_products")}</h1>
          {canWriteProducts && shopContextId && (
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) {
                  setEditingProduct(null);
                  resetForm();
                }
              }}
            >
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("add_product")}
                </Button>
              </DialogTrigger>
              <Suspense
                fallback={
                  <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  </DialogContent>
                }
              >
                <ProductFormDialogLazy
                  t={t}
                  editingProduct={editingProduct}
                  form={form}
                  showAdvancedOptions={showAdvancedOptions}
                  setShowAdvancedOptions={setShowAdvancedOptions}
                  specKey={specKey}
                  specValue={specValue}
                  setSpecKey={setSpecKey}
                  setSpecValue={setSpecValue}
                  tagInput={tagInput}
                  setTagInput={setTagInput}
                  onSubmit={onSubmit}
                  createPending={createProductMutation.isPending}
                  updatePending={updateProductMutation.isPending}
                />
              </Suspense>
            </Dialog>
          )}
        </div>

        {canWriteProducts && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-lg">Quick Add</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Quickly add a product with just name, price, and category.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Category</Label>
                  <Select
                    value={quickAddCategory}
                    onValueChange={setQuickAddCategory}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {productFilterConfig.categories.slice(0, 10).map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Product name</Label>
                  <Input
                    value={quickAddName}
                    onChange={(e) => setQuickAddName(e.target.value)}
                    placeholder="Type the name"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Price (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={quickAddPrice}
                    onChange={(e) => setQuickAddPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {t("inventory_quick_add_hint")}
                </p>
                <Button
                  onClick={() => quickAddMutation.mutate()}
                  disabled={quickAddMutation.isPending || !shopContextId}
                  className="w-full sm:w-auto"
                >
                  {quickAddMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Quick Add
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {productsSection}
      </div>
    </ShopLayout>
  );
}
