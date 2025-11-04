import React, { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { InsertUser, ShopProfile } from "@shared/schema";
import { API_BASE_URL, apiRequest } from "@/lib/queryClient";
import type { AuthTranslations, SupportedLanguage } from "./translations";
import type { UseMutationResult } from "@tanstack/react-query";

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "error";
type EmailStatus = "idle" | "checking" | "available" | "taken" | "error";
type SignupStep = 1 | 2 | 3;

type PasswordStrength = {
  score: number;
  label: string;
  tone: "weak" | "medium" | "strong";
};

const signupSchema = z
  .object({
    email: z.string().email("Valid email is required"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(64, "Password is too long"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    name: z.string().min(1, "Name is required"),
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(32, "Username must be at most 32 characters")
      .regex(/^[a-zA-Z0-9._-]+$/, "Only letters, numbers, dots, underscores, and dashes"),
    phone: z
      .string()
      .min(8, "Phone number looks too short")
      .max(16, "Phone number looks too long"),
    role: z.enum(["customer", "provider", "shop"]),
    providerBio: z.string().optional(),
    providerExperience: z.string().optional(),
    providerLanguages: z.string().optional(),
    shopName: z.string().optional(),
    shopBusinessType: z.string().optional(),
    shopDescription: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        path: ["confirmPassword"],
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
      });
    }
    if (data.role === "provider") {
      if (!data.providerBio || data.providerBio.trim().length < 20) {
        ctx.addIssue({
          path: ["providerBio"],
          code: z.ZodIssueCode.custom,
          message: "Please share at least 20 characters",
        });
      }
      if (!data.providerExperience) {
        ctx.addIssue({
          path: ["providerExperience"],
          code: z.ZodIssueCode.custom,
          message: "Experience is required",
        });
      }
      if (!data.providerLanguages) {
        ctx.addIssue({
          path: ["providerLanguages"],
          code: z.ZodIssueCode.custom,
          message: "Languages are required",
        });
      }
    }
    if (data.role === "shop") {
      if (!data.shopName) {
        ctx.addIssue({
          path: ["shopName"],
          code: z.ZodIssueCode.custom,
          message: "Shop name is required",
        });
      }
      if (!data.shopBusinessType) {
        ctx.addIssue({
          path: ["shopBusinessType"],
          code: z.ZodIssueCode.custom,
          message: "Business type is required",
        });
      }
      if (!data.shopDescription || data.shopDescription.trim().length < 20) {
        ctx.addIssue({
          path: ["shopDescription"],
          code: z.ZodIssueCode.custom,
          message: "Please share at least 20 characters",
        });
      }
    }
  });

type SignupFormData = z.infer<typeof signupSchema>;

type RegisterMutation = UseMutationResult<unknown, Error, InsertUser>;

function calculatePasswordStrength(password: string, t: AuthTranslations): PasswordStrength {
  if (!password) {
    return { score: 0, label: t.passwordWeak, tone: "weak" };
  }
  let score = 0;
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 15;
  if (/[A-Z]/.test(password)) score += 20;
  if (/[a-z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^A-Za-z0-9]/.test(password)) score += 10;

  if (score >= 80) return { score, label: t.passwordStrong, tone: "strong" };
  if (score >= 50) return { score, label: t.passwordMedium, tone: "medium" };
  return { score, label: t.passwordWeak, tone: "weak" };
}

function passwordStrengthColor(tone: PasswordStrength["tone"]) {
  if (tone === "strong") return "bg-emerald-500";
  if (tone === "medium") return "bg-amber-500";
  return "bg-rose-500";
}

type RegisterFlowProps = {
  t: AuthTranslations;
  language: SupportedLanguage;
  registerMutation: RegisterMutation;
  onRegistrationSuccess: () => void;
};

export default function RegisterFlow({
  t,
  language,
  registerMutation,
  onRegistrationSuccess,
}: RegisterFlowProps) {
  const [signupStep, setSignupStep] = useState<SignupStep>(1);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [signupEmailFeedback, setSignupEmailFeedback] = useState<string | null>(null);

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      name: "",
      username: "",
      phone: "",
      role: "customer",
      providerBio: "",
      providerExperience: "",
      providerLanguages: "",
      shopName: "",
      shopBusinessType: "",
      shopDescription: "",
    },
  });

  const watchedRole = useWatch({ control: signupForm.control, name: "role" });
  const watchedPassword = useWatch({ control: signupForm.control, name: "password" });
  const watchedUsername = useWatch({ control: signupForm.control, name: "username" });

  const passwordStrength = useMemo(
    () => calculatePasswordStrength(watchedPassword ?? "", t),
    [watchedPassword, t],
  );

  useEffect(() => {
    if (watchedRole === "customer" && signupStep === 3) {
      setSignupStep(2);
    }
  }, [watchedRole, signupStep]);

  useEffect(() => {
    const username = (watchedUsername ?? "").trim().toLowerCase();
    if (!username) {
      setUsernameStatus("idle");
      return;
    }
    if (username.length < 3) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    const handle = setTimeout(async () => {
      try {
        const res = await apiRequest("POST", "/api/auth/check-username", {
          username,
        });
        const result = await res.json();
        setUsernameStatus(result.available ? "available" : "taken");
      } catch (error) {
        setUsernameStatus("error");
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [watchedUsername]);

  useEffect(() => {
    if (registerMutation.isSuccess) {
      signupForm.reset();
      setSignupStep(1);
      setEmailStatus("idle");
      setSignupEmailFeedback(null);
      onRegistrationSuccess();
    }
  }, [registerMutation.isSuccess, signupForm, onRegistrationSuccess]);

  const totalSteps = watchedRole === "customer" ? 2 : 3;

  const stepFieldMap: Record<SignupStep, (keyof SignupFormData)[]> = {
    1: ["email", "password", "confirmPassword"],
    2: ["name", "username", "phone", "role"],
    3:
      watchedRole === "provider"
        ? ["providerBio", "providerExperience", "providerLanguages"]
        : ["shopName", "shopBusinessType", "shopDescription"],
  };

  const handleSignupComplete = async () => {
    const fields = stepFieldMap[Math.min(signupStep, totalSteps) as SignupStep];
    const valid = await signupForm.trigger(fields);
    if (!valid) return;

    const data = signupForm.getValues();
    const normalizedPhone = data.phone.replace(/\D+/g, "");
    const payload: InsertUser = {
      username: data.username.toLowerCase().trim(),
      password: data.password,
      role: data.role,
      name: data.name.trim(),
      phone: normalizedPhone,
      email: data.email.toLowerCase().trim(),
      language,
      emailVerified: false,
      averageRating: "0",
      totalReviews: 0,
    };

    if (data.role === "provider") {
      payload.bio = data.providerBio?.trim();
      payload.experience = data.providerExperience?.trim();
      payload.languages = data.providerLanguages?.trim();
    }

    if (data.role === "shop") {
      const shopProfile: ShopProfile = {
        shopName: data.shopName!.trim(),
        businessType: data.shopBusinessType!.trim(),
        description: data.shopDescription!.trim(),
        workingHours: {
          from: "09:00",
          to: "18:00",
          days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        },
      };
      payload.shopProfile = shopProfile;
    }

    registerMutation.mutate(payload);
  };

  const handleSignupNext = async () => {
    const fields = stepFieldMap[signupStep];
    const isValid = await signupForm.trigger(fields);
    if (!isValid) return;

    if (signupStep === 1) {
      setEmailStatus("checking");
      setSignupEmailFeedback(null);
      try {
        const email = signupForm.getValues("email").toLowerCase().trim();
        const res = await apiRequest("POST", "/api/auth/email-lookup", {
          email,
        });
        const result = await res.json();
        if (result.exists) {
          setEmailStatus("taken");
          setSignupEmailFeedback(t.emailInUse);
          return;
        }
        setEmailStatus("available");
        setSignupEmailFeedback(t.emailAvailable);
      } catch (error) {
        setEmailStatus("error");
        setSignupEmailFeedback(t.emailError);
        return;
      }
    }

    if (signupStep === 2) {
      if (usernameStatus === "taken" || usernameStatus === "error") {
        return;
      }
      if (usernameStatus === "checking") {
        return;
      }
      if (totalSteps === 2) {
        await handleSignupComplete();
        return;
      }
    }

    setSignupStep((prev) => {
      if (prev === 1) {
        return Math.min(2, totalSteps) as SignupStep;
      }
      if (prev === 2) {
        return Math.min(3, totalSteps) as SignupStep;
      }
      return prev;
    });
  };

  const handleSignupBack = () => {
    setSignupStep((prev) => {
      if (prev === 3) return 2;
      if (prev === 2) return 1;
      return prev;
    });
  };

  const handleSignupSubmit = async () => {
    if (signupStep < totalSteps) {
      await handleSignupNext();
    } else {
      await handleSignupComplete();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {t.step} {Math.min(signupStep, totalSteps)} {t.of} {totalSteps}
        </span>
        {signupEmailFeedback && signupStep >= 2 && (
          <span
            className={
              emailStatus === "available"
                ? "text-emerald-600"
                : emailStatus === "taken"
                  ? "text-red-500"
                  : "text-muted-foreground"
            }
          >
            {signupEmailFeedback}
          </span>
        )}
      </div>

      {signupStep === 1 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="signup-email">{t.email}</Label>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              {...signupForm.register("email")}
            />
            {signupForm.formState.errors.email && (
              <p className="text-red-500 text-sm">
                {signupForm.formState.errors.email.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="signup-password">{t.password}</Label>
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              {...signupForm.register("password")}
            />
            {signupForm.formState.errors.password && (
              <p className="text-red-500 text-sm">
                {signupForm.formState.errors.password.message}
              </p>
            )}
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">
                {t.passwordStrength}: {passwordStrength.label}
              </span>
              <div className="h-2 w-full bg-muted rounded">
                <div
                  className={`h-2 rounded ${passwordStrengthColor(passwordStrength.tone)}`}
                  style={{ width: `${Math.min(passwordStrength.score, 100)}%` }}
                />
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="signup-confirm">{t.confirmPassword}</Label>
            <Input
              id="signup-confirm"
              type="password"
              autoComplete="new-password"
              {...signupForm.register("confirmPassword")}
            />
            {signupForm.formState.errors.confirmPassword && (
              <p className="text-red-500 text-sm">
                {signupForm.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>
        </div>
      )}

      {signupStep === 2 && (
        <div className="space-y-6">
          <div className="space-y-1">
            <Label htmlFor="signup-name">{t.name}</Label>
            <Input id="signup-name" {...signupForm.register("name")} />
            {signupForm.formState.errors.name && (
              <p className="text-red-500 text-sm">
                {signupForm.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="signup-username">{t.username}</Label>
            <Input
              id="signup-username"
              placeholder="yourname"
              {...signupForm.register("username")}
            />
            <div className="text-xs">
              {usernameStatus === "available" && (
                <span className="text-emerald-600">{t.usernameAvailable}</span>
              )}
              {usernameStatus === "taken" && (
                <span className="text-red-500">{t.usernameTaken}</span>
              )}
              {usernameStatus === "error" && (
                <span className="text-red-500">{t.usernameError}</span>
              )}
            </div>
            {signupForm.formState.errors.username && (
              <p className="text-red-500 text-sm">
                {signupForm.formState.errors.username.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="signup-phone">{t.phone}</Label>
            <Input
              id="signup-phone"
              type="tel"
              autoComplete="tel"
              {...signupForm.register("phone")}
            />
            {signupForm.formState.errors.phone && (
              <p className="text-red-500 text-sm">
                {signupForm.formState.errors.phone.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t.role}</Label>
            <div className="grid gap-3 md:grid-cols-3">
              {["customer", "provider", "shop"].map((role) => {
                const isActive = watchedRole === role;
                const label =
                  role === "customer" ? t.customer : role === "provider" ? t.provider : t.shop;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() =>
                      signupForm.setValue("role", role as SignupFormData["role"], {
                        shouldValidate: true,
                      })
                    }
                    className={`rounded border p-3 text-left transition ${isActive ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <span className="block font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {role === "customer"
                        ? "Book services quickly"
                        : role === "provider"
                          ? "Offer on-demand services"
                          : "Manage your storefront"}
                    </span>
                  </button>
                );
              })}
            </div>
            {signupForm.formState.errors.role && (
              <p className="text-red-500 text-sm">
                {signupForm.formState.errors.role.message}
              </p>
            )}
          </div>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <span className="text-sm text-muted-foreground">{t.continueWithGoogle}</span>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const role = signupForm.getValues("role") || "customer";
                window.location.href = `${API_BASE_URL}/auth/google?role=${role}`;
              }}
            >
              {t.continueWithGoogle}
            </Button>
          </div>
        </div>
      )}

      {signupStep === 3 && watchedRole === "provider" && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t.providerDetailsTitle}</h3>
          <div className="space-y-1">
            <Label htmlFor="provider-bio">Bio</Label>
            <Textarea
              id="provider-bio"
              rows={4}
              placeholder={t.providerBioPlaceholder}
              {...signupForm.register("providerBio")}
            />
            {signupForm.formState.errors.providerBio && (
              <p className="text-red-500 text-sm">
                {signupForm.formState.errors.providerBio.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="provider-experience">{t.providerExperiencePlaceholder}</Label>
            <Input
              id="provider-experience"
              placeholder="5"
              {...signupForm.register("providerExperience")}
            />
            {signupForm.formState.errors.providerExperience && (
              <p className="text-red-500 text-sm">
                {signupForm.formState.errors.providerExperience.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="provider-languages">{t.providerLanguagesPlaceholder}</Label>
            <Input
              id="provider-languages"
              placeholder="English, Tamil"
              {...signupForm.register("providerLanguages")}
            />
            {signupForm.formState.errors.providerLanguages && (
              <p className="text-red-500 text-sm">
                {signupForm.formState.errors.providerLanguages.message}
              </p>
            )}
          </div>
        </div>
      )}

      {signupStep === 3 && watchedRole === "shop" && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t.shopDetailsTitle}</h3>
          <div className="space-y-1">
            <Label htmlFor="shop-name">{t.shop}</Label>
            <Input
              id="shop-name"
              placeholder={t.shopNamePlaceholder}
              {...signupForm.register("shopName")}
            />
            {signupForm.formState.errors.shopName && (
              <p className="text-red-500 text-sm">
                {signupForm.formState.errors.shopName.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="shop-type">{t.shopBusinessTypePlaceholder}</Label>
            <Input
              id="shop-type"
              placeholder="Salon"
              {...signupForm.register("shopBusinessType")}
            />
            {signupForm.formState.errors.shopBusinessType && (
              <p className="text-red-500 text-sm">
                {signupForm.formState.errors.shopBusinessType.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="shop-description">{t.shopDescriptionPlaceholder}</Label>
            <Textarea
              id="shop-description"
              rows={4}
              {...signupForm.register("shopDescription")}
            />
            {signupForm.formState.errors.shopDescription && (
              <p className="text-red-500 text-sm">
                {signupForm.formState.errors.shopDescription.message}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={handleSignupBack}
          disabled={signupStep === 1}
          className="sm:w-[140px]"
        >
          {t.back}
        </Button>
        <Button
          type="button"
          onClick={handleSignupSubmit}
          disabled={registerMutation.isPending}
          className="sm:w-[160px]"
        >
          {registerMutation.isPending ? (
            <Loader2 className="animate-spin" />
          ) : signupStep === totalSteps ? (
            t.finish
          ) : (
            t.next
          )}
        </Button>
      </div>
    </div>
  );
}
