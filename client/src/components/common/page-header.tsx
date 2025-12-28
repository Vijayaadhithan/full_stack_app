import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ReactNode } from "react";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    showBackButton?: boolean;
    backDestination?: string;
    children?: ReactNode;
    className?: string; // For additional styling
}

export function PageHeader({
    title,
    subtitle,
    showBackButton = false,
    backDestination = "/provider",
    children,
    className,
}: PageHeaderProps) {
    return (
        <div className={`flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6 ${className || ''}`}>
            <div className="flex items-start gap-3">
                {showBackButton && (
                    <div className="pt-1">
                        <Link href={backDestination}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                <ArrowLeft className="h-4 w-4" />
                                <span className="sr-only">Back</span>
                            </Button>
                        </Link>
                    </div>
                )}
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                    {subtitle && (
                        <p className="text-sm text-muted-foreground">{subtitle}</p>
                    )}
                </div>
            </div>
            {children && (
                <div className="flex items-center gap-2">
                    {children}
                </div>
            )}
        </div>
    );
}
