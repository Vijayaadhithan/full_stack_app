import { useAuth } from "@/hooks/use-auth";
import type { UserRole } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
  roles,
}: {
  path: string;
  component: React.ComponentType<any>;
  roles?: UserRole[];
}) {
  const { user, isFetching } = useAuth();

  if (isFetching) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  if (roles && !roles.includes(user.role)) {
    const fallback = user.role ? `/${user.role}` : "/auth";
    return (
      <Route path={path}>
        <Redirect to={fallback} />
      </Route>
    );
  }

  return <Route path={path}>{(params) => <Component {...params} />}</Route>;
}
