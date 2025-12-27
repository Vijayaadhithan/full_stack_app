import React, { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/language-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Edit2, Search } from "lucide-react";
import { Service } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { getVerificationError, parseApiError } from "@/lib/api-error";
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
import { SERVICE_CATEGORY_OPTIONS } from "@/lib/service-categories";
import { z } from "zod";
import { useLocation } from "wouter";

const serviceFormSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  price: z.string().min(1, "Price is required"),
  duration: z.coerce.number().min(15, "Duration must be at least 15 minutes"),
  isAvailable: z.boolean().default(true),
  isAvailableNow: z.boolean().default(true),
  availabilityNote: z.string().optional().nullable(),
});

type ServiceFormData = z.infer<typeof serviceFormSchema>;

type CategoryOption = {
  value: string;
  label: string;
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

const formatServicePrice = (price?: string | number | null): string => {
  if (price == null) return "₹0";
  const value = typeof price === "string" ? Number(price) : price;
  if (!Number.isFinite(value)) return "₹0";
  return `₹${currencyFormatter.format(value)}`;
};

export default function ProviderServices() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [activeTab, setActiveTab] = useState<"basic" | "availability">(
    "basic",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      price: "",
      duration: 15,
      isAvailable: true,
      isAvailableNow: true,
      availabilityNote: "",
    },
  });

  const servicesQueryKey = [`/api/services/provider/${user?.id}`];

  const { data: services, isLoading } = useQuery<Service[]>({
    queryKey: servicesQueryKey,
    enabled: !!user?.id,
  });

  const openCreateDialog = () => {
    setEditingService(null);
    form.reset();
    setActiveTab("basic");
    setDialogOpen(true);
  };

  const openEditDialog = (service: Service) => {
    setEditingService(service);
    form.reset({
      name: service.name,
      description: service.description ?? "",
      category: service.category,
      price: service.price?.toString() ?? "",
      duration: service.duration,
      isAvailable: service.isAvailable ?? true,
      isAvailableNow: service.isAvailableNow ?? true,
      availabilityNote: service.availabilityNote ?? "",
    });
    setActiveTab("basic");
    setDialogOpen(true);
  };

  const createServiceMutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      const res = await apiRequest("POST", "/api/services", {
        ...data,
        providerId: user?.id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: servicesQueryKey });
      toast({
        title: t("success"),
        description: t("service_created_successfully"),
      });
      form.reset();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      const verificationError = getVerificationError(error);
      if (verificationError) {
        toast({
          title: t("verification_required_title"),
          description: verificationError.message,
          variant: "destructive",
          action: (
            <ToastAction
              altText={t("go_to_profile")}
              onClick={() => navigate("/provider/profile")}
            >
              {t("go_to_profile")}
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

  const updateServiceMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<ServiceFormData>;
    }) => {
      const res = await apiRequest("PATCH", `/api/services/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: servicesQueryKey });
      toast({
        title: t("success"),
        description: t("service_updated_successfully"),
      });
      setDialogOpen(false);
      setEditingService(null);
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: number) => {
      const res = await apiRequest("DELETE", `/api/services/${serviceId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: servicesQueryKey });
      toast({
        title: t("success"),
        description: t("service_deleted_successfully"),
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

  const onSubmit = async (data: ServiceFormData) => {
    if (editingService) {
      await updateServiceMutation.mutateAsync({ id: editingService.id, data });
    } else {
      await createServiceMutation.mutateAsync(data);
    }
  };

  const metrics = useMemo(() => {
    const total = services?.length ?? 0;
    const online = services
      ? services.filter(
          (service) => service.isAvailable && service.isAvailableNow !== false,
        ).length
      : 0;
    const paused = total - online;
    const categories = new Set(
      services?.map((service) => service.category).filter(Boolean) ?? [],
    );
    return {
      total,
      online,
      paused,
      categories: categories.size,
    };
  }, [services]);

  const categoryOptions: CategoryOption[] = useMemo(() => {
    const baseOptions = SERVICE_CATEGORY_OPTIONS.map((option) => ({
      value: option.value,
      label: t(option.labelKey),
    }));
    const optionMap = new Map(baseOptions.map((option) => [option.value, option]));

    services?.forEach((service) => {
      if (!service.category) return;
      if (!optionMap.has(service.category)) {
        optionMap.set(service.category, {
          value: service.category,
          label: service.category,
        });
      }
    });

    return Array.from(optionMap.values());
  }, [services, t]);

  const filteredServices = useMemo(() => {
    if (!services) return [];
    const trimmed = searchTerm.trim().toLowerCase();
    return services.filter((service) => {
      const matchesSearch = !trimmed
        ? true
        : [service.name, service.description, service.category]
            .filter((value): value is string => Boolean(value))
            .some((value) => value.toLowerCase().includes(trimmed));
      const matchesCategory =
        categoryFilter === "all" || service.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [categoryFilter, searchTerm, services]);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("provider_services_title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("provider_services_subtitle")}
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" /> {t("add_service")}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                {t("provider_services_total")}
              </p>
              <p className="text-2xl font-bold">{metrics.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                {t("provider_services_online")}
              </p>
              <p className="text-2xl font-bold text-emerald-600">
                {metrics.online}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                {t("provider_services_paused")}
              </p>
              <p className="text-2xl font-bold text-amber-600">
                {metrics.paused}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                {t("provider_services_categories")}
              </p>
              <p className="text-2xl font-bold">{metrics.categories}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>{t("provider_services_list_title")}</CardTitle>
              <CardDescription>{t("provider_services_list_subtitle")}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
              <div className="relative w-full md:w-64">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t("provider_services_search_placeholder")}
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-56">
                  <SelectValue placeholder={t("provider_services_filter_category")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all")}</SelectItem>
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {services?.length
                    ? t("provider_services_empty_filtered")
                    : t("provider_services_empty")}
                </p>
                {!services?.length ? (
                  <Button className="mt-4" onClick={openCreateDialog}>
                    <Plus className="mr-2 h-4 w-4" /> {t("add_service")}
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredServices.map((service) => {
                  const isOnline =
                    service.isAvailable && service.isAvailableNow !== false;
                  const categoryLabel =
                    categoryOptions.find((option) => option.value === service.category)
                      ?.label || service.category || t("not_available");

                  return (
                    <Card key={service.id} className="bg-card">
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold">{service.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {service.description}
                            </p>
                          </div>
                          <Badge
                            variant={isOnline ? "default" : "secondary"}
                            className={
                              isOnline
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-800"
                            }
                          >
                            {isOnline ? t("status_online") : t("status_paused")}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{categoryLabel}</Badge>
                          <Badge variant="outline">
                            {formatServicePrice(service.price)}
                          </Badge>
                          <Badge variant="outline">
                            {service.duration} {t("minutes")}
                          </Badge>
                        </div>

                        {service.availabilityNote ? (
                          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                            {service.availabilityNote}
                          </div>
                        ) : null}

                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(service)}
                            className="flex items-center justify-center"
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
                                  {t("delete_service_confirm_title")}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("delete_service_confirm_description")}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    deleteServiceMutation.mutate(service.id)
                                  }
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {t("delete")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[760px]">
            <DialogHeader>
              <DialogTitle>
                {editingService ? t("edit_service") : t("add_service")}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <Tabs
                  value={activeTab}
                  onValueChange={(value) =>
                    setActiveTab(value as "basic" | "availability")
                  }
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="basic">{t("basic_info")}</TabsTrigger>
                    <TabsTrigger value="availability">{t("availability")}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("service_name")}</FormLabel>
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
                            <FormLabel>{t("service_description")}</FormLabel>
                            <FormControl>
                              <Textarea {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("service_category")}</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t("select_category")}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {SERVICE_CATEGORY_OPTIONS.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {t(option.labelKey)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="price"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("service_price")} (₹)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="e.g., 500"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="duration"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {t("service_duration")} ({t("minutes")})
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="e.g., 60"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="availability">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-muted/40">
                        <div>
                          <h3 className="text-lg font-medium">
                            {t("service_availability_advanced")}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {t("service_availability_hint")}
                          </p>
                        </div>
                        <FormField
                          control={form.control}
                          name="isAvailableNow"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                              <FormLabel className="font-semibold">
                                {field.value
                                  ? t("available_now")
                                  : t("offline")}
                              </FormLabel>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="availabilityNote"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {t("availability_note_optional")}
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder={t("availability_note_placeholder")}
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                        {t("service_location_profile_note")}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setDialogOpen(false)}
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createServiceMutation.isPending ||
                      updateServiceMutation.isPending
                    }
                  >
                    {(createServiceMutation.isPending ||
                      updateServiceMutation.isPending) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {editingService ? t("update_service") : t("create_service")}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
