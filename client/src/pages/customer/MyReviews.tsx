import React, { useState, useEffect, useCallback } from "react";
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
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

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
  const [reviews, setReviews] = useState<ReviewWithService[]>([]);
  const [productReviews, setProductReviews] = useState<
    ProductReviewWithProduct[]
  >([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editingReview, setEditingReview] = useState<ReviewWithService | null>(
    null,
  );
  const [editingProductReview, setEditingProductReview] =
    useState<ProductReviewWithProduct | null>(null);
  const [editRating, setEditRating] = useState<number | null>(null);
  const [editComment, setEditComment] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { user } = useAuth();

  const fetchReviews = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [serviceRes, productRes] = await Promise.all([
        apiRequest("GET", "/api/reviews/customer"),
        apiRequest("GET", "/api/product-reviews/customer"),
      ]);

      if (!serviceRes.ok)
        throw new Error(`HTTP error! status: ${serviceRes.status}`);
      if (!productRes.ok)
        throw new Error(`HTTP error! status: ${productRes.status}`);

      const serviceData = (await serviceRes.json()) as ReviewWithService[];
      const productData =
        (await productRes.json()) as ProductReviewWithProduct[];

      setReviews(serviceData);
      setProductReviews(productData);
    } catch (err: any) {
      console.error("Failed to fetch reviews:", err);
      setError(
        `Failed to load your reviews: ${err.message || "Please try again later."}`,
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

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

  const handleSaveChanges = async () => {
    const currentReview = editingReview || editingProductReview;
    if (!currentReview || editRating === null) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const url = editingReview
        ? `/api/reviews/${editingReview.id}`
        : `/api/product-reviews/${editingProductReview!.id}`;
      const response = await apiRequest("PATCH", url, {
        rating: editRating,
        review: editComment,
      });
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Failed to save changes." }));
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`,
        );
      }
      // Update local state immediately
      const updatedReview = await response.json();
      if (editingReview) {
        setReviews((prevReviews) =>
          prevReviews.map((review) =>
            review.id === editingReview.id
              ? {
                  ...review,
                  ...(updatedReview as ReviewWithService),
                  serviceName: review.serviceName,
                }
              : review,
          ),
        );
      } else if (editingProductReview) {
        setProductReviews((prevReviews) =>
          prevReviews.map((review) =>
            review.id === editingProductReview.id
              ? { ...review, ...(updatedReview as ProductReviewWithProduct) }
              : review,
          ),
        );
      }
      // No need to fetch all reviews again
      // await fetchReviews();
      handleCloseDialog();
    } catch (err: any) {
      console.error("Failed to update review:", err);
      setSubmitError(
        `Failed to save changes: ${err.message || "Please try again."}`,
      );
    } finally {
      setIsSubmitting(false);
    }
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
    return (
      <DashboardLayout>
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
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
          <p>You haven't submitted any reviews yet.</p>
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
                      ? new Date(review.createdAt).toLocaleDateString()
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
          <p>You haven't submitted any product reviews yet.</p>
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
                      ? new Date(review.createdAt).toLocaleDateString()
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
              <Button variant="outline" disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={handleSaveChanges}
              disabled={isSubmitting || editRating === null}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MyReviews;
