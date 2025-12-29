import React, { useState } from "react";
import { formatIndianDisplay } from "@shared/date-utils";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Star, AlertCircle } from "lucide-react"; // Import icons
import { Review, ProductReview } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";

// Use the updated Review type from the backend modification
interface ReviewWithService extends Review {
  serviceName: string | null; // Service name is now directly available
}

interface ProductReviewWithProduct extends ProductReview {
  productName?: string | null;
}

const StarRating = ({
  rating,
  readOnly = false,
  onRate,
  size = 5,
}: {
  rating: number | null;
  readOnly?: boolean;
  onRate?: (rating: number) => void;
  size?: number;
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  return (
    <div className="flex items-center space-x-1">
      {[...Array(size)].map((_, index) => {
        const starValue = index + 1;
        const isFilled = starValue <= (hoverRating ?? rating ?? 0);
        return (
          <Star
            key={index}
            className={`h-5 w-5 cursor-${readOnly ? "default" : "pointer"} ${isFilled ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`}
            onMouseEnter={() => !readOnly && setHoverRating(starValue)}
            onMouseLeave={() => !readOnly && setHoverRating(null)}
            onClick={() => !readOnly && onRate?.(starValue)}
          />
        );
      })}
    </div>
  );
};

const MyReviews: React.FC = () => {
  const [editingReview, setEditingReview] = useState<ReviewWithService | null>(
    null,
  );
  const [editingProductReview, setEditingProductReview] =
    useState<ProductReviewWithProduct | null>(null);
  const [editRating, setEditRating] = useState<number | null>(null);
  const [editComment, setEditComment] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { user } = useAuth();

  // Use React Query for service reviews
  const { data: reviews = [], isLoading: reviewsLoading, error: reviewsError } = useQuery<ReviewWithService[]>({
    queryKey: ["/api/reviews/customer"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/reviews/customer");
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    },
    enabled: !!user,
  });

  // Use React Query for product reviews
  const { data: productReviews = [], isLoading: productReviewsLoading, error: productReviewsError } = useQuery<ProductReviewWithProduct[]>({
    queryKey: ["/api/product-reviews/customer"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/product-reviews/customer");
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    },
    enabled: !!user,
  });

  const loading = reviewsLoading || productReviewsLoading;
  const error = reviewsError || productReviewsError;

  // Mutation for updating reviews
  const updateReviewMutation = useMutation({
    mutationFn: async ({ id, rating, review, isProduct }: { id: number; rating: number; review: string; isProduct: boolean }) => {
      const url = isProduct ? `/api/product-reviews/${id}` : `/api/reviews/${id}`;
      const response = await apiRequest("PATCH", url, { rating, review });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to save changes." }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate the appropriate query to refresh data
      if (variables.isProduct) {
        queryClient.invalidateQueries({ queryKey: ["/api/product-reviews/customer"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/reviews/customer"] });
      }
      handleCloseDialog();
    },
    onError: (err: Error) => {
      setSubmitError(`Failed to save changes: ${err.message || "Please try again."}`);
    },
  });

  const handleEditClick = (review: ReviewWithService) => {
    setEditingReview(review);
    setEditingProductReview(null);
    setEditRating(review.rating);
    setEditComment(review.review || "");
    setSubmitError(null);
  };

  const handleProductEditClick = (review: ProductReviewWithProduct) => {
    setEditingProductReview(review);
    setEditingReview(null);
    setEditRating(review.rating);
    setEditComment(review.review || "");
    setSubmitError(null);
  };

  const handleCloseDialog = () => {
    setEditingReview(null);
    setEditingProductReview(null);
    setEditRating(null);
    setEditComment("");
  };

  const handleSaveChanges = () => {
    const currentReview = editingReview || editingProductReview;
    if (!currentReview || editRating === null) return;
    setSubmitError(null);

    updateReviewMutation.mutate({
      id: currentReview.id,
      rating: editRating,
      review: editComment,
      isProduct: !!editingProductReview,
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to load reviews.";
    return (
      <DashboardLayout>
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">My Reviews</h1>
        {reviews.length === 0 ? (
          <p>You haven&apos;t submitted any reviews yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review) => (
              <Card key={review.id}>
                <CardHeader>
                  <CardTitle>
                    {review.serviceName || `Service ID: ${review.serviceId}`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <StarRating rating={review.rating} readOnly />
                  <p className="text-sm text-muted-foreground">
                    {review.review || "No comment provided."}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Reviewed on:{" "}
                    {review.createdAt
                      ? formatIndianDisplay(review.createdAt, "date")
                      : "Date Unavailable"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditClick(review)}
                  >
                    Edit Review
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <h2 className="text-2xl font-semibold mt-8">Product Reviews</h2>
        {productReviews.length === 0 ? (
          <p>You haven&apos;t submitted any product reviews yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {productReviews.map((review) => (
              <Card key={review.id}>
                <CardHeader>
                  <CardTitle>
                    {review.productName || `Product ID: ${review.productId}`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <StarRating rating={review.rating} readOnly />
                  <p className="text-sm text-muted-foreground">
                    {review.review || "No comment provided."}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Reviewed on:{" "}
                    {review.createdAt
                      ? formatIndianDisplay(review.createdAt, "date")
                      : "Date Unavailable"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleProductEditClick(review)}
                  >
                    Edit Review
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Review Dialog using Shadcn UI */}
      <Dialog
        open={!!editingReview || !!editingProductReview}
        onOpenChange={(open) => !open && handleCloseDialog()}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              Edit Review for{" "}
              {editingReview
                ? editingReview.serviceName
                : editingProductReview?.productName ||
                `Product ID: ${editingProductReview?.productId}`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {submitError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-rating">Your Rating</Label>
              <StarRating rating={editRating} onRate={setEditRating} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-comment">Your Comment (Optional)</Label>
              <Textarea
                id="edit-comment"
                placeholder="Tell us more about your experience..."
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={updateReviewMutation.isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={handleSaveChanges}
              disabled={updateReviewMutation.isPending || editRating === null}
            >
              {updateReviewMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {updateReviewMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MyReviews;
