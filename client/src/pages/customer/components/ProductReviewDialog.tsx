import React from "react";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, Star } from "lucide-react";

type ProductReviewDialogProps = {
  productName?: string;
  rating: number;
  onRatingChange: (value: number) => void;
  reviewText: string;
  onReviewTextChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
};

export default function ProductReviewDialog({
  productName,
  rating,
  onRatingChange,
  reviewText,
  onReviewTextChange,
  onSubmit,
  submitting,
}: ProductReviewDialogProps) {
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Leave a Review for {productName}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-4">
        <div>
          <Label>Rating</Label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <Button
                key={value}
                variant="ghost"
                size="sm"
                className={`p-0 ${value <= rating ? "text-yellow-500" : "text-gray-300"}`}
                onClick={() => onRatingChange(value)}
              >
                <Star className="h-6 w-6 fill-current" />
              </Button>
            ))}
          </div>
        </div>
        <div>
          <Label>Review</Label>
          <Textarea
            value={reviewText}
            onChange={(event) => onReviewTextChange(event.target.value)}
            placeholder="Share your experience..."
          />
        </div>
        <Button className="w-full" onClick={onSubmit} disabled={submitting || !reviewText}>
          {submitting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
          Submit Review
        </Button>
      </div>
    </DialogContent>
  );
}
