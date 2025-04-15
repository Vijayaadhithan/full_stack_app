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
  address: z.string().min(1, "Address is required"),
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
      address: user?.address || "",
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

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile Picture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center gap-4">
                <div className="relative h-32 w-32">
                  <img
                    src={imagePreview || "https://via.placeholder.com/128"}
                    alt="Profile"
                    className="h-full w-full rounded-full object-cover"
                  />
                  <label
                    htmlFor="profile-picture"
                    className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90"
                  >
                    <Upload className="h-4 w-4" />
                  </label>
                  <input
                    type="file"
                    id="profile-picture"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {user?.paymentMethods?.map((method, index) => (
                <div key={index} className="flex items-center gap-2 p-2 border rounded">
                  <CreditCard className="h-4 w-4" />
                  <span>{method.type === "card" ? "●●●● " + method.details.last4 : method.details.vpa}</span>
                </div>
              ))}
              <Button variant="outline" className="w-full">
                Add Payment Method
              </Button>
            </CardContent>
          </Card>

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
                      <Label htmlFor="address">
                        <span className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Address
                        </span>
                      </Label>
                      <Input {...form.register("address")} />
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
