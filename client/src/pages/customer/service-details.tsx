import React from 'react';
import { formatIndianDisplay } from "@shared/date-utils";
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
import { Loader2, MapPin, Star, Clock, Sparkles } from "lucide-react";
import Meta from "@/components/meta";
import { ServiceDetail } from "@shared/api-contract";
import { apiClient } from "@/lib/apiClient";
import { useLanguage } from "@/contexts/language-context";

export default function ServiceDetails() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
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
          <h2 className="text-2xl font-bold mb-4">
            {t("service_not_found")}
          </h2>
          <Link href="/customer/browse-services">
            <Button>{t("back_to_services")}</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const providerName = service.provider?.name ?? t("provider_label");
  const providerInitial = providerName.charAt(0).toUpperCase();
  const serviceImage = service.images?.[0] ?? null;
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
        className="max-w-5xl mx-auto space-y-6 p-6"
      >
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-sky-50 via-white to-emerald-50 shadow-sm">
          <CardContent className="p-0">
            <div className="grid gap-6 p-6 md:grid-cols-[220px_1fr]">
              <div className="h-40 w-full overflow-hidden rounded-2xl bg-muted/60">
                {serviceImage ? (
                  <img
                    src={serviceImage}
                    alt={service.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-500">
                    <Sparkles className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("service_category")}: {service.category}
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold">{service.name}</h1>
                  <p className="text-sm text-muted-foreground">
                    {service.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-sm">
                    <Clock className="h-4 w-4" />
                    {t("service_duration_label").replace(
                      "{minutes}",
                      String(service.duration),
                    )}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-sm">
                    <MapPin className="h-4 w-4" />
                    {providerAddress || t("location_not_specified")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xl font-semibold">
                    {t("starting_price_label").replace(
                      "{price}",
                      `₹${service.price}`,
                    )}
                  </p>
                  <Link href={`/customer/book-service/${id}`}>
                    <Button size="lg">{t("book_now")}</Button>
                  </Link>
                  <Link href="/customer/browse-services">
                    <Button variant="outline" size="lg">
                      {t("back_to_services")}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white/80 shadow-sm">
          <CardHeader>
            <CardTitle>{t("service_provider")}</CardTitle>
            <CardDescription>{t("provider_support_line")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                {service.provider?.profilePicture ? (
                  <img
                    src={service.provider.profilePicture}
                    alt={providerName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-semibold">{providerInitial}</span>
                )}
              </div>
              <div>
                <p className="font-medium">{providerName}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                  <span>
                    {service.rating?.toFixed(1) || t("not_available")} •{" "}
                    {service.reviews?.length || 0} {t("reviews_label")}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {t("provider_location_hint")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
              {t("ratings_reviews")}
            </CardTitle>
            <CardDescription>
              {service.rating && service.reviews?.length
                ? t("ratings_summary")
                  .replace("{rating}", service.rating.toFixed(1))
                  .replace("{count}", String(service.reviews.length))
                : t("no_reviews_yet")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!service.reviews?.length ? (
              <p className="text-sm text-muted-foreground">
                {t("no_reviews_message")}
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
                          className={`h-4 w-4 ${index < review.rating
                              ? "fill-yellow-400 text-yellow-500"
                              : "text-muted-foreground"
                            }`}
                        />
                      ))}
                    </div>
                    {review.createdAt && (
                      <span className="text-xs text-muted-foreground">
                        {formatIndianDisplay(review.createdAt, "date")}
                      </span>
                    )}
                  </div>
                  {review.review ? (
                    <p className="text-sm text-muted-foreground">
                      {review.review}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      {t("no_written_feedback")}
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
