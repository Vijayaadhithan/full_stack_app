import { useAuth } from "@/hooks/use-auth";
import { useUserContext } from "@/contexts/UserContext";
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
  const { profiles, isLoadingProfiles, appMode } = useUserContext();

  if (isFetching || isLoadingProfiles) {
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

  // Multi-profile access logic:
  // Users can access routes based on:
  // 1. Their user.role (default role from database)
  // 2. Having a shop profile (can access /shop routes)
  // 3. Having a provider profile (can access /provider routes)
  // 4. All users can access /customer routes

  if (roles && roles.length > 0) {
    const userRole = user.role || "customer";

    // Check if user has permission for these roles
    let hasAccess = roles.includes(userRole);

    // If route allows "shop" and user has a shop profile, grant access
    if (!hasAccess && roles.includes("shop") && profiles.hasShop) {
      hasAccess = true;
    }

    // If route allows "provider" and user has a provider profile, grant access
    if (!hasAccess && roles.includes("provider") && profiles.hasProvider) {
      hasAccess = true;
    }

    // If route allows "customer", all authenticated users have access
    if (!hasAccess && roles.includes("customer")) {
      hasAccess = true;
    }

    // Workers can access shop routes too
    if (!hasAccess && roles.includes("worker") && userRole === "worker") {
      hasAccess = true;
    }

    if (!hasAccess) {
      // Redirect based on what profiles they have, or to customer as fallback
      let fallback = "/customer";
      if (appMode === "SHOP" && profiles.hasShop) {
        fallback = "/shop";
      } else if (appMode === "PROVIDER" && profiles.hasProvider) {
        fallback = "/provider";
      }

      return (
        <Route path={path}>
          <Redirect to={fallback} />
        </Route>
      );
    }
  }

  return <Route path={path}>{(params) => <Component {...params} />}</Route>;
}
