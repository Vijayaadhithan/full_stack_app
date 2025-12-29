import React, { Suspense, lazy, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";

const ForgotPassword = lazy(() => import("./auth/ForgotPassword"));
const RuralAuthFlow = lazy(() => import("./auth/RuralAuthFlow"));

export default function AuthPage() {
  const {
    loginMutation,
    registerMutation,
    user,
    isFetching: authIsFetching,
  } = useAuth();
  const [, setLocation] = useLocation();
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [language, setLanguage] = useState<"en" | "ta">("en");

  useEffect(() => {
    if (
      !authIsFetching &&
      user &&
      !loginMutation.isPending &&
      !registerMutation.isPending
    ) {
      const targetPath = user.role === "worker" ? "/shop" : `/${user.role || "customer"}`;
      setLocation(targetPath);
    }
  }, [
    user,
    authIsFetching,
    loginMutation.isPending,
    registerMutation.isPending,
    setLocation,
  ]);

  if (showForgotPassword) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-slate-900">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        }
      >
        <ForgotPassword
          language={language}
          onLanguageChange={(lang) => setLanguage(lang)}
          onClose={() => setShowForgotPassword(false)}
        />
      </Suspense>
    );
  }

  // Use the new stunning RuralAuthFlow as the default and only login
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      }
    >
      <RuralAuthFlow onForgotPassword={() => setShowForgotPassword(true)} />
    </Suspense>
  );
}
