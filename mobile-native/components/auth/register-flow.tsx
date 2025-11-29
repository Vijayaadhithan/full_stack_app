import React, { useEffect, useMemo, useState } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { InsertUser, ShopProfile } from "@shared/schema";
import { apiRequest, API_BASE_URL } from "../../lib/queryClient";
import { AuthTranslations, SupportedLanguage } from "./translations";
import { useAuth } from "../../hooks/use-auth";
import * as Linking from "expo-linking";
import { cn } from "../../lib/utils";

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "error";
type EmailStatus = "idle" | "checking" | "available" | "taken" | "error";
type SignupStep = 1 | 2 | 3;

type PasswordStrength = {
    score: number;
    label: string;
    tone: "weak" | "medium" | "strong";
};

// Reusing the schema from the web version (simplified for mobile context if needed)
// Note: We need to ensure @shared/schema is available or replicate it. 
// Assuming InsertUser is available via the shared package as configured in tsconfig.

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
    onRegistrationSuccess: () => void;
};

export function RegisterFlow({
    t,
    language,
    onRegistrationSuccess,
}: RegisterFlowProps) {
    const { registerMutation } = useAuth();
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
        <View className="space-y-6">
            <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted-foreground">
                    {t.step} {Math.min(signupStep, totalSteps)} {t.of} {totalSteps}
                </Text>
                {signupEmailFeedback && signupStep >= 2 && (
                    <Text
                        className={cn(
                            "text-sm",
                            emailStatus === "available"
                                ? "text-emerald-600"
                                : emailStatus === "taken"
                                    ? "text-red-500"
                                    : "text-muted-foreground"
                        )}
                    >
                        {signupEmailFeedback}
                    </Text>
                )}
            </View>

            {signupStep === 1 && (
                <View className="space-y-4">
                    <View className="space-y-1">
                        <Label>{t.email}</Label>
                        <Controller
                            control={signupForm.control}
                            name="email"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <Input
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoComplete="email"
                                />
                            )}
                        />
                        {signupForm.formState.errors.email && (
                            <Text className="text-red-500 text-sm">
                                {signupForm.formState.errors.email.message}
                            </Text>
                        )}
                    </View>
                    <View className="space-y-1">
                        <Label>{t.password}</Label>
                        <Controller
                            control={signupForm.control}
                            name="password"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <Input
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                    secureTextEntry
                                    autoCapitalize="none"
                                />
                            )}
                        />
                        {signupForm.formState.errors.password && (
                            <Text className="text-red-500 text-sm">
                                {signupForm.formState.errors.password.message}
                            </Text>
                        )}
                        <View className="space-y-1 mt-2">
                            <Text className="text-xs text-muted-foreground">
                                {t.passwordStrength}: {passwordStrength.label}
                            </Text>
                            <View className="h-2 w-full bg-muted rounded overflow-hidden">
                                <View
                                    className={cn(
                                        "h-2 rounded",
                                        passwordStrengthColor(passwordStrength.tone)
                                    )}
                                    style={{ width: `${Math.min(passwordStrength.score, 100)}%` }}
                                />
                            </View>
                        </View>
                    </View>
                    <View className="space-y-1">
                        <Label>{t.confirmPassword}</Label>
                        <Controller
                            control={signupForm.control}
                            name="confirmPassword"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <Input
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                    secureTextEntry
                                    autoCapitalize="none"
                                />
                            )}
                        />
                        {signupForm.formState.errors.confirmPassword && (
                            <Text className="text-red-500 text-sm">
                                {signupForm.formState.errors.confirmPassword.message}
                            </Text>
                        )}
                    </View>
                </View>
            )}

            {signupStep === 2 && (
                <View className="space-y-6">
                    <View className="space-y-1">
                        <Label>{t.name}</Label>
                        <Controller
                            control={signupForm.control}
                            name="name"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <Input
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                />
                            )}
                        />
                        {signupForm.formState.errors.name && (
                            <Text className="text-red-500 text-sm">
                                {signupForm.formState.errors.name.message}
                            </Text>
                        )}
                    </View>
                    <View className="space-y-1">
                        <Label>{t.username}</Label>
                        <Controller
                            control={signupForm.control}
                            name="username"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <Input
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                    autoCapitalize="none"
                                    placeholder="yourname"
                                />
                            )}
                        />
                        <View className="flex-row mt-1">
                            {usernameStatus === "available" && (
                                <Text className="text-emerald-600 text-xs">{t.usernameAvailable}</Text>
                            )}
                            {usernameStatus === "taken" && (
                                <Text className="text-red-500 text-xs">{t.usernameTaken}</Text>
                            )}
                            {usernameStatus === "error" && (
                                <Text className="text-red-500 text-xs">{t.usernameError}</Text>
                            )}
                        </View>
                        {signupForm.formState.errors.username && (
                            <Text className="text-red-500 text-sm">
                                {signupForm.formState.errors.username.message}
                            </Text>
                        )}
                    </View>
                    <View className="space-y-1">
                        <Label>{t.phone}</Label>
                        <Controller
                            control={signupForm.control}
                            name="phone"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <Input
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                    keyboardType="phone-pad"
                                    autoComplete="tel"
                                />
                            )}
                        />
                        {signupForm.formState.errors.phone && (
                            <Text className="text-red-500 text-sm">
                                {signupForm.formState.errors.phone.message}
                            </Text>
                        )}
                    </View>
                    <View className="space-y-2">
                        <Label>{t.role}</Label>
                        <View className="gap-3">
                            {["customer", "provider", "shop"].map((role) => {
                                const isActive = watchedRole === role;
                                const label =
                                    role === "customer" ? t.customer : role === "provider" ? t.provider : t.shop;
                                return (
                                    <TouchableOpacity
                                        key={role}
                                        onPress={() =>
                                            signupForm.setValue("role", role as SignupFormData["role"], {
                                                shouldValidate: true,
                                            })
                                        }
                                        className={cn(
                                            "rounded-md border p-3",
                                            isActive ? "border-primary bg-primary/5" : "border-border"
                                        )}
                                    >
                                        <Text className="font-medium text-foreground">{label}</Text>
                                        <Text className="text-xs text-muted-foreground mt-1">
                                            {role === "customer"
                                                ? "Book services quickly"
                                                : role === "provider"
                                                    ? "Offer on-demand services"
                                                    : "Manage your storefront"}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        {signupForm.formState.errors.role && (
                            <Text className="text-red-500 text-sm">
                                {signupForm.formState.errors.role.message}
                            </Text>
                        )}
                    </View>
                    <View className="items-center gap-3">
                        <Text className="text-sm text-muted-foreground">{t.continueWithGoogle}</Text>
                        <Button
                            variant="outline"
                            className="w-full"
                            onPress={() => {
                                const role = signupForm.getValues("role") || "customer";
                                Linking.openURL(`${API_BASE_URL}/auth/google?role=${role}`);
                            }}
                        >
                            {t.continueWithGoogle}
                        </Button>
                    </View>
                </View>
            )}

            {signupStep === 3 && watchedRole === "provider" && (
                <View className="space-y-4">
                    <Text className="text-lg font-semibold text-foreground">{t.providerDetailsTitle}</Text>
                    <View className="space-y-1">
                        <Label>Bio</Label>
                        <Controller
                            control={signupForm.control}
                            name="providerBio"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <Textarea
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                    placeholder={t.providerBioPlaceholder}
                                />
                            )}
                        />
                        {signupForm.formState.errors.providerBio && (
                            <Text className="text-red-500 text-sm">
                                {signupForm.formState.errors.providerBio.message}
                            </Text>
                        )}
                    </View>
                    <View className="space-y-1">
                        <Label>{t.providerExperiencePlaceholder}</Label>
                        <Controller
                            control={signupForm.control}
                            name="providerExperience"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <Input
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                    placeholder="5"
                                />
                            )}
                        />
                        {signupForm.formState.errors.providerExperience && (
                            <Text className="text-red-500 text-sm">
                                {signupForm.formState.errors.providerExperience.message}
                            </Text>
                        )}
                    </View>
                    <View className="space-y-1">
                        <Label>{t.providerLanguagesPlaceholder}</Label>
                        <Controller
                            control={signupForm.control}
                            name="providerLanguages"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <Input
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                    placeholder="English, Tamil"
                                />
                            )}
                        />
                        {signupForm.formState.errors.providerLanguages && (
                            <Text className="text-red-500 text-sm">
                                {signupForm.formState.errors.providerLanguages.message}
                            </Text>
                        )}
                    </View>
                </View>
            )}

            {signupStep === 3 && watchedRole === "shop" && (
                <View className="space-y-4">
                    <Text className="text-lg font-semibold text-foreground">{t.shopDetailsTitle}</Text>
                    <View className="space-y-1">
                        <Label>{t.shop}</Label>
                        <Controller
                            control={signupForm.control}
                            name="shopName"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <Input
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                    placeholder={t.shopNamePlaceholder}
                                />
                            )}
                        />
                        {signupForm.formState.errors.shopName && (
                            <Text className="text-red-500 text-sm">
                                {signupForm.formState.errors.shopName.message}
                            </Text>
                        )}
                    </View>
                    <View className="space-y-1">
                        <Label>{t.shopBusinessTypePlaceholder}</Label>
                        <Controller
                            control={signupForm.control}
                            name="shopBusinessType"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <Input
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                    placeholder="Salon"
                                />
                            )}
                        />
                        {signupForm.formState.errors.shopBusinessType && (
                            <Text className="text-red-500 text-sm">
                                {signupForm.formState.errors.shopBusinessType.message}
                            </Text>
                        )}
                    </View>
                    <View className="space-y-1">
                        <Label>{t.shopDescriptionPlaceholder}</Label>
                        <Controller
                            control={signupForm.control}
                            name="shopDescription"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <Textarea
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                />
                            )}
                        />
                        {signupForm.formState.errors.shopDescription && (
                            <Text className="text-red-500 text-sm">
                                {signupForm.formState.errors.shopDescription.message}
                            </Text>
                        )}
                    </View>
                </View>
            )}

            <View className="flex-row justify-between gap-4">
                <Button
                    variant="ghost"
                    onPress={handleSignupBack}
                    disabled={signupStep === 1}
                    className="flex-1"
                >
                    {t.back}
                </Button>
                <Button
                    onPress={handleSignupSubmit}
                    disabled={registerMutation.isPending}
                    className="flex-1"
                >
                    {registerMutation.isPending ? "Loading..." : signupStep === totalSteps ? t.finish : t.next}
                </Button>
            </View>
        </View>
    );
}
