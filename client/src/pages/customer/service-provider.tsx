import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Service, User, Review } from "@shared/schema";
import { Loader2, MapPin, Clock, Star, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { useParams, Link } from "wouter";

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

export default function ServiceProvider() {
  const { id } = useParams();

  const { data: provider, isLoading: providerLoading } = useQuery<User>({
    queryKey: [`/api/users/${id}`],
  });

  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: [`/api/services/provider/${id}`],
  });

  const { data: reviews, isLoading: reviewsLoading } = useQuery<Review[]>({
    queryKey: [`/api/reviews/provider/${id}`],
  });

  const averageRating = reviews?.length 
    ? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length
    : 0;

  if (providerLoading || servicesLoading || reviewsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-4xl mx-auto space-y-6"
      >
        <div className="flex flex-col md:flex-row gap-6">
          <motion.div variants={item} className="md:w-1/3">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex flex-col items-center text-center">
                  <img
                    src={provider?.profilePicture || "https://via.placeholder.com/128"}
                    alt={provider?.name}
                    className="h-32 w-32 rounded-full object-cover mb-4"
                  />
                  <h2 className="text-2xl font-bold">{provider?.name}</h2>
                  <div className="flex items-center gap-1 text-yellow-500">
                    <Star className="h-4 w-4 fill-current" />
                    <span>{averageRating.toFixed(1)} ({reviews?.length} reviews)</span>
                  </div>
                  <p className="text-muted-foreground mt-2 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {provider?.address}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={item} className="md:w-2/3 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Services Offered</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {services?.map((service) => (
                    <div
                      key={service.id}
                      className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold">{service.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {service.description}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">₹{service.price}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {service.duration} mins
                          </p>
                        </div>
                      </div>
                      <Link href={`/customer/book-service/${service.id}`}>
                        <Button className="w-full">
                          <Calendar className="h-4 w-4 mr-2" />
                          Book Now
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reviews?.map((review) => (
                    <div key={review.id} className="border-b pb-4 last:border-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex text-yellow-500">
                            {Array.from({ length: review.rating }).map((_, i) => (
                              <Star key={i} className="h-4 w-4 fill-current" />
                            ))}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {new Date(review.createdAt).toLocaleDateString()}
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
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
