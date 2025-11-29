import { cva, type VariantProps } from "class-variance-authority";
import { Text, TouchableOpacity } from "react-native";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
    "flex-row items-center justify-center rounded-md",
    {
        variants: {
            variant: {
                default: "bg-primary",
                destructive: "bg-destructive",
                outline: "border border-input bg-background",
                secondary: "bg-secondary",
                ghost: "hover:bg-accent hover:text-accent-foreground",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 rounded-md px-3",
                lg: "h-11 rounded-md px-8",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);

const textVariants = cva("text-sm font-medium", {
    variants: {
        variant: {
            default: "text-primary-foreground",
            destructive: "text-destructive-foreground",
            outline: "text-foreground",
            secondary: "text-secondary-foreground",
            ghost: "text-foreground",
            link: "text-primary",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});

export interface ButtonProps
    extends React.ComponentPropsWithoutRef<typeof TouchableOpacity>,
    VariantProps<typeof buttonVariants> {
    label?: string;
}

export function Button({
    className,
    variant,
    size,
    label,
    children,
    ...props
}: ButtonProps) {
    return (
        <TouchableOpacity
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        >
            {label ? (
                <Text className={cn(textVariants({ variant }))}>{label}</Text>
            ) : typeof children === "string" ? (
                <Text className={cn(textVariants({ variant }))}>{children}</Text>
            ) : (
                children
            )}
        </TouchableOpacity>
    );
}
