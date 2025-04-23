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
import { Loader2, CreditCard, Phone, Mail, MapPin, Upload } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

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
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
