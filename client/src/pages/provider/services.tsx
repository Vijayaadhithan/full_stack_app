import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit2, Clock, Image as ImageIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Service, insertServiceSchema } from "@shared/schema";
import { z } from "zod";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

const serviceFormSchema = insertServiceSchema.extend({
  bufferTime: z.coerce.number().min(0, "Buffer time must be a positive number"),
  duration: z.coerce.number().min(15, "Duration must be at least 15 minutes"),
});

type ServiceFormData = z.infer<typeof serviceFormSchema>;

export default function ProviderServices() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: services, isLoading } = useQuery<Service[]>({
    queryKey: [`/api/services/provider/${user?.id}`],
    enabled: !!user?.id,
  });

  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "",
      duration: 60,
      category: "Beauty & Wellness",
      bufferTime: 15,
      isAvailable: true,
      images: [],
      providerId: user?.id || null,
      location: null,
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      const res = await apiRequest("POST", "/api/services", data);
      if (!res.ok) {
        throw new Error("Failed to create service");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/services/provider/${user?.id}`] });
      toast({
        title: "Service created",
        description: "Your service has been created successfully.",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ServiceFormData> }) => {
      const res = await apiRequest("PATCH", `/api/services/${id}`, data);
      if (!res.ok) {
        throw new Error("Failed to update service");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/services/provider/${user?.id}`] });
      toast({
        title: "Service updated",
        description: "Your service has been updated successfully.",
      });
    },
  });

  const onSubmit = (data: ServiceFormData) => {
    createServiceMutation.mutate(data);
  };

  const toggleAvailability = (serviceId: number, isAvailable: boolean) => {
    updateServiceMutation.mutate({
      id: serviceId,
      data: { isAvailable },
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">My Services</h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add New Service
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Add New Service</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Name</FormLabel>
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
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price (₹)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" />
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
                          <FormLabel>Category</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Beauty & Wellness">Beauty & Wellness</SelectItem>
                              <SelectItem value="Home Services">Home Services</SelectItem>
                              <SelectItem value="Professional Services">Professional Services</SelectItem>
                              <SelectItem value="Health & Fitness">Health & Fitness</SelectItem>
                              <SelectItem value="Education & Training">Education & Training</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration (minutes)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" />
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
                          <FormLabel>Buffer Time (minutes)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" />
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
                          <FormLabel>Available for Booking</FormLabel>
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
                      disabled={createServiceMutation.isPending}
                    >
                      {createServiceMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Create Service
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
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid gap-6 md:grid-cols-2"
          >
            {services?.map((service) => (
              <motion.div key={service.id} variants={item}>
                <Card>
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
                          // TODO: Implement edit service
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span>Price</span>
                        <span className="font-semibold">₹{service.price}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span>Duration</span>
                        <span className="font-semibold">{service.duration} mins</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span>Category</span>
                        <span className="font-semibold">{service.category}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <span className="text-sm font-medium">Availability</span>
                      </div>
                      <Switch
                        checked={service.isAvailable}
                        onCheckedChange={(checked) => toggleAvailability(service.id, checked)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}