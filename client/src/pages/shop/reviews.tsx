import React from 'react';
import { ShopLayout } from "@/components/layout/shop-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Star, MessageSquare } from "lucide-react";
import { ProductReview } from "@shared/schema";
import { useState } from "react";
import { formatIndianDisplay } from "@shared/date-utils"; // Import IST utility

type ReplyFormData = {
  reply: string;
};

export default function ShopReviews() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [replyingTo, setReplyingTo] = useState<number | null>(null);

  const { data: reviews, isLoading } = useQuery<ProductReview[]>({
    queryKey: [`/api/reviews/shop/${user?.id}`],
    enabled: !!user?.id,
  });

  const form = useForm<ReplyFormData>({
    defaultValues: {
      reply: "",
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({
      reviewId,
      reply,
    }: {
      reviewId: number;
      reply: string;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/product-reviews/${reviewId}/reply`,
        { reply },
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to reply to review");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/reviews/shop/${user?.id}`],
      });
      toast({
        title: "Success",
        description: "Reply posted successfully",
      });
      form.reset();
      setReplyingTo(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ReplyFormData) => {
    if (replyingTo) {
      replyMutation.mutate({ reviewId: replyingTo, reply: data.reply });
    }
  };

  return (
    <ShopLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Product Reviews</h1>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !reviews?.length ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No reviews yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex text-yellow-500">
                          {Array.from({ length: review.rating }).map((_, i) => (
                            <Star key={i} className="h-4 w-4 fill-current" />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {review.createdAt
                            ? formatIndianDisplay(review.createdAt, "date")
                            : "N/A"}{" "}
                          {/* Use formatIndianDisplay */}
                        </span>
                      </div>
                      <p>{review.review}</p>
                      {review.images && review.images.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {review.images.map((image, i) => (
                            <img
                              key={i}
                              src={image}
                              alt={`Review image ${i + 1}`}
                              className="h-20 w-20 object-cover rounded"
                            />
                          ))}
                        </div>
                      )}
                      {review.shopReply && (
                        <div className="mt-4 pl-4 border-l-2">
                          <p className="text-sm text-muted-foreground">
                            <span className="font-semibold">
                              Your response:
                            </span>{" "}
                            {review.shopReply}
                          </p>
                        </div>
                      )}
                      {!review.shopReply && (
                        <div className="mt-4">
                          {replyingTo === review.id ? (
                            <form
                              onSubmit={form.handleSubmit(onSubmit)}
                              className="space-y-4"
                            >
                              <Textarea
                                {...form.register("reply")}
                                placeholder="Write your reply..."
                              />
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => setReplyingTo(null)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="submit"
                                  disabled={replyMutation.isPending}
                                >
                                  {replyMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  )}
                                  Post Reply
                                </Button>
                              </div>
                            </form>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setReplyingTo(review.id)}
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Reply to Review
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
