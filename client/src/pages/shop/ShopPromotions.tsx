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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit2 } from "lucide-react";
import { z } from "zod";
import { useState } from "react";

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
  value: z.coerce.number({
    required_error: "Discount value is required",
  }).min(0, "Discount cannot be negative"),
  code: z.string().optional(),
  usageLimit: z.coerce.number().min(0).default(0),
  isActive: z.boolean().default(true),
  shopId: z.coerce.number().positive("Invalid Shop ID"),
  expiryDays: z.coerce.number().min(0, "Expiry days must be 0 or greater").default(0),
});

// Infer the TypeScript type for the form
type PromotionFormData = z.infer<typeof promotionFormSchema>;

export default function ShopPromotions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);

  // Fetch promotions for the current shop
  const { data: promotions, isLoading } = useQuery<Promotion[]>({
    queryKey: [`/api/promotions/shop/${user?.id}`],
    enabled: !!user?.id,
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
      queryClient.invalidateQueries({ queryKey: [`/api/promotions/shop/${user?.id}`] });
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
    mutationFn: async ({ id, data }: { id: number; data: PromotionFormData }) => {
      const res = await apiRequest("PATCH", `/api/promotions/${id}`, data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update promotion");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/promotions/shop/${user?.id}`] });
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
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Promotions & Discounts</h1>

          {/* Dialog trigger button */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
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
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="percentage">Percentage</SelectItem>
                              <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
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
                            <Input type="number" min="0" step="any" {...field} />
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
                          0 means "no expiry." Otherwise, the promotion will expire after 
                          that many days from creation.
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
                      {editingPromotion ? "Update Promotion" : "Create Promotion"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
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
                      <span className="font-semibold">{promotion.code || "—"}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Period</span>
                      <span className="font-semibold">
                        {new Date(promotion.startDate).toLocaleDateString()} 
                        {promotion.endDate
                          ? ` - ${new Date(promotion.endDate).toLocaleDateString()}`
                          : " (No expiry)"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium">Status</span>
                    </div>
                    <Switch
                      checked={promotion.isActive}
                      onCheckedChange={(checked) =>
                        updatePromotionMutation.mutate({
                          id: promotion.id,
                          data: {
                            ...form.getValues(),
                            isActive: checked,
                            expiryDays: 0, // Keep existing expiry
                          },
                        })
                      }
                    />
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