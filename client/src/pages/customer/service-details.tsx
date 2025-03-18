import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Service } from "@shared/schema";
import { motion } from "framer-motion";
import { Loader2, MapPin, Clock, Star } from "lucide-react";

type ServiceDetails = Service & {
  provider: {
    id: number;
    name: string;
    email: string; // Added email field
    profilePicture?: string;
  };
  rating: number | null;
  reviews: Array<{
    id: number;
    rating: number;
    review: string;
    createdAt: string;
  }>;
};

export default function ServiceDetails() {
  const { id } = useParams<{ id: string }>();
  console.log("Service ID:", id); // Debug log

  const { data: service, isLoading, error } = useQuery<ServiceDetails>({
    queryKey: [`/api/services/${id}`],
    enabled: !!id,
  });

  console.log("Service Data:", service); // Debug log
  console.log("Loading:", isLoading); // Debug log
  console.log("Error:", error); // Debug log

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!service) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <h2 className="text-2xl font-bold mb-4">Service not found</h2>
          <Link href="/customer/browse-services">
            <Button>Back to Services</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-4xl mx-auto space-y-6 p-6"
      >
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{service.name}</CardTitle>
              <Link href={`/customer/book-service/${id}`}>
                <Button>Book Now</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider Info */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Service Provider</h3>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  {service.provider?.profilePicture ? (
                    <img
                      src={service.provider.profilePicture}
                      alt={service.provider.name}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl">{service.provider?.name[0]}</span>
                  )}
                </div>
                <div>
                  <p className="font-medium">{service.provider?.name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    <span>{service.rating?.toFixed(1) || "N/A"} ({service.reviews?.length || 0} reviews)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Service Details */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Duration: {service.duration} minutes</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>Location: {service.location ? `${service.location.lat}, ${service.location.lng}` : 'Not specified'}</span>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">{service.description}</p>
                <p className="mt-2 font-semibold">₹{service.price}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
}