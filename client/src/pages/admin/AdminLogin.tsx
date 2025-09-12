import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  if (admin) {
    setLocation("/admin/dashboard");
    return null;
  }

  function onSubmit(data: FormData) {
    loginMutation.mutate(data, {
      onSuccess: () => setLocation("/admin/dashboard"),
    });
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 w-80"
      >
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...form.register("email")} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            {...form.register("password")}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? "..." : "Login"}
        </Button>
      </form>
    </div>
  );
}
