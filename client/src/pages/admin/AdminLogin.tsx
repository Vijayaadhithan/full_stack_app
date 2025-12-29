import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAdmin } from "@/hooks/use-admin";
import { useLocation } from "wouter";
import LogoMark from "@/components/branding/logo-mark";
import { Shield, Loader2 } from "lucide-react";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

export default function AdminLogin() {
  const { loginMutation, admin } = useAdmin();
  const [, setLocation] = useLocation();
  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  // Redirect if already logged in
  useEffect(() => {
    if (admin) setLocation("/admin/dashboard");
  }, [admin, setLocation]);

  function onSubmit(data: FormData) {
    loginMutation.mutate(data, {
      onSuccess: (resp) => {
        if (resp?.mustChangePassword) {
          setLocation("/admin/change-password");
        } else {
          setLocation("/admin/dashboard");
        }
      },
    });
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* Dark gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />

      {/* Animated orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-orange-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      {/* Glass Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-3xl blur-lg opacity-20 animate-pulse" />

        <Card className="relative bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />

          <CardHeader className="relative text-center pb-6">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="absolute -inset-3 bg-orange-500/30 rounded-full blur-xl" />
                <LogoMark size={64} className="relative" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-orange-300 via-amber-200 to-orange-300 bg-clip-text text-transparent flex items-center justify-center gap-2">
              <Shield className="w-6 h-6 text-orange-400" />
              DoorStep Admin
            </CardTitle>
            <CardDescription className="text-white/50">
              Sign in to manage the platform
            </CardDescription>
          </CardHeader>

          <CardContent className="relative">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/80 text-sm font-medium">Email</Label>
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl opacity-0 group-focus-within:opacity-100 blur transition-opacity" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    {...form.register("email")}
                    className="relative h-12 text-white placeholder:text-white/30 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/80 text-sm font-medium">Password</Label>
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl opacity-0 group-focus-within:opacity-100 blur transition-opacity" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    {...form.register("password")}
                    className="relative h-12 text-white placeholder:text-white/30 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl shadow-lg shadow-orange-500/30 transition-all duration-300 hover:shadow-orange-500/50 hover:-translate-y-0.5"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  "Login"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
