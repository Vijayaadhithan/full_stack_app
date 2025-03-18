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
    provider: "சேவை வழங்குநர்",
    shop: "கடை உரிமையாளர்",
    language: "மொழி",
  }
};

const authSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["customer", "provider", "shop", "admin"]),
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export default function AuthPage() {
  const { loginMutation, registerMutation, user } = useAuth();
  const [, setLocation] = useLocation();
  const [language, setLanguage] = useState("en");
  const t = translations[language as keyof typeof translations];

  const loginForm = useForm({
    resolver: zodResolver(authSchema.pick({ username: true, password: true })),
  });

  const registerForm = useForm({
    resolver: zodResolver(authSchema),
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
            <Select value={language} onValueChange={setLanguage}>
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
          <CardTitle className="text-2xl text-center">
            {t.welcome}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{t.login}</TabsTrigger>
              <TabsTrigger value="register">{t.register}</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form
                onSubmit={loginForm.handleSubmit((data) =>
                  loginMutation.mutate(data)
                )}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="username">{t.username}</Label>
                  <Input {...loginForm.register("username")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t.password}</Label>
                  <Input
                    type="password"
                    {...loginForm.register("password")}
                  />
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

            <TabsContent value="register">
              <form
                onSubmit={registerForm.handleSubmit((data) =>
                  registerMutation.mutate(data)
                )}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="role">{t.role}</Label>
                  <select
                    {...registerForm.register("role")}
                    className="w-full p-2 border rounded"
                  >
                    <option value="customer">{t.customer}</option>
                    <option value="provider">{t.provider}</option>
                    <option value="shop">{t.shop}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">{t.username}</Label>
                  <Input {...registerForm.register("username")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t.password}</Label>
                  <Input
                    type="password"
                    {...registerForm.register("password")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">{t.name}</Label>
                  <Input {...registerForm.register("name")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t.phone}</Label>
                  <Input {...registerForm.register("phone")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t.email}</Label>
                  <Input type="email" {...registerForm.register("email")} />
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