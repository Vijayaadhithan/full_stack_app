import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const translations = {
  en: {
    welcome: "Welcome to Service & Shop Platform",
    login: "Login",
    register: "Register",
    username: "Username",
    password: "Password",
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
    role: "பாத்திரம்",
    name: "முழு பெயர்",
    phone: "தொலைபேசி",
    email: "மின்னஞ்சல்",
    customer: "வாடிக்கையாளர்",
    provider: "சேवை வழங்குநர்",
    shop: "கடை உரிமையாளர்",
    admin: "நிர்வாகி",
    language: "மொழி",
  }
};

// Schemas
const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

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
type RegisterData = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const { loginMutation, registerMutation, user } = useAuth();
  const [, setLocation] = useLocation();
  const [language, setLanguage] = useState<keyof typeof translations>("en");
  const t = translations[language];

  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
  });

  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
  });

  useEffect(() => {
    if (user) {
      setLocation(`/${user.role}`);
    }
  }, [user, setLocation]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-4">
          <div className="flex justify-end">
            <Select value={language} onValueChange={(val) => setLanguage(val as keyof typeof translations)}>
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
                  loginMutation.mutate(data)
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
              </form>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register">
              <form
                onSubmit={registerForm.handleSubmit((data) =>
                  registerMutation.mutate(data)
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
                    <option value="admin">{t.admin}</option>
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
                  <Input id="email" type="email" {...registerForm.register("email")} />
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
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}