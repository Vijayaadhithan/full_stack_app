import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Review } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Star } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

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

export default function ProviderReviews() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [replyText, setReplyText] = useState<{ [key: number]: string }>({});

  const { data: reviews, isLoading } = useQuery<Review[]>({
    queryKey: [`/api/reviews/provider/${user?.id}`],
    enabled: !!user?.id,
  });

  const replyMutation = useMutation({
    mutationFn: async ({ reviewId, response }: { reviewId: number; response: string }) => {
      const res = await apiRequest("POST", `/api/reviews/${reviewId}/reply`, { response });
      if (!res.ok) throw new Error("Failed to reply to review");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/reviews/provider/${user?.id}`] });
      toast({
        title: "Reply sent",
        description: "Your reply has been posted successfully.",
      });
      setReplyText({});
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
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
        className="space-y-6"
      >
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Reviews & Ratings</h1>
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
          <motion.div variants={container} className="space-y-4">
            {reviews.map((review) => (
              <motion.div key={review.id} variants={item}>
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      {Array.from({ length: review.rating }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <p>{review.review}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(review.createdAt || '').toLocaleDateString()}
                    </p>

                    {review.providerReply ? (
                      <div className="mt-4 pl-4 border-l-2">
                        <p className="text-sm">
                          <span className="font-semibold">Your reply:</span> {review.providerReply}
                        </p>
                        {/* Assuming no respondedAt field based on schema, removing the date display */}
                        {/* <p className="text-xs text-muted-foreground mt-1">
                          {new Date(review.respondedAt || '').toLocaleDateString()}
                        </p> */}
                      </div>
                    ) : (
                      <div className="mt-4 space-y-2">
                        <Input
                          placeholder="Write your reply..."
                          value={replyText[review.id] || ''}
                          onChange={(e) => setReplyText({
                            ...replyText,
                            [review.id]: e.target.value
                          })}
                        />
                        <Button
                          onClick={() => handleReply(review.id)}
                          disabled={!replyText[review.id]?.trim() || replyMutation.isPending}
                        >
                          {replyMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Reply
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
