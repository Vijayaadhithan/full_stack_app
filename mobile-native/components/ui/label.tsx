import * as React from "react";
import { Text } from "react-native";
import { cn } from "../../lib/utils";

const Label = React.forwardRef<
    React.ElementRef<typeof Text>,
    React.ComponentPropsWithoutRef<typeof Text>
>(({ className, ...props }, ref) => (
    <Text
        ref={ref}
        className={cn(
            "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground",
            className
        )}
        {...props}
    />
));
Label.displayName = "Label";

export { Label };
