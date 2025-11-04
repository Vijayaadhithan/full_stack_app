import React, { Suspense, lazy, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

import LogoMark from "@/components/branding/logo-mark";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_BASE_URL, apiRequest } from "@/lib/queryClient";
import { translations, type AuthTranslations, type SupportedLanguage } from "./auth/translations";

const RegisterFlow = lazy(() => import("./auth/RegisterFlow"));
const ForgotPassword = lazy(() => import("./auth/ForgotPassword"));

const loginSchema = z.object({
  identifier: z.string().min(1, "Required"),
  password: z.string().min(1, "Required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

type AuthTab = "login" | "register";

function isValidEmail(value: string) {
  return /.+@.+\..+/.test(value.trim());
}

export default function AuthPage() {
  const {
    loginMutation,
    registerMutation,
    user,
    isFetching: authIsFetching,
  } = useAuth();
  const [, setLocation] = useLocation();
  const [language, setLanguage] = useState<SupportedLanguage>("en");
  const [activeTab, setActiveTab] = useState<AuthTab>("login");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [magicLinkMessage, setMagicLinkMessage] = useState<string | null>(null);
  const [magicLinkError, setMagicLinkError] = useState<string | null>(null);
  const [initialForgotEmail, setInitialForgotEmail] = useState<string>("");
  const t: AuthTranslations = translations[language];

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  useEffect(() => {
    if (
      !authIsFetching &&
      user &&
      !loginMutation.isPending &&
      !registerMutation.isPending
    ) {
      const targetPath = user.role === "worker" ? "/shop" : `/${user.role}`;
      setLocation(targetPath);
    }
  }, [
    user,
    authIsFetching,
    loginMutation.isPending,
    registerMutation.isPending,
    setLocation,
  ]);

  const handleSendMagicLink = async () => {
    setMagicLinkError(null);
    setMagicLinkMessage(null);
    const identifier = loginForm.getValues("identifier");
    if (!isValidEmail(identifier)) {
      setMagicLinkError(t.magicLinkEmailRequired);
      return;
    }
    try {
      await apiRequest("POST", "/api/auth/send-magic-link", {
        email: identifier.trim().toLowerCase(),
      });
      setMagicLinkMessage(t.magicLinkSent);
    } catch (error) {
      setMagicLinkError(t.magicLinkError);
    }
  };

  const handleLoginSubmit = loginForm.handleSubmit((data) => {
    loginMutation.mutate({
      username: data.identifier.trim(),
      password: data.password,
    });
  });

  const handleOpenForgotPassword = () => {
    const identifier = loginForm.getValues("identifier") ?? "";
    setInitialForgotEmail(isValidEmail(identifier) ? identifier : "");
    setMagicLinkError(null);
    setMagicLinkMessage(null);
    setShowForgotPassword(true);
  };

  const handleCloseForgotPassword = () => {
    setShowForgotPassword(false);
  };

  if (showForgotPassword) {
    return (
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            Loading...
          </div>
        }
      >
        <ForgotPassword
          t={t}
          language={language}
          onLanguageChange={setLanguage}
          onClose={handleCloseForgotPassword}
          initialEmail={initialForgotEmail}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader className="space-y-4">
          <div className="flex justify-end">
            <Select
              value={language}
              onValueChange={(val) => setLanguage(val as SupportedLanguage)}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder={t.language} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">हिंदी</SelectItem>
                <SelectItem value="ta">தமிழ்</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-full justify-center">
            <LogoMark size={56} />
          </div>
          <CardTitle className="text-2xl text-center">{t.welcome}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AuthTab)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{t.login}</TabsTrigger>
              <TabsTrigger value="register">{t.register}</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="pt-6">
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="identifier">{t.identifierLabel}</Label>
                  <Input
                    id="identifier"
                    autoComplete="username"
                    {...loginForm.register("identifier")}
                  />
                  {loginForm.formState.errors.identifier && (
                    <p className="text-red-500 text-sm">
                      {loginForm.formState.errors.identifier.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="login-password">{t.password}</Label>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    {...loginForm.register("password")}
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-red-500 text-sm">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <Button
                    variant="link"
                    type="button"
                    onClick={handleOpenForgotPassword}
                    className="p-0 h-auto"
                  >
                    {t.forgotPassword}
                  </Button>
                  <Button
                    variant="link"
                    type="button"
                    className="p-0 h-auto"
                    onClick={handleSendMagicLink}
                    disabled={loginMutation.isPending}
                  >
                    {t.sendMagicLink}
                  </Button>
                </div>
                {magicLinkMessage && (
                  <p className="text-sm text-green-600">{magicLinkMessage}</p>
                )}
                {magicLinkError && (
                  <p className="text-sm text-red-500">{magicLinkError}</p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    t.login
                  )}
                </Button>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => (window.location.href = `${API_BASE_URL}/auth/google`)}
                >
                  {t.continueWithGoogle}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="pt-6">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin" />
                  </div>
                }
              >
                <RegisterFlow
                  t={t}
                  language={language}
                  registerMutation={registerMutation}
                  onRegistrationSuccess={() => setActiveTab("login")}
                />
              </Suspense>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
