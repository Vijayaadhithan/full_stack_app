import React from 'react';
import { ShopLayout } from "@/components/layout/shop-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/alert-dialog"; // Added this import
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useWorkerPermissions } from "@/hooks/use-worker-permissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit2, Trash2 } from "lucide-react";
import { z } from "zod";
import { useMemo, useState } from "react";
import { formatIndianDisplay } from "@shared/date-utils"; // Import IST utility

// Define the Promotion type based on the server schema
type Promotion = {
  id: number;
  shopId: number;
  name: string;
  description?: string;
  type: "percentage" | "fixed_amount";
  value: number;
  code?: string;
  startDate: string;
  endDate?: string | null;
  usageLimit?: number;
  usedCount?: number;
  isActive: boolean;
};

// Define the schema for the promotion form
const promotionFormSchema = z.object({
  name: z.string().min(1, "Promotion name is required"),
  description: z.string().optional(),
  type: z.enum(["percentage", "fixed_amount"]),
  value: z.coerce
    .number({
      required_error: "Discount value is required",
    })
    .min(0, "Discount cannot be negative"),
  code: z.string().optional(),
  usageLimit: z.coerce.number().min(0).default(0),
  isActive: z.boolean().default(true),
  shopId: z.coerce.number().positive("Invalid Shop ID"),
  expiryDays: z.coerce
    .number()
    .min(0, "Expiry days must be 0 or greater")
    .default(0),
});

// Infer the TypeScript type for the form
type PromotionFormData = z.infer<typeof promotionFormSchema>;

export default function ShopPromotions() {
  const { user } = useAuth();
  const { has: can, isWorker, shopId: workerShopId } = useWorkerPermissions();
  const canManage = (user?.role === 'shop') || can('promotions:manage');
  const listShopId = user?.role === 'shop' ? user?.id : (isWorker ? workerShopId : undefined);
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(
    null,
  );
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [promotionToDelete, setPromotionToDelete] = useState<Promotion | null>(
    null,
  );
  const baseQueryKey = canManage ? "/api/promotions/shop" : "/api/promotions/active";
  const promotionsQueryKey = useMemo(
    () => [baseQueryKey, listShopId] as const,
    [baseQueryKey, listShopId],
  );

  // Fetch promotions for the current shop
  const { data: promotions, isLoading } = useQuery<Promotion[]>({
    queryKey: promotionsQueryKey,
    enabled: !!listShopId,
    queryFn: async () => {
      if (!listShopId) return [] as Promotion[];
      const endpoint = canManage
        ? `/api/promotions/shop/${listShopId}`
        : `/api/promotions/active/${listShopId}`;
      const res = await apiRequest("GET", endpoint);
      if (!res.ok) throw new Error("Failed to fetch promotions");
      return res.json();
    },
  });

  // Set up React Hook Form with the Zod schema
  const form = useForm<PromotionFormData>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "percentage",
      value: 0,
      code: "",
      usageLimit: 0,
      isActive: true,
      shopId: user?.id ?? 0,
      expiryDays: 0,
    },
  });

  // Utility to reset form for "Edit" mode
  const resetFormWithPromotion = (promotion: Promotion) => {
    // Calculate expiryDays from startDate and endDate
    let expiryDays = 0;
    if (promotion.startDate && promotion.endDate) {
      const start = new Date(promotion.startDate);
      const end = new Date(promotion.endDate);
      const diffMs = end.getTime() - start.getTime();
      expiryDays = diffMs > 0 ? Math.ceil(diffMs / (1000 * 60 * 60 * 24)) : 0;
    }

    form.reset({
      name: promotion.name,
      description: promotion.description ?? "",
      type: promotion.type,
      value: Number(promotion.value) || 0,
      code: promotion.code ?? "",
      usageLimit: promotion.usageLimit ?? 0,
      isActive: !!promotion.isActive,
      shopId: promotion.shopId ?? (user?.id || 0),
      expiryDays,
    });
  };

  // Create mutation
  const createPromotionMutation = useMutation({
    mutationFn: async (data: PromotionFormData) => {
      const res = await apiRequest("POST", "/api/promotions", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create promotion");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: promotionsQueryKey,
      });
      toast({
        title: "Success",
        description: "Promotion created successfully",
      });
      form.reset();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updatePromotionMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: PromotionFormData;
    }) => {
      const { shopId: _shopId, ...payload } = data;
      const res = await apiRequest("PATCH", `/api/promotions/${id}`, payload);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update promotion");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: promotionsQueryKey,
      });
      toast({
        title: "Success",
        description: "Promotion updated successfully",
      });
      setDialogOpen(false);
      setEditingPromotion(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update Status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/promotions/${id}/status`, {
        isActive,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update promotion status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: promotionsQueryKey,
      });
      toast({
        title: "Success",
        description: "Promotion status updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deletePromotionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/promotions/${id}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete promotion");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: promotionsQueryKey,
      });
      toast({
        title: "Success",
        description: "Promotion deleted successfully",
      });
      setDeleteConfirmationOpen(false);
      setPromotionToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setDeleteConfirmationOpen(false);
      setPromotionToDelete(null);
    },
  });

  // Handle form submit
  const onSubmit = (data: PromotionFormData) => {
    if (editingPromotion) {
      updatePromotionMutation.mutate({ id: editingPromotion.id, data });
    } else {
      createPromotionMutation.mutate(data);
    }
  };

  return (
    <ShopLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Promotions & Discounts</h1>

          {/* Dialog trigger button */}
          {(user?.role === 'shop' || can('promotions:manage')) && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => {
                  setEditingPromotion(null);
                  form.reset({
                    name: "",
                    description: "",
                    type: "percentage",
                    value: 0,
                    code: "",
                    usageLimit: 0,
                    isActive: true,
                    shopId: user?.id ?? 0,
                    expiryDays: 0,
                  });
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Promotion
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>
                  {editingPromotion ? "Edit Promotion" : "Create Promotion"}
                </DialogTitle>
              </DialogHeader>

              {/* Promotion form */}
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Promotion Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Discount type */}
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="percentage">
                                Percentage
                              </SelectItem>
                              <SelectItem value="fixed_amount">
                                Fixed Amount
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Discount value */}
                    <FormField
                      control={form.control}
                      name="value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount Value</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Promotion code */}
                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Promotion Code</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Usage limit */}
                    <FormField
                      control={form.control}
                      name="usageLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Usage Limit</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Expiry days */}
                  <FormField
                    control={form.control}
                    name="expiryDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiry Days</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground mt-1">
                          0 means "no expiry." Otherwise, the promotion will
                          expire after that many days from creation.
                        </p>
                      </FormItem>
                    )}
                  />

                  {/* Active switch */}
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Active</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={
                        createPromotionMutation.isPending ||
                        updatePromotionMutation.isPending
                      }
                    >
                      {(createPromotionMutation.isPending ||
                        updatePromotionMutation.isPending) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {editingPromotion
                        ? "Update Promotion"
                        : "Create Promotion"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          )}
        </div>

        {/* Listing existing promotions */}
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !promotions?.length ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No promotions created yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {promotions.map((promotion) => (
              <Card key={promotion.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{promotion.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {promotion.description}
                      </p>
                    </div>
                    <div className="flex items-center space-x-1">
                      {(user?.role === 'shop' || can('promotions:manage')) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingPromotion(promotion);
                          resetFormWithPromotion(promotion);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      )}
                      {(user?.role === 'shop' || can('promotions:manage')) && (
                      <AlertDialog
                        open={
                          deleteConfirmationOpen &&
                          promotionToDelete?.id === promotion.id
                        }
                        onOpenChange={(open) => {
                          if (!open) {
                            setDeleteConfirmationOpen(false);
                            setPromotionToDelete(null);
                          }
                        }}
                      >
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setPromotionToDelete(promotion);
                              setDeleteConfirmationOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will
                              permanently delete the promotion "
                              {promotionToDelete?.name}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel
                              onClick={() => {
                                setDeleteConfirmationOpen(false);
                                setPromotionToDelete(null);
                              }}
                            >
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => {
                                if (promotionToDelete) {
                                  deletePromotionMutation.mutate(
                                    promotionToDelete.id,
                                  );
                                }
                              }}
                              disabled={deletePromotionMutation.isPending}
                            >
                              {deletePromotionMutation.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span>Discount</span>
                      <span className="font-semibold">
                        {promotion.type === "percentage"
                          ? `${promotion.value}%`
                          : `₹${promotion.value}`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Code</span>
                      <span className="font-semibold">
                        {promotion.code || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Period</span>
                      <span className="font-semibold">
                        {formatIndianDisplay(promotion.startDate, "date")}{" "}
                        {/* Use formatIndianDisplay */}
                        {promotion.endDate
                          ? ` - ${formatIndianDisplay(promotion.endDate, "date")}` /* Use formatIndianDisplay */
                          : " (No expiry)"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium">Status</span>
                    </div>
                    {(user?.role === 'shop' || can('promotions:manage')) ? (
                    <Switch
                      checked={promotion.isActive}
                      onCheckedChange={(checked) =>
                        updateStatusMutation.mutate({
                          id: promotion.id,
                          isActive: checked,
                        })
                      }
                      disabled={updateStatusMutation.isPending}
                    />
                    ) : (
                      <div className="text-sm text-muted-foreground">No permission</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
