import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/language-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit2, Clock, Calendar } from "lucide-react";
import { Service, insertServiceSchema } from "@shared/schema";
import { z } from "zod";
import { useState } from "react";
import { ServiceAvailabilityForm } from "@/components/service-availability-form";
import { ServiceAvailabilityCalendar } from "@/components/service-availability-calendar";

// Extended service form schema with availability
const serviceFormSchema = insertServiceSchema.extend({
  workingHours: z.object({
    monday: z.object({
      isAvailable: z.boolean(),
      start: z.string(),
      end: z.string(),
    }),
    tuesday: z.object({
      isAvailable: z.boolean(),
      start: z.string(),
      end: z.string(),
    }),
    wednesday: z.object({
      isAvailable: z.boolean(),
      start: z.string(),
      end: z.string(),
    }),
    thursday: z.object({
      isAvailable: z.boolean(),
      start: z.string(),
      end: z.string(),
    }),
    friday: z.object({
      isAvailable: z.boolean(),
      start: z.string(),
      end: z.string(),
    }),
    saturday: z.object({
      isAvailable: z.boolean(),
      start: z.string(),
      end: z.string(),
    }),
    sunday: z.object({
      isAvailable: z.boolean(),
      start: z.string(),
      end: z.string(),
    }),
  }),
  breakTime: z.array(z.object({
    start: z.string(),
    end: z.string(),
  })),
  maxDailyBookings: z.number().min(1, "Must accept at least 1 booking per day"),
  bufferTime: z.number().min(0, "Buffer time must be non-negative"),
  duration: z.number().min(15, "Duration must be at least 15 minutes"),
  price: z.string().min(1, "Price is required"),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }).nullable(),
});

type ServiceFormData = z.infer<typeof serviceFormSchema>;

export default function ProviderServices() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [activeTab, setActiveTab] = useState("basic");

  const { data: services, isLoading } = useQuery<Service[]>({
    queryKey: [`/api/services/provider/${user?.id}`],
    enabled: !!user?.id,
  });

  const defaultWorkingHours = {
    isAvailable: true,
    start: "09:00",
    end: "17:00",
  };

  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      price: "",
      duration: 60,
      bufferTime: 15,
      isAvailable: true,
      workingHours: {
        monday: defaultWorkingHours,
        tuesday: defaultWorkingHours,
        wednesday: defaultWorkingHours,
        thursday: defaultWorkingHours,
        friday: defaultWorkingHours,
        saturday: defaultWorkingHours,
        sunday: { ...defaultWorkingHours, isAvailable: false },
      },
      breakTime: [{ start: "13:00", end: "14:00" }],
      maxDailyBookings: 8,
      location: { lat: 19.076, lng: 72.8777 }, // Default to Mumbai coordinates

    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      console.log("Creating service with data:", data); // Debug log
      const res = await apiRequest("POST", "/api/services", {
        ...data,
        providerId: user?.id,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create service");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/services/provider/${user?.id}`] });
      toast({
        title: t("success"),
        description: t("service_created_successfully"),
      });
      form.reset();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      console.error("Service creation error:", error); // Debug log
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ServiceFormData> }) => {
      console.log("Updating service with data:", data); // Debug log
      const res = await apiRequest("PATCH", `/api/services/${id}`, data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update service");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/services/provider/${user?.id}`] });
      toast({
        title: t("success"),
        description: t("service_updated_successfully"),
      });
      setDialogOpen(false);
      setEditingService(null);
    },
    onError: (error: Error) => {
      console.error("Service update error:", error); // Debug log
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ServiceFormData) => {
    console.log("Form submission data:", data); // Debug log
    if (editingService) {
      updateServiceMutation.mutate({ id: editingService.id, data });
    } else {
      createServiceMutation.mutate(data);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">{t('my_services')}</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t('add_service')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px]">
              <DialogHeader>
                <DialogTitle>
                  {editingService ? t('edit_service') : t('add_service')}
                </DialogTitle>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="basic">{t('basic_info')}</TabsTrigger>
                      <TabsTrigger value="availability">{t('availability')}</TabsTrigger>
                      <TabsTrigger value="scheduling">{t('scheduling')}</TabsTrigger>
                      <TabsTrigger value="calendar">{t('calendar')}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="basic">
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('service_name')}</FormLabel>
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
                              <FormLabel>{t('service_description')}</FormLabel>
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
                              <FormLabel>{t('service_category')}</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t('select_category')} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Beauty & Wellness">{t('beauty_wellness')}</SelectItem>
                                  <SelectItem value="Home Services">{t('home_services')}</SelectItem>
                                  <SelectItem value="Professional Services">{t('professional_services')}</SelectItem>
                                  <SelectItem value="Health & Fitness">{t('health_fitness')}</SelectItem>
                                  <SelectItem value="Education & Training">{t('education_training')}</SelectItem>
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
                                <FormLabel>{t('service_price')} (₹)</FormLabel>
                                <FormControl>
                                  <Input {...field} type="number" min="0" step="0.01" />
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
                                <FormLabel>{t('service_duration')} ({t('minutes')})</FormLabel>
                                <FormControl>
                                  <Input {...field} type="number" min="15" step="15" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="isAvailable"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel>{t('available_for_booking')}</FormLabel>
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
                      </div>
                    </TabsContent>

                    <TabsContent value="availability">
                      <ServiceAvailabilityForm form={form} />
                    </TabsContent>

                    <TabsContent value="scheduling">
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="maxDailyBookings"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('max_daily_bookings')}</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="bufferTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('buffer_time')} ({t('minutes')})</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="5"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="calendar">
                      {editingService && (
                        <ServiceAvailabilityCalendar
                          serviceId={editingService.id}
                          workingHours={form.getValues().workingHours}
                          breakTime={form.getValues().breakTime}
                        />
                      )}
                      {!editingService && (
                        <p className="text-center text-muted-foreground py-4">
                          {t('save_service_to_manage_calendar')}
                        </p>
                      )}
                    </TabsContent>
                  </Tabs>

                  <div className="flex justify-end mt-4">
                    <Button
                      type="submit"
                      disabled={form.formState.isSubmitting}
                    >
                      {form.formState.isSubmitting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {editingService ? t('update_service') : t('create_service')}
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
        ) : !services?.length ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">{t('no_services_yet')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {services.map((service) => (
              <Card key={service.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{service.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {service.description}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingService(service);
                        form.reset({
                          ...service,
                          price: service.price.toString(),
                        });
                        setDialogOpen(true);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span>{t('price')}</span>
                      <span className="font-semibold">₹{service.price}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>{t('duration')}</span>
                      <span className="font-semibold">{service.duration} {t('minutes')}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>{t('category')}</span>
                      <span className="font-semibold">{service.category}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium">{t('availability')}</span>
                    </div>
                    <Switch
                      checked={service.isAvailable}
                      onCheckedChange={(checked) =>
                        updateServiceMutation.mutate({
                          id: service.id,
                          data: { isAvailable: checked },
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
    </DashboardLayout>
  );
}