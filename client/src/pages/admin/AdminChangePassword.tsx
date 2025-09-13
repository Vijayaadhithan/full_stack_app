import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAdmin } from "@/hooks/use-admin";

const schema = z.object({
  currentPassword: z.string().min(1, "Current password required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof schema>;

export default function AdminChangePassword() {
  const { admin } = useAdmin();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    try {
      await apiRequest("POST", "/api/admin/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      // Update admin context to clear mustChangePassword flag
      queryClient.setQueryData(["/api/admin/me"], (prev: any) =>
        prev ? { ...prev, mustChangePassword: false } : prev,
      );
      toast({ title: "Password changed" });
      setLocation("/admin/dashboard");
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to change password", variant: "destructive" });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-center">Change Password</CardTitle>
          <CardDescription className="text-center">
            {admin?.mustChangePassword ? "Please set a new password to continue" : "Update your admin password"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input id="currentPassword" type="password" {...form.register("currentPassword")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input id="newPassword" type="password" {...form.register("newPassword")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input id="confirmPassword" type="password" {...form.register("confirmPassword")} />
              {form.formState.errors.confirmPassword && (
                <p className="text-sm text-red-600">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full">Save Password</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
