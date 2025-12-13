import React, { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthTranslations, SupportedLanguage } from "./translations";
import type { UseMutationResult } from "@tanstack/react-query";
import { API_BASE_URL, apiRequest } from "@/lib/queryClient";
import type { RegisterData } from "@/hooks/use-auth";

type SignupStep = 1 | 2;
type OtpStatus = "idle" | "sending" | "sent" | "error";

type RegisterPayload = RegisterData;

type RegisterMutation = UseMutationResult<unknown, Error, RegisterData>;

const signupSchema = z
  .object({
    phone: z
      .string()
      .min(8, "Phone number looks too short")
      .max(16, "Phone number looks too long"),
    otp: z
      .string()
      .min(4, "Enter the code sent to your phone")
      .max(6, "Enter the code sent to your phone"),
    name: z.string().min(1, "Name is required"),
    pin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits"),
    confirmPin: z.string(),
    role: z.enum(["customer", "provider", "shop"]),
    shopName: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.pin !== data.confirmPin) {
      ctx.addIssue({
        path: ["confirmPin"],
        code: z.ZodIssueCode.custom,
        message: "PINs do not match",
      });
    }
  });

type SignupFormData = z.infer<typeof signupSchema>;

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
  const [otpStatus, setOtpStatus] = useState<OtpStatus>("idle");
  const [otpMessage, setOtpMessage] = useState<string | null>(null);

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: "onChange",
    defaultValues: {
      phone: "",
      otp: "",
      name: "",
      pin: "",
      confirmPin: "",
      role: "customer",
      shopName: "",
    },
  });

  const watchedRole = useWatch({ control: signupForm.control, name: "role" });
  const watchedName = useWatch({ control: signupForm.control, name: "name" });
  const watchedShopName = useWatch({
    control: signupForm.control,
    name: "shopName",
  });

  useEffect(() => {
    if (watchedRole !== "shop") return;
    const trimmedName = (watchedName ?? "").trim();
    if (!trimmedName) return;
    const autoName = `${trimmedName}'s Shop`;
    if (!watchedShopName || watchedShopName === autoName) {
      signupForm.setValue("shopName", autoName, {
        shouldValidate: signupStep === 2,
      });
    }
  }, [watchedName, watchedRole, watchedShopName, signupForm, signupStep]);

  useEffect(() => {
    if (registerMutation.isSuccess) {
      signupForm.reset({
        phone: "",
        otp: "",
        name: "",
        pin: "",
        confirmPin: "",
        role: "customer",
        shopName: "",
      });
      setSignupStep(1);
      setOtpStatus("idle");
      setOtpMessage(null);
      onRegistrationSuccess();
    }
  }, [registerMutation.isSuccess, signupForm, onRegistrationSuccess]);

  const totalSteps: SignupStep = 2;

  const stepFieldMap: Record<SignupStep, (keyof SignupFormData)[]> = {
    1: ["phone", "otp"],
    2: ["name", "pin", "confirmPin", "role", "shopName"],
  };

  const requestOtp = async () => {
    const validPhone = await signupForm.trigger("phone");
    if (!validPhone) return;
    const normalizedPhone = signupForm.getValues("phone").replace(/\D+/g, "");
    signupForm.setValue("phone", normalizedPhone);
    setOtpStatus("sending");
    setOtpMessage(null);
    try {
      const res = await apiRequest("POST", "/api/auth/request-otp", {
        phone: normalizedPhone,
      });
      const result = await res.json();
      setOtpStatus("sent");
      const preview =
        result?.otpPreview && t.devOtpCode
          ? ` (${t.devOtpCode}: ${result.otpPreview})`
          : "";
      setOtpMessage(`${t.otpSent}${preview}`);
    } catch (error) {
      setOtpStatus("error");
      setOtpMessage(t.otpError);
    }
  };

  const handleSignupSubmit = async () => {
    const fields = stepFieldMap[signupStep];
    const isValid = await signupForm.trigger(fields);
    if (!isValid) return;

    if (signupStep === 1) {
      setSignupStep(2);
      return;
    }

    const data = signupForm.getValues();
    const normalizedPhone = data.phone.replace(/\D+/g, "");
    const payload: RegisterPayload = {
      phone: normalizedPhone,
      otp: data.otp.trim(),
      pin: data.pin.trim(),
      role: data.role,
      name: data.name.trim(),
      language,
    };

    if (data.role === "shop") {
      const autoName = `${data.name.trim()}'s Shop`;
      payload.shopName = data.shopName?.trim() || autoName;
    }

    registerMutation.mutate(payload);
  };

  const handleSignupBack = () => {
    setSignupStep((prev) => {
      if (prev === 2) return 1;
      return prev;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {t.step} {signupStep} {t.of} {totalSteps}
        </span>
        {otpMessage && signupStep >= 1 && (
          <span
            className={
              otpStatus === "sent"
                ? "text-emerald-600"
                : otpStatus === "error"
                  ? "text-red-500"
                  : "text-muted-foreground"
            }
          >
            {otpMessage}
          </span>
        )}
      </div>

      {signupStep === 1 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="signup-phone">{t.phone}</Label>
            <Input
              id="signup-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              {...signupForm.register("phone")}
            />
            {signupForm.formState.errors.phone && (
              <p className="text-red-500 text-sm">
                {signupForm.formState.errors.phone.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="signup-otp">{t.otp}</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={requestOtp}
                disabled={otpStatus === "sending"}
              >
                {otpStatus === "sending" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : otpStatus === "sent" ? (
                  t.resendOtp
                ) : (
                  t.sendOtp
                )}
              </Button>
            </div>
            <Input
              id="signup-otp"
              inputMode="numeric"
              maxLength={6}
              {...signupForm.register("otp")}
            />
            {signupForm.formState.errors.otp && (
              <p className="text-red-500 text-sm">
                {signupForm.formState.errors.otp.message}
              </p>
            )}
          </div>
        </div>
      )}

      {signupStep === 2 && (
        <div className="space-y-5">
          <div className="space-y-1">
            <Label htmlFor="signup-name">{t.name}</Label>
            <Input id="signup-name" {...signupForm.register("name")} />
            {signupForm.formState.errors.name && (
              <p className="text-red-500 text-sm">
                {signupForm.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="signup-pin">{t.pin}</Label>
              <Input
                id="signup-pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoComplete="new-password"
                {...signupForm.register("pin")}
              />
              <p className="text-xs text-muted-foreground">{t.pinHelper}</p>
              {signupForm.formState.errors.pin && (
                <p className="text-red-500 text-sm">
                  {signupForm.formState.errors.pin.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="signup-pin-confirm">{t.confirmPin}</Label>
              <Input
                id="signup-pin-confirm"
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoComplete="new-password"
                {...signupForm.register("confirmPin")}
              />
              {signupForm.formState.errors.confirmPin && (
                <p className="text-red-500 text-sm">
                  {signupForm.formState.errors.confirmPin.message}
                </p>
              )}
            </div>
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
                        ? t.roleCustomerCopy
                        : role === "provider"
                          ? t.roleProviderCopy
                          : t.roleShopCopy}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{t.profileLater}</p>
            {signupForm.formState.errors.role && (
              <p className="text-red-500 text-sm">
                {signupForm.formState.errors.role.message}
              </p>
            )}
          </div>

          {watchedRole === "shop" && (
            <div className="space-y-1">
              <Label htmlFor="shop-name">{t.shop}</Label>
              <Input
                id="shop-name"
                placeholder={t.shopNamePlaceholder}
                {...signupForm.register("shopName")}
              />
              <p className="text-xs text-muted-foreground">
                {t.shopNameAutoFill}
              </p>
              {signupForm.formState.errors.shopName && (
                <p className="text-red-500 text-sm">
                  {signupForm.formState.errors.shopName.message}
                </p>
              )}
            </div>
          )}

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

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={handleSignupBack}
          disabled={signupStep === 1 || registerMutation.isPending}
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
