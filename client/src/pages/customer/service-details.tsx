import React from 'react';
import { useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, MapPin, Star, Clock } from "lucide-react";
import Meta from "@/components/meta";
import { ServiceDetail } from "@shared/api-contract";
import { apiClient } from "@/lib/apiClient";

export default function ServiceDetails() {
  const { id } = useParams<{ id: string }>();
  console.log("Service ID from params:", id);

  const {
    data: service,
    isLoading,
    isError,
    error,
    isSuccess,
  } = useQuery<ServiceDetail, Error>({
    queryKey: [`/api/services/${id}`],
    queryFn: () =>
      apiClient.get("/api/services/:id", {
        params: { id: Number(id) },
      }),
    enabled: !!id,
    retry: false,
  });

  useEffect(() => {
    if (isError && error) {
      console.error("Error fetching service:", error);
      console.error("Query key:", [`/api/services/${id}`]);
    }
  }, [isError, error, id]);

  useEffect(() => {
    if (isSuccess && service) {
      console.log("Successfully fetched service:", service);
    }
  }, [isSuccess, service]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <Meta title="Loading Service..." />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!service) {
    return (
      <DashboardLayout>
        <Meta title="Service Not Found" />
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <h2 className="text-2xl font-bold mb-4">Service not found</h2>
          <Link href="/customer/browse-services">
            <Button>Back to Services</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const providerName = service.provider?.name ?? "Provider";
  const providerInitial = providerName.charAt(0).toUpperCase();
  const providerAddress = [
    service.provider?.addressStreet,
    service.provider?.addressCity,
    service.provider?.addressState,
    service.provider?.addressPostalCode,
    service.provider?.addressCountry,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <DashboardLayout>
      <Meta
        title={`${service.name} - Service`}
        description={`Learn about ${service.name} offered by ${providerName}.`}
        schema={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: service.name,
          description: service.description,
          provider: {
            "@type": "Person",
            name: providerName,
          },
        }}
      />
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
                      alt={providerName}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl">
                      {providerInitial}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-medium">{providerName}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    <span>
                      {service.rating?.toFixed(1) || "N/A"} (
                      {service.reviews?.length || 0} reviews)
                    </span>
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
                  <span>
                    Location:{" "}
                    {providerAddress || "Not specified"}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">{service.description}</p>
                <p className="mt-2 font-semibold">₹{service.price}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
              Ratings & Reviews
            </CardTitle>
            <CardDescription>
              {service.rating && service.reviews?.length
                ? `${service.rating.toFixed(1)} out of 5 • ${service.reviews.length} review${
                    service.reviews.length !== 1 ? "s" : ""
                  }`
                : "No reviews yet"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!service.reviews?.length ? (
              <p className="text-sm text-muted-foreground">
                Customers haven’t reviewed this service yet.
              </p>
            ) : (
              service.reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-lg border p-4 space-y-2 bg-muted/30"
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star
                          key={index}
                          className={`h-4 w-4 ${
                            index < review.rating
                              ? "fill-yellow-400 text-yellow-500"
                              : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                    {review.createdAt && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {review.review ? (
                    <p className="text-sm text-muted-foreground">
                      {review.review}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No written feedback provided.
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
}
