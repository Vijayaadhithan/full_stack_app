import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type DeliveryMethod = "delivery" | "pickup";

interface DeliveryMethodSelectorProps {
  value: DeliveryMethod;
  onChange: (value: DeliveryMethod) => void;
  pickupAvailable?: boolean;
  deliveryAvailable?: boolean;
  className?: string;
}

export function DeliveryMethodSelector({
  value,
  onChange,
  pickupAvailable = true,
  deliveryAvailable = true,
  className,
}: DeliveryMethodSelectorProps) {
  const options: Array<{
    value: DeliveryMethod;
    title: string;
    description: string;
    emoji: string;
    available: boolean;
  }> = [
    {
      value: "delivery",
      title: "Bring to my house",
      description: "Home delivery",
      emoji: "🛵",
      available: deliveryAvailable,
    },
    {
      value: "pickup",
      title: "I will come take it",
      description: "In-store pickup",
      emoji: "🛍️",
      available: pickupAvailable,
    },
  ];

  const availableOptions = options.filter((option) => option.available);

  return (
    <div
      role="radiogroup"
      aria-label="Delivery method"
      className={cn("grid gap-3 sm:grid-cols-2", className)}
    >
      {availableOptions.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors",
              selected
                ? "border-primary bg-primary/5"
                : "bg-background hover:bg-muted/40",
            )}
          >
            <span className="text-2xl leading-none" aria-hidden="true">
              {option.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium leading-tight">{option.title}</div>
              <div className="text-xs text-muted-foreground">
                {option.description}
              </div>
            </div>
            {selected ? (
              <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
