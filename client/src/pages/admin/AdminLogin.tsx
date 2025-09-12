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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-center">Admin Login</CardTitle>
          <CardDescription className="text-center">
            Sign in to manage the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="admin@example.com" {...form.register("email")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" {...form.register("password")} />
            </div>
            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Signing in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
