import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
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
import LogoMark from "@/components/branding/logo-mark";
import { apiRequest } from "@/lib/queryClient";
import type { AuthTranslations, SupportedLanguage } from "./translations";

const forgotPasswordSchema = z.object({
  email: z.string().email("Valid email is required"),
});

type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;

type ForgotPasswordProps = {
  t: AuthTranslations;
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onClose: () => void;
  initialEmail?: string;
};

export default function ForgotPassword({
  t,
  language,
  onLanguageChange,
  onClose,
  initialEmail = "",
}: ForgotPasswordProps) {
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const forgotPasswordForm = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: initialEmail },
  });

  useEffect(() => {
    forgotPasswordForm.reset({
      email: initialEmail,
    });
  }, [initialEmail, forgotPasswordForm]);

  const handleRequestPasswordReset = async (data: ForgotPasswordData) => {
    setResetMessage(null);
    try {
      const response = await apiRequest("POST", "/api/request-password-reset", data);
      await response.json();
      setResetMessage(t.resetLinkSent);
      forgotPasswordForm.reset({ email: data.email });
    } catch (error) {
      setResetMessage(t.emailError);
      console.error("Password reset request error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-4">
          <div className="flex justify-end">
            <Select
              value={language}
              onValueChange={(val) => onLanguageChange(val as SupportedLanguage)}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder={t.language} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">हिंदी</SelectItem>
                <SelectItem value="ta">தமிழ్</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-full justify-center">
            <LogoMark size={56} />
          </div>
          <CardTitle className="text-2xl text-center">{t.requestPasswordReset}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={forgotPasswordForm.handleSubmit(handleRequestPasswordReset)}
            className="space-y-4"
          >
            <div className="space-y-1">
              <Label htmlFor="email-forgot">{t.email}</Label>
              <Input
                id="email-forgot"
                type="email"
                autoComplete="email"
                {...forgotPasswordForm.register("email")}
              />
              {forgotPasswordForm.formState.errors.email && (
                <p className="text-red-500 text-sm">
                  {forgotPasswordForm.formState.errors.email.message}
                </p>
              )}
            </div>
            {resetMessage && (
              <p
                className={`text-sm ${
                  resetMessage === t.resetLinkSent ? "text-green-600" : "text-red-500"
                }`}
              >
                {resetMessage}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={forgotPasswordForm.formState.isSubmitting}
            >
              {forgotPasswordForm.formState.isSubmitting ? (
                <Loader2 className="animate-spin" />
              ) : (
                t.sendResetLink
              )}
            </Button>
            <Button type="button" variant="link" onClick={onClose} className="w-full">
              {t.backToLogin}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
