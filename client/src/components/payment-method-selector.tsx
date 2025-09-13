import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { PaymentMethodType } from "@shared/schema";

interface PaymentMethodSelectorProps {
  value: PaymentMethodType;
  onChange: (value: PaymentMethodType) => void;
}

export function PaymentMethodSelector({ value, onChange }: PaymentMethodSelectorProps) {
  return (
    <RadioGroup value={value} onValueChange={onChange}>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="upi" id="upi" />
        <Label htmlFor="upi">UPI</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="cash" id="cash" />
        <Label htmlFor="cash">Cash</Label>
      </div>
    </RadioGroup>
  );
}
