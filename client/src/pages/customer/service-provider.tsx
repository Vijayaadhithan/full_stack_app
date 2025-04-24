import { useEffect } from 'react';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Service, User, Review } from "@shared/schema";
import { Loader2, MapPin, Clock, Star } from "lucide-react";
import { motion } from "framer-motion";
import { useParams, Link } from "wouter";
import { formatIndianDisplay } from '@shared/date-utils'; // Import IST utility

// Helper function to format address
const formatAddress = (user: User | undefined): string => {
  if (!user) return "Address not available";
  const parts = [
    user.addressStreet,
    user.addressCity,
    user.addressState,
    user.addressPostalCode,
    user.addressCountry,
  ].filter(Boolean); // Filter out null/undefined/empty strings
  return parts.length > 0 ? parts.join(', ') : "Address not available";
};

export default function ServiceProvider() {
  const { id } = useParams<{ id: string }>();
  console.log("ServiceProvider component - Service ID from params:", id);

  // Fetch service details with provider info
  const { data: service, isLoading, isError: serviceIsError, error: serviceError, isSuccess: serviceIsSuccess } = useQuery<Service & { provider: User }, Error>({
    queryKey: [`/api/services/${id}`],
    enabled: !!id,
    retry: false, // Optional: prevent retries on error if desired
  });

  // Fetch reviews separately
  const { data: reviews, isLoading: reviewsLoading, isError: reviewsIsError, error: reviewsError, isSuccess: reviewsIsSuccess } = useQuery<Review[], Error>({
    queryKey: [`/api/reviews/service/${id}`],
    enabled: !!id,
    retry: false, // Optional: prevent retries on error if desired
  });

  // Handle service query side effects
  useEffect(() => {
    if (serviceIsError && serviceError) {
      console.error("Error fetching service:", serviceError);
      console.error("Query key:", [`/api/services/${id}`]);
    }
  }, [serviceIsError, serviceError, id]);

  useEffect(() => {
    if (serviceIsSuccess && service) {
      console.log("Successfully fetched service data:", service);
    }
  }, [serviceIsSuccess, service]);

  // Handle reviews query side effects
  useEffect(() => {
    if (reviewsIsError && reviewsError) {
      console.error("Error fetching reviews:", reviewsError);
    }
  }, [reviewsIsError, reviewsError]);

  useEffect(() => {
    if (reviewsIsSuccess && reviews) {
      console.log("Successfully fetched reviews data:", reviews);
    }
  }, [reviewsIsSuccess, reviews]);

  const isPageLoading = isLoading || reviewsLoading;

  if (isPageLoading) {
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

  // Ensure reviews is an array before calculating average rating
  const validReviews = Array.isArray(reviews) ? reviews : [];
  const averageRating = validReviews.length
    ? validReviews.reduce((acc, review) => acc + review.rating, 0) / validReviews.length
    : 0;

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-4xl mx-auto space-y-6 p-6"
      >
        <div className="flex flex-col md:flex-row gap-6">
          {/* Provider Info Card */}
          <motion.div className="md:w-1/3">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex flex-col items-center text-center">
                  <img
                    src={service.provider?.profilePicture || "https://via.placeholder.com/128"}
                    alt={service.provider?.name}
                    className="h-32 w-32 rounded-full object-cover mb-4"
                  />
                  <h2 className="text-2xl font-bold">{service.provider?.name}</h2>
                  <div className="flex items-center gap-1 text-yellow-500">
                    <Star className="h-4 w-4 fill-current" />
                    <span>{averageRating.toFixed(1)} ({validReviews.length || 0} reviews)</span>
                  </div>
                  <p className="text-muted-foreground mt-2 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {formatAddress(service.provider)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Service Details */}
          <motion.div className="md:w-2/3 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{service.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-muted-foreground">{service.description}</p>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>{service.duration} minutes</span>
                    </div>
                    <span className="text-xl font-bold">₹{service.price}</span>
                  </div>
                  {service.isAvailable ? (
                    <Link href={`/customer/book-service/${service.id}`}>
                      <Button className="w-full">Book Now</Button>
                    </Link>
                  ) : (
                    <Button className="w-full" disabled>
                      Currently Unavailable
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Reviews Section */}
            <Card>
              <CardHeader>
                <CardTitle>Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {!validReviews.length ? (
                    <p className="text-center text-muted-foreground">No reviews yet</p>
                  ) : (
                    validReviews.map((review) => (
                      <div key={review.id} className="border-b pb-4 last:border-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="flex text-yellow-500">
                              {Array.from({ length: review.rating }).map((_, i) => (
                                <Star key={i} className="h-4 w-4 fill-current" />
                              ))}
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {formatIndianDisplay(review.createdAt || '', 'date')} {/* Use formatIndianDisplay */}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm">{review.review}</p>
                        {review.providerReply && (
                          <div className="mt-2 pl-4 border-l-2">
                            <p className="text-sm text-muted-foreground">
                              <span className="font-semibold">Response:</span> {review.providerReply}
                            </p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}