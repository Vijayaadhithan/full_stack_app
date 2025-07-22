import React from 'react';
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient"; // Added import

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const translations = {
  en: {
    welcome: "Welcome to Service & Shop Platform",
    login: "Login",
    register: "Register",
    username: "Username",
    password: "Password",
    forgotPassword: "Forgot Password?", // Added
    requestPasswordReset: "Request Password Reset", // Added
    sendResetLink: "Send Reset Link", // Added
    resetLinkSent:
      "If an account with that email exists, a password reset link has been sent.", // Added
    backToLogin: "Back to Login", // Added
    role: "Role",
    name: "Full Name",
    phone: "Phone",
    email: "Email",
    customer: "Customer",
    provider: "Service Provider",
    shop: "Shop Owner",
    admin: "Admin",
    language: "Language",
  },
  hi: {
    welcome: "सेवा और दुकान प्लेटफॉर्म में आपका स्वागत है",
    login: "लॉग इन",
    register: "पंजीकरण",
    username: "उपयोगकर्ता नाम",
    password: "पासवर्ड",
    forgotPassword: "पासवर्ड भूल गए?", // Added
    requestPasswordReset: "पासवर्ड रीसेट का अनुरोध करें", // Added
    sendResetLink: "रीसेट लिंक भेजें", // Added
    resetLinkSent:
      "यदि उस ईमेल वाला कोई खाता मौजूद है, तो एक पासवर्ड रीसेट लिंक भेजा गया है।", // Added
    backToLogin: "लॉगिन पर वापस जाएं", // Added
    role: "भूमिका",
    name: "पूरा नाम",
    phone: "फ़ोन",
    email: "ईमेल",
    customer: "ग्राहक",
    provider: "सेवा प्रदाता",
    shop: "दुकान मालिक",
    admin: "प्रशासक",
    language: "भाषा",
  },
  ta: {
    welcome: "சேவை மற்றும் கடை தளத்திற்கு வரவேற்கிறோம்",
    login: "உள்நுழைய",
    register: "பதிவு செய்ய",
    username: "பயனர்பெயர்",
    password: "கடவுச்சொல்",
    forgotPassword: "கடவுச்சொல்லை மறந்துவிட்டீர்களா?", // Added
    requestPasswordReset: "கடவுச்சொல் மீட்டமைப்பைக் கோருக", // Added
    sendResetLink: "மீட்டமைப்பு இணைப்பை அனுப்பு", // Added
    resetLinkSent:
      "அந்த மின்னஞ்சலுடன் ஒரு கணக்கு இருந்தால், கடவுச்சொல் மீட்டமைப்பு இணைப்பு அனுப்பப்பட்டுள்ளது.", // Added
    backToLogin: "உள்நுழைவுக்குத் திரும்பு", // Added
    role: "பாத்திரம்",
    name: "முழு பெயர்",
    phone: "தொலைபேசி",
    email: "மின்னஞ்சல்",
    customer: "வாடிக்கையாளர்",
    provider: "சேवை வழங்குநர்",
    shop: "கடை உரிமையாளர்",
    admin: "நிர்வாகி",
    language: "மொழி",
  },
};

// Schemas
const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const forgotPasswordSchema = z.object({
  // Added
  email: z.string().email("Valid email is required"), // Added
}); // Added

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["customer", "provider", "shop", "admin"]),
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  email: z.string().email("Valid email is required"),
});

// Types
type LoginData = z.infer<typeof loginSchema>;
type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>; // Added
type RegisterData = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const {
    loginMutation,
    registerMutation,
    user,
    isFetching: authIsFetching,
  } = useAuth(); // Destructure isFetching
  const [, setLocation] = useLocation();
  const [language, setLanguage] = useState<keyof typeof translations>("en");
  const [showForgotPassword, setShowForgotPassword] = useState(false); // Added
  const [resetMessage, setResetMessage] = useState<string | null>(null); // Added
  const t = translations[language];

  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
  });

  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
  });

  const forgotPasswordForm = useForm<ForgotPasswordData>({
    // Added
    resolver: zodResolver(forgotPasswordSchema), // Added
  }); // Added

  useEffect(() => {
    // When the auth page mounts, invalidate the user query to ensure fresh auth state.
    // This helps when navigating back from an external OAuth flow, e.g. Google Sign-In.
    // The useAuth hook now handles refetchOnWindowFocus, so explicit invalidation here might be redundant
    // but kept for safety unless confirmed otherwise.
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
  }, []); // Run once on mount

  useEffect(() => {
    // Redirect if:
    // 1. Auth status is NOT being fetched (authIsFetching is false).
    // 2. User object exists (user is authenticated).
    // 3. No login or register mutation is currently pending.
    if (
      !authIsFetching &&
      user &&
      !loginMutation.isPending &&
      !registerMutation.isPending
    ) {
      setLocation(`/${user.role}`);
    }
    // Dependencies: user state, auth fetching state, and mutation pending states.
  }, [
    user,
    authIsFetching,
    loginMutation.isPending,
    registerMutation.isPending,
    setLocation,
  ]);

  const handleRequestPasswordReset = async (data: ForgotPasswordData) => {
    // Added
    setResetMessage(null); // Added
    try {
      // Added
      const response = await apiRequest(
        "POST",
        "/api/request-password-reset",
        data,
      );
      const result = await response.json(); // Added
      if (response.ok) {
        // Added
        setResetMessage(t.resetLinkSent); // Added
        forgotPasswordForm.reset(); // Added
      } else {
        // Added
        setResetMessage(result.message || "An error occurred."); // Added
      } // Added
    } catch (error) {
      // Added
      setResetMessage("An error occurred while requesting password reset."); // Added
      console.error("Password reset request error:", error); // Added
    } // Added
  }; // Added

  if (showForgotPassword) {
    // Added
    return (
      // Added
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        {" "}
        {/* Added */}
        <Card className="w-full max-w-lg">
          {" "}
          {/* Added */}
          <CardHeader>
            {" "}
            {/* Added */}
            <CardTitle className="text-2xl text-center">
              {t.requestPasswordReset}
            </CardTitle>{" "}
            {/* Added */}
          </CardHeader>{" "}
          {/* Added */}
          <CardContent>
            {" "}
            {/* Added */}
            <form
              onSubmit={forgotPasswordForm.handleSubmit(
                handleRequestPasswordReset,
              )}
              className="space-y-4"
            >
              {" "}
              {/* Added */}
              <div className="space-y-1">
                {" "}
                {/* Added */}
                <Label htmlFor="email-forgot">{t.email}</Label> {/* Added */}
                <Input
                  id="email-forgot"
                  type="email"
                  {...forgotPasswordForm.register("email")}
                />{" "}
                {/* Added */}
                {forgotPasswordForm.formState.errors.email /* Added */ && (
                  <p className="text-red-500 text-sm">
                    {forgotPasswordForm.formState.errors.email.message}
                  </p> /* Added */
                )}{" "}
                {/* Added */}
              </div>{" "}
              {/* Added */}
              {resetMessage && (
                <p
                  className={`text-sm ${resetMessage === t.resetLinkSent ? "text-green-600" : "text-red-500"}`}
                >
                  {resetMessage}
                </p>
              )}{" "}
              {/* Added */}
              <Button
                type="submit"
                className="w-full"
                disabled={forgotPasswordForm.formState.isSubmitting}
              >
                {" "}
                {/* Added */}
                {forgotPasswordForm.formState.isSubmitting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  t.sendResetLink
                )}{" "}
                {/* Added */}
              </Button>{" "}
              {/* Added */}
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetMessage(null);
                }}
                className="w-full"
              >
                {" "}
                {/* Added */}
                {t.backToLogin} {/* Added */}
              </Button>{" "}
              {/* Added */}
            </form>{" "}
            {/* Added */}
          </CardContent>{" "}
          {/* Added */}
        </Card>{" "}
        {/* Added */}
      </div> // Added
    ); // Added
  } // Added

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
          <CardTitle className="text-2xl text-center">{t.welcome}</CardTitle>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{t.login}</TabsTrigger>
              <TabsTrigger value="register">{t.register}</TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login">
              <form
                onSubmit={loginForm.handleSubmit((data) =>
                  loginMutation.mutate(data),
                )}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <Label htmlFor="username">{t.username}</Label>
                  <Input id="username" {...loginForm.register("username")} />
                  {loginForm.formState.errors.username && (
                    <p className="text-red-500 text-sm">
                      {loginForm.formState.errors.username.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="password">{t.password}</Label>
                  <Input
                    id="password"
                    type="password"
                    {...loginForm.register("password")}
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-red-500 text-sm">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <div className="text-right text-sm">
                  {" "}
                  {/* Added */}
                  <Button
                    variant="link"
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="p-0 h-auto"
                  >
                    {" "}
                    {/* Added */}
                    {t.forgotPassword} {/* Added */}
                  </Button>{" "}
                  {/* Added */}
                </div>{" "}
                {/* Added */}
                <Button
                  type="submit"
                  className="w-full mb-4"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    t.login
                  )}
                </Button>
                <div className="relative my-2">
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
                  onClick={() =>
                    (window.location.href = `${API_URL}/auth/google`)
                  }
                >
                  <svg
                    className="mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                  >
                    <path
                      fill="#FFC107"
                      d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
                    />
                    <path
                      fill="#FF3D00"
                      d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
                    />
                    <path
                      fill="#4CAF50"
                      d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
                    />
                    <path
                      fill="#1976D2"
                      d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
                    />
                  </svg>
                  Sign in with Google
                </Button>
              </form>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register">
              <form
                onSubmit={registerForm.handleSubmit((data) =>
                  registerMutation.mutate({
                    ...data,
                    emailVerified: false,
                    averageRating: "0",
                    totalReviews: 0,
                  }),
                )}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <Label htmlFor="role">{t.role}</Label>
                  <select
                    id="role"
                    {...registerForm.register("role")}
                    className="w-full p-2 border rounded"
                  >
                    <option value="customer">{t.customer}</option>
                    <option value="provider">{t.provider}</option>
                    <option value="shop">{t.shop}</option>
                  </select>
                  {registerForm.formState.errors.role && (
                    <p className="text-red-500 text-sm">
                      {registerForm.formState.errors.role.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="username">{t.username}</Label>
                  <Input id="username" {...registerForm.register("username")} />
                  {registerForm.formState.errors.username && (
                    <p className="text-red-500 text-sm">
                      {registerForm.formState.errors.username.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="password">{t.password}</Label>
                  <Input
                    id="password"
                    type="password"
                    {...registerForm.register("password")}
                  />
                  {registerForm.formState.errors.password && (
                    <p className="text-red-500 text-sm">
                      {registerForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="name">{t.name}</Label>
                  <Input id="name" {...registerForm.register("name")} />
                  {registerForm.formState.errors.name && (
                    <p className="text-red-500 text-sm">
                      {registerForm.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="phone">{t.phone}</Label>
                  <Input id="phone" {...registerForm.register("phone")} />
                  {registerForm.formState.errors.phone && (
                    <p className="text-red-500 text-sm">
                      {registerForm.formState.errors.phone.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="email">{t.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    {...registerForm.register("email")}
                  />
                  {registerForm.formState.errors.email && (
                    <p className="text-red-500 text-sm">
                      {registerForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    t.register
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => {
                    const selectedRole =
                      registerForm.getValues("role") || "customer";
                    window.location.href = `${API_URL}/auth/google?role=${selectedRole}`;
                  }}
                >
                  Sign in with Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => {
                    const selectedRole =
                      registerForm.getValues("role") || "customer";
                    window.location.href = `${API_URL}/auth/google?role=${selectedRole}`;
                  }}
                >
                  Sign up with Google
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
