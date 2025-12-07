import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { PaymentMethodType } from "@shared/schema";

interface PaymentMethodSelectorProps {
  value: PaymentMethodType;
  onChange: (value: PaymentMethodType) => void;
  allowPayLater?: boolean;
  disableCash?: boolean;
  payLaterDisabledReason?: string;
}

export function PaymentMethodSelector({
  value,
  onChange,
  allowPayLater = false,
  disableCash = false,
  payLaterDisabledReason,
}: PaymentMethodSelectorProps) {
  const payLaterDisabled = Boolean(payLaterDisabledReason);

  return (
    <RadioGroup value={value} onValueChange={onChange}>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="upi" id="upi" />
        <Label htmlFor="upi">UPI</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="cash" id="cash" disabled={disableCash} />
        <Label htmlFor="cash">Cash</Label>
      </div>
      {allowPayLater && (
        <div className="flex flex-col space-y-1">
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value="pay_later"
              id="pay_later"
              disabled={payLaterDisabled}
            />
            <Label htmlFor="pay_later">Pay Later</Label>
          </div>
          <p className="text-xs text-muted-foreground ml-6">
            Known customers can request to pay after pickup/delivery. The shop will approve before processing.
            {payLaterDisabledReason ? ` ${payLaterDisabledReason}` : ""}
          </p>
        </div>
      )}
    </RadioGroup>
  );
}
