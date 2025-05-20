import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard, Phone, Mail, MapPin, Upload, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"; // Added for delete confirmation

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(10, "Invalid phone number"),
  email: z.string().email("Invalid email"),
  addressStreet: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressPostalCode: z.string().optional(),
  addressCountry: z.string().optional(),
});

export default function CustomerProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [imagePreview, setImagePreview] = useState<string | null>(user?.profilePicture || null);

  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      phone: user?.phone || "",
      email: user?.email || "",
      addressStreet: user?.addressStreet || "",
      addressCity: user?.addressCity || "",
      addressState: user?.addressState || "",
      addressPostalCode: user?.addressPostalCode || "",
      addressCountry: user?.addressCountry || "",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<User>) => {
      const res = await apiRequest("PATCH", `/api/users/${user?.id}`, data);
      return res.json();
    },
    onSuccess: (updatedUser: User) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/delete-account");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to delete account.");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Account Deleted",
        description: "Your account and all associated data have been successfully deleted.",
      });
      // Optionally, redirect to login or home page after deletion
      // For example, using useAuth hook's logout function and then redirecting
      // auth.logout(); // Assuming useAuth provides a logout method
      window.location.href = "/auth"; // Simple redirect
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteAccount = () => {
    deleteAccountMutation.mutate();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await apiRequest("POST", `/api/users/${user?.id}/profile-picture`, formData);
      const updatedUser = await res.json();
      queryClient.setQueryData(["/api/user"], updatedUser);
    }
  };

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto space-y-6"
      >
        <h1 className="text-2xl font-bold">Profile Settings</h1>

        <div className="grid gap-6">
          {/* Profile Picture and Payment Methods Cards Removed */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((data) => updateProfileMutation.mutate(data))}
                  className="space-y-4"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input {...form.register("name")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">
                        <span className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Phone Number
                        </span>
                      </Label>
                      <Input {...form.register("phone")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">
                        <span className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email Address
                        </span>
                      </Label>
                      <Input {...form.register("email")} type="email" />
                    </div>
                    <div className="space-y-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="addressStreet">
                        <span className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Street Address
                        </span>
                      </Label>
                      <Input {...form.register("addressStreet")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="addressCity">City</Label>
                      <Input {...form.register("addressCity")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="addressState">State</Label>
                      <Input {...form.register("addressState")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="addressPostalCode">Postal Code</Label>
                      <Input {...form.register("addressPostalCode")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="addressCountry">Country</Label>
                      <Input {...form.register("addressCountry")} />
                    </div>
                  </div>
                 </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAccount} disabled={deleteAccountMutation.isPending}>
                      {deleteAccountMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Yes, delete my account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <p className="text-sm text-muted-foreground mt-2">
                Permanently delete your account and all associated data. This action is irreversible.
              </p>
            </CardContent>
          </Card>

        </div>
      </motion.div>
    </DashboardLayout>
  );
}
