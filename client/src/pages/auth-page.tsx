import React from 'react';
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { InsertUser, ShopProfile } from "@shared/schema";

type Translations = (typeof translations)[keyof typeof translations];

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "error";
type EmailStatus = "idle" | "checking" | "available" | "taken" | "error";

type PasswordStrength = {
  score: number;
  label: string;
  tone: "weak" | "medium" | "strong";
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const translations = {
  en: {
    welcome: "Welcome to DoorStepTN",
    welcomeBack: "Welcome back",
    login: "Login",
    register: "Register",
    continue: "Continue",
    next: "Next",
    back: "Back",
    finish: "Finish",
    username: "Username",
    password: "Password",
    confirmPassword: "Confirm Password",
    passwordPrompt: "Enter your password or request a magic link.",
    emailPrompt: "Enter your email to get started.",
    sendMagicLink: "Send Magic Link",
    magicLinkSent:
      "Check your inbox for a magic link. It expires in 15 minutes.",
    magicLinkError:
      "We couldn't send the magic link. Please try again in a moment.",
    magicLinkEmailRequired: "Enter a valid email to receive a magic link.",
    useDifferentEmail: "Use a different email",
    suspendedMessage:
      "This account is suspended. Please contact support or try a different email.",
    forgotPassword: "Forgot Password?",
    requestPasswordReset: "Request Password Reset",
    sendResetLink: "Send Reset Link",
    resetLinkSent:
      "If an account with that email exists, a password reset link has been sent.",
    backToLogin: "Back to Login",
    createAccountPrompt:
      "We didn't find an account for this email. Let's create one.",
    emailInUse:
      "An account already exists for this email. Please log in instead.",
    emailAvailable: "Great! We'll use this email for your new account.",
    usernameAvailable: "This username is available!",
    usernameTaken: "That username is already taken.",
    usernameError: "We couldn't verify the username. Try again later.",
    emailError: "We couldn't verify the email right now.",
    identifierLabel: "Username / Email / Mobile",
    role: "Role",
    name: "Full Name",
    phone: "Phone",
    email: "Email",
    customer: "Customer",
    provider: "Service Provider",
    shop: "Shop Owner",
    language: "Language",
    passwordStrength: "Password strength",
    passwordWeak: "Weak",
    passwordMedium: "Medium",
    passwordStrong: "Strong",
    step: "Step",
    of: "of",
    continueWithGoogle: "Continue with Google",
    providerDetailsTitle: "Tell us about your services",
    providerBioPlaceholder: "Short introduction (min. 20 characters)",
    providerExperiencePlaceholder: "Years of experience",
    providerLanguagesPlaceholder: "Languages you speak (comma separated)",
    shopDetailsTitle: "Tell us about your shop",
    shopNamePlaceholder: "Shop name",
    shopBusinessTypePlaceholder: "Business type (e.g., salon, grocery)",
    shopDescriptionPlaceholder: "Brief description of what you offer",
  },
  hi: {
    welcome: "सेवा और दुकान प्लेटफॉर्म में आपका स्वागत है",
    welcomeBack: "वापसी पर स्वागत है",
    login: "लॉग इन",
    register: "पंजीकरण",
    continue: "जारी रखें",
    next: "आगे",
    back: "पीछे",
    finish: "पूरा करें",
    username: "उपयोगकर्ता नाम",
    password: "पासवर्ड",
    confirmPassword: "पासवर्ड की पुष्टि करें",
    passwordPrompt: "अपना पासवर्ड दर्ज करें या मैजिक लिंक का अनुरोध करें।",
    emailPrompt: "शुरू करने के लिए अपना ईमेल दर्ज करें।",
    sendMagicLink: "मैजिक लिंक भेजें",
    magicLinkSent:
      "अपने इनबॉक्स में मैजिक लिंक देखें। यह 15 मिनट में समाप्त हो जाता है।",
    magicLinkError:
      "हम मैजिक लिंक नहीं भेज सके। कृपया बाद में पुनः प्रयास करें।",
    magicLinkEmailRequired: "मैजिक लिंक प्राप्त करने के लिए मान्य ईमेल दर्ज करें।",
    useDifferentEmail: "किसी अन्य ईमेल का उपयोग करें",
    suspendedMessage:
      "यह खाता निलंबित है। कृपया सहायता से संपर्क करें या किसी अन्य ईमेल का प्रयास करें।",
    forgotPassword: "पासवर्ड भूल गए?",
    requestPasswordReset: "पासवर्ड रीसेट का अनुरोध करें",
    sendResetLink: "रीसेट लिंक भेजें",
    resetLinkSent:
      "यदि उस ईमेल वाला कोई खाता मौजूद है, तो एक पासवर्ड रीसेट लिंक भेजा गया है।",
    backToLogin: "लॉगिन पर वापस जाएं",
    createAccountPrompt:
      "हमें इस ईमेल के लिए कोई खाता नहीं मिला। आइए एक नया बनाएं।",
    emailInUse:
      "इस ईमेल के लिए पहले से खाता मौजूद है। कृपया लॉग इन करें।",
    emailAvailable: "बहुत बढ़िया! हम इस ईमेल का उपयोग करेंगे।",
    usernameAvailable: "यह उपयोगकर्ता नाम उपलब्ध है!",
    usernameTaken: "यह उपयोगकर्ता नाम पहले से लिया जा चुका है।",
    usernameError: "हम अभी उपयोगकर्ता नाम की जांच नहीं कर पाए।",
    emailError: "हम अभी ईमेल को सत्यापित नहीं कर पाए।",
    identifierLabel: "उपयोगकर्ता नाम / ईमेल / मोबाइल",
    role: "भूमिका",
    name: "पूरा नाम",
    phone: "फ़ोन",
    email: "ईमेल",
    customer: "ग्राहक",
    provider: "सेवा प्रदाता",
    shop: "दुकान मालिक",
    language: "भाषा",
    passwordStrength: "पासवर्ड की मजबूती",
    passwordWeak: "कमज़ोर",
    passwordMedium: "मध्यम",
    passwordStrong: "मजबूत",
    step: "चरण",
    of: "में से",
    continueWithGoogle: "Google के साथ जारी करें",
    providerDetailsTitle: "अपनी सेवाओं के बारे में बताएं",
    providerBioPlaceholder: "संक्षिप्त परिचय (कम से कम 20 वर्ण)",
    providerExperiencePlaceholder: "अनुभव के वर्ष",
    providerLanguagesPlaceholder: "आप किन भाषाओं में बात करते हैं (अल्पविराम से अलग)",
    shopDetailsTitle: "अपनी दुकान के बारे में बताएं",
    shopNamePlaceholder: "दुकान का नाम",
    shopBusinessTypePlaceholder: "व्यवसाय का प्रकार (जैसे, सैलून, किराना)",
    shopDescriptionPlaceholder: "आप क्या प्रदान करते हैं इसका संक्षिप्त विवरण",
  },
  ta: {
    welcome: "சேவை மற்றும் கடை தளத்திற்கு வரவேற்கிறோம்",
    welcomeBack: "மீண்டும் வருக",
    login: "உள்நுழைய",
    register: "பதிவு செய்ய",
    continue: "தொடரவும்",
    next: "அடுத்து",
    back: "முன்",
    finish: "முடிக்க",
    username: "பயனர்பெயர்",
    password: "கடவுச்சொல்",
    confirmPassword: "கடவுச்சொல்லை உறுதிப்படுத்து",
    passwordPrompt:
      "உங்கள் கடவுச்சொல்லை உள்ளிடுங்கள் அல்லது மாய இணைப்பை கோருங்கள்.",
    emailPrompt: "தொடங்க உங்கள் மின்னஞ்சலை உள்ளிடவும்.",
    sendMagicLink: "மாய இணைப்பை அனுப்பவும்",
    magicLinkSent:
      "உங்கள் இடைபெட்டியில் மாய இணைப்பைச் சரிபார்க்கவும். அது 15 நிமிடங்களில் காலாவதியாகும்.",
    magicLinkError:
      "மாய இணைப்பை அனுப்ப முடியவில்லை. தயவுசெய்து பின்னர் முயற்சிக்கவும்.",
    magicLinkEmailRequired: "மாய இணைப்பைப் பெற செல்லுபடியாகும் மின்னஞ்சலை உள்ளிடவும்.",
    useDifferentEmail: "வேறு மின்னஞ்சலை பயன்படுத்தவும்",
    suspendedMessage:
      "இந்த கணக்கு இடைநிறுத்தப்பட்டுள்ளது. உதவியை தொடர்பு கொள்ளுங்கள் அல்லது வேறு மின்னஞ்சலை முயற்சிக்கவும்.",
    forgotPassword: "கடவுச்சொல்லை மறந்துவிட்டீர்களா?",
    requestPasswordReset: "கடவுச்சொல் மீட்டமைப்பைக் கோருக",
    sendResetLink: "மீட்டமைப்பு இணைப்பை அனுப்பு",
    resetLinkSent:
      "அந்த மின்னஞ்சலுடன் ஒரு கணக்கு இருந்தால், கடவுச்சொல் மீட்டமைப்பு இணைப்பு அனுப்பப்பட்டுள்ளது.",
    backToLogin: "உள்நுழைவுக்குத் திரும்பு",
    createAccountPrompt:
      "இந்த மின்னஞ்சலுக்கான கணக்கை எங்களால் கண்டுபிடிக்க முடியவில்லை. புதிய ஒன்றை உருவாக்குவோம்.",
    emailInUse: "இந்த மின்னஞ்சலிற்கான கணக்கு ஏற்கனவே உள்ளது. தயவுசெய்து உள்நுழையுங்கள்.",
    emailAvailable: "அற்புதம்! இந்த மின்னஞ்சலைப் பயன்படுத்துவோம்.",
    usernameAvailable: "இந்த பயனர்பெயர் கிடைக்கிறது!",
    usernameTaken: "இந்த பயனர்பெயர் ஏற்கனவே பயன்படுத்தப்படுகிறது.",
    usernameError: "பயனர்பெயரை இப்போது சரிபார்க்க முடியவில்லை.",
    emailError: "மின்னஞ்சலை இப்போது சரிபார்க்க முடியவில்லை.",
    identifierLabel: "பயனர்பெயர் / மின்னஞ்சல் / மொபைல்",
    role: "பாத்திரம்",
    name: "முழு பெயர்",
    phone: "தொலைபேசி",
    email: "மின்னஞ்சல்",
    customer: "வாடிக்கையாளர்",
    provider: "சேவை வழங்குநர்",
    shop: "கடை உரிமையாளர்",
    language: "மொழி",
    passwordStrength: "கடவுச்சொல் வலிமை",
    passwordWeak: "பலவீனமானது",
    passwordMedium: "மிதமானது",
    passwordStrong: "வலிமையானது",
    step: "படி",
    of: "மொத்த",
    continueWithGoogle: "Google மூலம் தொடரவும்",
    providerDetailsTitle: "உங்கள் சேவைகள் பற்றி சொல்லுங்கள்",
    providerBioPlaceholder: "குறுகிய அறிமுகம் (குறைந்தது 20 எழுத்துகள்)",
    providerExperiencePlaceholder: "அனுபவம் (ஆண்டுகளில்)",
    providerLanguagesPlaceholder:
      "நீங்கள் பேசும் மொழிகள் (கமாவால் பிரித்து)",
    shopDetailsTitle: "உங்கள் கடையை பற்றி சொல்லுங்கள்",
    shopNamePlaceholder: "கடை பெயர்",
    shopBusinessTypePlaceholder: "வியாபார வகை (உதா., அழகுசாதன, மளிகை)",
    shopDescriptionPlaceholder: "நீங்கள் வழங்குவது குறித்து சுருக்கமாக",
  },
} satisfies Record<string, Record<string, string>>;

const loginSchema = z.object({
  identifier: z.string().min(1, "Required"),
  password: z.string().min(1, "Required"),
});

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

const forgotPasswordSchema = z.object({
  email: z.string().email("Valid email is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;
type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;

type SignupStep = 1 | 2 | 3;

function isValidEmail(value: string) {
  return /.+@.+\..+/.test(value.trim());
}

function calculatePasswordStrength(
  password: string,
  t: Translations,
): PasswordStrength {
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

export default function AuthPage() {
  const {
    loginMutation,
    registerMutation,
    user,
    isFetching: authIsFetching,
  } = useAuth();
  const [, setLocation] = useLocation();
  const [language, setLanguage] = useState<keyof typeof translations>("en");
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [signupStep, setSignupStep] = useState<SignupStep>(1);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [magicLinkMessage, setMagicLinkMessage] = useState<string | null>(null);
  const [magicLinkError, setMagicLinkError] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [signupEmailFeedback, setSignupEmailFeedback] = useState<string | null>(
    null,
  );
  const t: Translations = translations[language];

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

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

  const forgotPasswordForm = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const watchedRole = useWatch({ control: signupForm.control, name: "role" });
  const watchedPassword = useWatch({
    control: signupForm.control,
    name: "password",
  });
  const watchedUsername = useWatch({
    control: signupForm.control,
    name: "username",
  });

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
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
  }, []);

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

  useEffect(() => {
    if (showForgotPassword) {
      const currentIdentifier = loginForm.getValues("identifier") ?? "";
      forgotPasswordForm.reset({
        email: isValidEmail(currentIdentifier) ? currentIdentifier : "",
      });
    }
  }, [showForgotPassword, forgotPasswordForm, loginForm]);

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
      setActiveTab("login");
    }
  }, [registerMutation.isSuccess, signupForm]);

  const totalSteps = watchedRole === "customer" ? 2 : 3;

  const stepFieldMap: Record<SignupStep, (keyof SignupFormData)[]> = {
    1: ["email", "password", "confirmPassword"],
    2: ["name", "username", "phone", "role"],
    3:
      watchedRole === "provider"
        ? ["providerBio", "providerExperience", "providerLanguages"]
        : ["shopName", "shopBusinessType", "shopDescription"],
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
        return (Math.min(2, totalSteps) as SignupStep);
      }
      if (prev === 2) {
        return (Math.min(3, totalSteps) as SignupStep);
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
    loginMutation.mutate({ username: data.identifier.trim(), password: data.password });
  });

  const handleSignupSubmit = async () => {
    if (signupStep < totalSteps) {
      await handleSignupNext();
    } else {
      await handleSignupComplete();
    }
  };

  const handleRequestPasswordReset = async (data: ForgotPasswordData) => {
    setResetMessage(null);
    try {
      const response = await apiRequest(
        "POST",
        "/api/request-password-reset",
        data,
      );
      await response.json();
      setResetMessage(t.resetLinkSent);
      forgotPasswordForm.reset({ email: data.email });
    } catch (error) {
      setResetMessage(t.emailError);
      console.error("Password reset request error:", error);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="space-y-4">
            <div className="flex justify-end">
              <Select
                value={language}
                onValueChange={(val) =>
                  setLanguage(val as keyof typeof translations)
                }
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
            <CardTitle className="text-2xl text-center">
              {t.requestPasswordReset}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={forgotPasswordForm.handleSubmit(
                handleRequestPasswordReset,
              )}
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
                  className={`text-sm ${resetMessage === t.resetLinkSent ? "text-green-600" : "text-red-500"}`}
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
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetMessage(null);
                }}
                className="w-full"
              >
                {t.backToLogin}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader className="space-y-4">
          <div className="flex justify-end">
            <Select
              value={language}
              onValueChange={(val) =>
                setLanguage(val as keyof typeof translations)
              }
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
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "login" | "register")}>
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
                    onClick={() => setShowForgotPassword(true)}
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
                  onClick={() => (window.location.href = `${API_URL}/auth/google`)}
                >
                  {t.continueWithGoogle}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="pt-6">
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
                            role === "customer"
                              ? t.customer
                              : role === "provider"
                                ? t.provider
                                : t.shop;
                          return (
                            <button
                              key={role}
                              type="button"
                              onClick={() => signupForm.setValue("role", role as SignupFormData["role"], { shouldValidate: true })}
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
                      <span className="text-sm text-muted-foreground">
                        {t.continueWithGoogle}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const role = signupForm.getValues("role") || "customer";
                          window.location.href = `${API_URL}/auth/google?role=${role}`;
                        }}
                      >
                        {t.continueWithGoogle}
                      </Button>
                    </div>
                  </div>
                )}

                {signupStep === 3 && watchedRole === "provider" && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">
                      {t.providerDetailsTitle}
                    </h3>
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
