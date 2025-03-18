import { ShopLayout } from "@/components/layout/shop-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit2, Calendar } from "lucide-react";
import { Promotion, insertPromotionSchema } from "@shared/schema";
import { z } from "zod";
import { useState } from "react";

const promotionFormSchema = insertPromotionSchema.extend({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  value: z.string().min(1, "Value is required"),
});

type PromotionFormData = z.infer<typeof promotionFormSchema>;

export default function ShopPromotions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);

  const { data: promotions, isLoading } = useQuery<Promotion[]>({
    queryKey: [`/api/promotions/shop/${user?.id}`],
    enabled: !!user?.id,
  });

  const form = useForm<PromotionFormData>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "percentage",
      value: "",
      code: "",
      startDate: new Date().toISOString().split('T')[0],
      endDate: "",
      minPurchase: "0",
      maxDiscount: "0",
      usageLimit: 0,
      isActive: true,
      shopId: user?.id || 0,
    },
  });

  const createPromotionMutation = useMutation({
    mutationFn: async (data: PromotionFormData) => {
      const res = await apiRequest("POST", "/api/promotions", {
        ...data,
        shopId: user?.id,
      });
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

  const updatePromotionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PromotionFormData> }) => {
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Promotion
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{editingPromotion ? 'Edit Promotion' : 'Create Promotion'}</DialogTitle>
              </DialogHeader>
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
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
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

                    <FormField
                      control={form.control}
                      name="value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount Value</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" min="0" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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

                    <FormField
                      control={form.control}
                      name="usageLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Usage Limit</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" min="0" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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
                      disabled={createPromotionMutation.isPending || updatePromotionMutation.isPending}
                    >
                      {(createPromotionMutation.isPending || updatePromotionMutation.isPending) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {editingPromotion ? 'Update Promotion' : 'Create Promotion'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

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
                        form.reset(promotion);
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
                        {promotion.type === 'percentage' ? `${promotion.value}%` : `₹${promotion.value}`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Code</span>
                      <span className="font-semibold">{promotion.code}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Period</span>
                      <span className="font-semibold">
                        {new Date(promotion.startDate).toLocaleDateString()} - 
                        {promotion.endDate ? new Date(promotion.endDate).toLocaleDateString() : 'No end date'}
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
                          data: { isActive: checked },
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
