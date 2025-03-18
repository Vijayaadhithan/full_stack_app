import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

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
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            Welcome to Service & Shop Platform
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form
                onSubmit={loginForm.handleSubmit((data) =>
                  loginMutation.mutate(data)
                )}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input {...loginForm.register("username")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
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
                    "Login"
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
                  <Label htmlFor="role">Role</Label>
                  <select
                    {...registerForm.register("role")}
                    className="w-full p-2 border rounded"
                  >
                    <option value="customer">Customer</option>
                    <option value="provider">Service Provider</option>
                    <option value="shop">Shop Owner</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input {...registerForm.register("username")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    type="password"
                    {...registerForm.register("password")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input {...registerForm.register("name")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input {...registerForm.register("phone")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
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
                    "Register"
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
