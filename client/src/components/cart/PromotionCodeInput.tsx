import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Tag, CheckCircle2, XCircle } from "lucide-react";

type PromotionCodeInputProps = {
  shopId: number;
  cartItems: Array<{
    productId: number;
    quantity: number;
    price: number | string;
  }>;
  subtotal: number;
  onApplyPromotion: (promotionData: {
    discountAmount: number;
    finalTotal: number;
    promotionId: number;
    code: string;
  }) => void;
  onClearPromotion: () => void;
};

export function PromotionCodeInput({
  shopId,
  cartItems,
  subtotal,
  onApplyPromotion,
  onClearPromotion,
}: PromotionCodeInputProps) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);

  const validatePromotionMutation = useMutation({
    mutationFn: async (promoCode: string) => {
      const res = await apiRequest("POST", "/api/promotions/validate", {
        code: promoCode,
        shopId,
        cartItems,
        subtotal,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Invalid promotion code");
      }

      return res.json();
    },
    onSuccess: (data) => {
      // Apply the promotion to the cart
      onApplyPromotion({
        discountAmount: data.discountAmount,
        finalTotal: data.finalTotal,
        promotionId: data.promotion.id,
        code: data.promotion.code,
      });

      setAppliedCode(code);
      toast({
        title: "Promotion applied",
        description: `Discount of ₹${data.discountAmount.toFixed(2)} applied to your order.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleApplyCode = () => {
    if (!code.trim()) return;
    validatePromotionMutation.mutate(code.trim());
  };

  const handleClearCode = () => {
    setCode("");
    setAppliedCode(null);
    onClearPromotion();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Promotion Code</span>
      </div>

      {appliedCode ? (
        <div className="flex items-center justify-between bg-muted p-2 rounded-md">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">{appliedCode}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearCode}
            className="h-8 px-2"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter code"
            className="h-9"
            disabled={validatePromotionMutation.isPending}
          />
          <Button
            onClick={handleApplyCode}
            disabled={!code.trim() || validatePromotionMutation.isPending}
            className="h-9"
          >
            {validatePromotionMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Apply"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}