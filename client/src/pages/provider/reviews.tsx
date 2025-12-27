import React, { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/language-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Review, Service } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Star } from "lucide-react";
import { motion } from "framer-motion";
import { formatIndianDisplay } from "@shared/date-utils";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function ProviderReviews() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [replyText, setReplyText] = useState<{ [key: number]: string }>({});

  const { data: reviews, isLoading } = useQuery<Review[]>({
    queryKey: [`/api/reviews/provider/${user?.id}`],
    queryFn: () =>
      apiRequest("GET", `/api/reviews/provider/${user?.id}`).then((r) => r.json()),
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: [`/api/services/provider/${user?.id}`],
    enabled: !!user?.id,
  });

  const serviceNameById = useMemo(() => {
    return new Map(services?.map((service) => [service.id, service.name]) ?? []);
  }, [services]);

  const reviewStats = useMemo(() => {
    const total = reviews?.length ?? 0;
    const average = total
      ? (reviews ?? []).reduce((sum, review) => sum + review.rating, 0) / total
      : 0;
    const fiveStar = reviews?.filter((review) => review.rating === 5).length ?? 0;
    const pendingReplies =
      reviews?.filter((review) => !review.providerReply).length ?? 0;
    return { total, average, fiveStar, pendingReplies };
  }, [reviews]);

  const replyMutation = useMutation({
    mutationFn: async ({
      reviewId,
      response,
    }: {
      reviewId: number;
      response: string;
    }) => {
      const res = await apiRequest("POST", `/api/reviews/${reviewId}/reply`, {
        response,
      });
      if (!res.ok) throw new Error("Failed to reply to review");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/reviews/provider/${user?.id}`],
      });
      toast({
        title: t("success"),
        description: t("provider_reviews_reply_success"),
      });
      setReplyText({});
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleReply = (reviewId: number) => {
    if (!replyText[reviewId]?.trim()) return;
    replyMutation.mutate({
      reviewId,
      response: replyText[reviewId],
    });
  };

  return (
    <DashboardLayout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6 p-6"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("provider_reviews_title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("provider_reviews_subtitle")}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                {t("provider_reviews_average")}
              </p>
              <p className="text-2xl font-bold">
                {reviewStats.average ? reviewStats.average.toFixed(1) : "0.0"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                {t("provider_reviews_total")}
              </p>
              <p className="text-2xl font-bold">{reviewStats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                {t("provider_reviews_five_star")}
              </p>
              <p className="text-2xl font-bold">{reviewStats.fiveStar}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                {t("provider_reviews_pending")}
              </p>
              <p className="text-2xl font-bold text-amber-600">
                {reviewStats.pendingReplies}
              </p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !reviews?.length ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">{t("provider_reviews_empty")}</p>
            </CardContent>
          </Card>
        ) : (
          <motion.div variants={container} className="space-y-4">
            {reviews.map((review) => {
              const serviceLabel = review.serviceId
                ? serviceNameById.get(review.serviceId)
                : null;

              return (
                <motion.div key={review.id} variants={item}>
                  <Card>
                    <CardContent className="p-6 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: review.rating }).map((_, i) => (
                            <Star
                              key={i}
                              className="h-4 w-4 fill-yellow-400 text-yellow-400"
                            />
                          ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {serviceLabel ? (
                            <Badge variant="outline">{serviceLabel}</Badge>
                          ) : null}
                          <span>
                            {t("provider_reviews_date_label")}:{" "}
                            {formatIndianDisplay(review.createdAt || "", "date")}
                          </span>
                        </div>
                      </div>

                      <p>
                        {review.review?.trim() || t("provider_reviews_no_comment")}
                      </p>

                      {review.providerReply ? (
                        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                          <span className="font-semibold">
                            {t("provider_reviews_your_reply")}:
                          </span>{" "}
                          {review.providerReply}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            placeholder={t("provider_reviews_reply_placeholder")}
                            value={replyText[review.id] || ""}
                            onChange={(e) =>
                              setReplyText({
                                ...replyText,
                                [review.id]: e.target.value,
                              })
                            }
                          />
                          <Button
                            onClick={() => handleReply(review.id)}
                            disabled={
                              !replyText[review.id]?.trim() ||
                              replyMutation.isPending
                            }
                          >
                            {replyMutation.isPending && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {t("provider_reviews_reply_button")}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
