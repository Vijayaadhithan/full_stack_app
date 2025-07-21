import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/language-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Edit2 } from "lucide-react";
import { Service } from "@shared/schema";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

export default function ProviderServices() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: services, isLoading } = useQuery<Service[]>({
    queryKey: [`/api/services/provider/${user?.id}`],
    enabled: !!user?.id,
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: number) => {
      const res = await apiRequest("DELETE", `/api/services/${serviceId}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete service");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/services/provider/${user?.id}`],
      });
      toast({
        title: "Service deleted",
        description: "Your service has been deleted successfully.",
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

  const handleDeleteService = (serviceId: number) => {
    deleteServiceMutation.mutate(serviceId);
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="flex flex-col p-6">
              <span className="text-2xl font-bold">
                {services?.length || 0}
              </span>
              <span className="text-sm text-muted-foreground">
                Active Services
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col p-6">
              <span className="text-2xl font-bold">0</span>
              <span className="text-sm text-muted-foreground">
                Pending Bookings
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col p-6">
              <span className="text-2xl font-bold">0.0</span>
              <span className="text-sm text-muted-foreground">
                Average Rating
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col p-6">
              <span className="text-2xl font-bold">0</span>
              <span className="text-sm text-muted-foreground">
                Notifications
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Services Section */}
        <Card className="mt-6">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Services Offered</h2>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : !services?.length ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No services added yet
                </p>
                <Button variant="outline" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Service
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.map((service) => (
                  <Card key={service.id} className="bg-card">
                    <CardContent className="p-4">
                      <div className="flex flex-col">
                        <div className="flex justify-between items-start">
                          <h3 className="font-semibold">{service.name}</h3>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDialogOpen(true)}
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
                                    Are you sure?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will
                                    permanently delete your service and remove
                                    it from our servers.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      handleDeleteService(service.id)
                                    }
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {service.description}
                        </p>
                        <div className="mt-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Price</span>
                            <span className="font-medium">
                              ₹{service.price}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Duration</span>
                            <span>{service.duration} minutes</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
