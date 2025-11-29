import * as React from "react";
import { Text, View } from "react-native";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
                secondary:
                    "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
                destructive:
                    "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
                outline: "text-foreground",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

export interface BadgeProps
    extends React.ComponentPropsWithoutRef<typeof View>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <View className={cn(badgeVariants({ variant }), className)} {...props}>
            <Text className={cn(
                variant === "default" && "text-primary-foreground",
                variant === "secondary" && "text-secondary-foreground",
                variant === "destructive" && "text-destructive-foreground",
                variant === "outline" && "text-foreground",
                "text-xs font-semibold"
            )}>
                {props.children}
            </Text>
        </View>
    );
}

export { Badge, badgeVariants };
