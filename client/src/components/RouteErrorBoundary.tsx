import React from "react";
import { useLocation } from "wouter";

interface RouteErrorBoundaryProps {
    children: React.ReactNode;
    routeName?: string;
    fallback?: React.ReactNode;
}

interface RouteErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

/**
 * Route-level error boundary with navigation support.
 * Catches runtime errors in the component tree and provides
 * user-friendly recovery options.
 */
class RouteErrorBoundary extends React.Component<
    RouteErrorBoundaryProps,
    RouteErrorBoundaryState
> {
    constructor(props: RouteErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error(
            `[${this.props.routeName ?? "Route"}] Error captured:`,
            error,
            errorInfo
        );
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: undefined });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <ErrorFallback
                    error={this.state.error}
                    routeName={this.props.routeName}
                    onRetry={this.handleRetry}
                />
            );
        }

        return this.props.children;
    }
}

function ErrorFallback({
    error,
    routeName,
    onRetry,
}: {
    error?: Error;
    routeName?: string;
    onRetry: () => void;
}) {
    const [, setLocation] = useLocation();

    const handleGoHome = () => {
        setLocation("/");
        setTimeout(onRetry, 100);
    };

    return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 p-6 text-center">
            <div className="rounded-full bg-red-100 p-4">
                <svg
                    className="h-12 w-12 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                </svg>
            </div>

            <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-gray-900">
                    Something went wrong
                </h1>
                {routeName && <p className="text-sm text-gray-500">Error in {routeName}</p>}
                <p className="max-w-md text-muted-foreground">
                    {error?.message ?? "An unexpected error occurred. Please try again."}
                </p>
            </div>

            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={onRetry}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                    Try again
                </button>
                <button
                    type="button"
                    onClick={handleGoHome}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                    Go to Home
                </button>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                    Reload page
                </button>
            </div>
        </div>
    );
}

export default RouteErrorBoundary;
