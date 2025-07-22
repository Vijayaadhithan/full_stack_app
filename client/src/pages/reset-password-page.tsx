import React from 'react';
import { useState, useEffect } from "react";
import { useLocation, Redirect } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

//const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
import { useTranslation } from "react-i18next";

const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters long"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"], // path of error
  });

type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = searchParams.get("token");
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    } else {
      // No token, redirect or show error
      setMessage(t("resetPassword.invalidLink"));
      // Consider redirecting to login after a delay
    }
  }, [t]);

  const form = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ResetPasswordData) => {
    if (!token) {
      toast({
        title: t("resetPassword.errorTitle"),
        description: t("resetPassword.invalidOrMissingToken"),
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await apiRequest(
        "POST",
        "/api/reset-password",
        { token, newPassword: data.newPassword },
      );
      const result = await response.json();
      if (response.ok) {
        toast({
          title: t("resetPassword.successTitle"),
          description: t("resetPassword.successMessage"),
        });
        setMessage(
          t("resetPassword.successMessage") +
            " " +
            t("resetPassword.redirectingToLogin"),
        );
        setTimeout(() => {
          navigate("/auth");
        }, 3000);
      } else {
        toast({
          title: t("resetPassword.errorTitle"),
          description: result.message || t("resetPassword.errorMessage"),
          variant: "destructive",
        });
        setMessage(result.message || t("resetPassword.errorMessage"));
      }
    } catch (error) {
      toast({
        title: t("resetPassword.errorTitle"),
        description: t("resetPassword.networkError"),
        variant: "destructive",
      });
      setMessage(t("resetPassword.networkError"));
    }
    setIsLoading(false);
  };

  if (!token && !message) {
    // Still checking for token, or initial state before error
    return <p>{t("loading")}</p>; // Or a loading spinner
  }

  if (!token && message) {
    // Token was invalid/missing from the start
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("resetPassword.errorTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-500">{message}</p>
            <Button onClick={() => navigate("/auth")} className="mt-4 w-full">
              {t("resetPassword.backToLogin")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("resetPassword.title")}</CardTitle>
          <CardDescription>{t("resetPassword.description")}</CardDescription>
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">
                {t("resetPassword.newPasswordLabel")}
              </Label>
              <Input
                id="newPassword"
                type="password"
                {...form.register("newPassword")}
              />
              {form.formState.errors.newPassword && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.newPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                {t("resetPassword.confirmPasswordLabel")}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                {...form.register("confirmPassword")}
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
            {message && (
              <p
                className={
                  message.includes(t("resetPassword.successMessage"))
                    ? "text-green-500"
                    : "text-red-500"
                }
              >
                {message}
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading
                ? t("resetPassword.resettingButton")
                : t("resetPassword.resetButton")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
