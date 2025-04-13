import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Edit, Save } from "lucide-react";
import { z } from "zod";
import { useState, useEffect } from "react";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  email: z.string().email("Valid email is required"),
  address: z.string().min(1, "Address is required"),
  bio: z.string().min(10, "Bio should be at least 10 characters"),
  qualifications: z.string().optional(),
  experience: z.string().optional(),
  workingHours: z.string().optional(),
  languages: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function ProviderProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [profileData, setProfileData] = useState<ProfileFormData | null>(null);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      phone: user?.phone || "",
      email: user?.email || "",
      address: user?.address || "",
      bio: user?.bio || "",
      qualifications: user?.qualifications || "",
      experience: user?.experience || "",
      workingHours: user?.workingHours || "",
      languages: user?.languages || "",
    },
  });
  
  // Update form when user data changes
  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name || "",
        phone: user.phone || "",
        email: user.email || "",
        address: user.address || "",
        bio: user.bio || "",
        qualifications: user.qualifications || "",
        experience: user.experience || "",
        workingHours: user.workingHours || "",
        languages: user.languages || "",
      });
      setProfileData({
        name: user.name || "",
        phone: user.phone || "",
        email: user.email || "",
        address: user.address || "",
        bio: user.bio || "",
        qualifications: user.qualifications || "",
        experience: user.experience || "",
        workingHours: user.workingHours || "",
        languages: user.languages || "",
      });
    }
  }, [user, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      if (!user?.id) throw new Error("User not found");

      console.log("Updating profile with data:", data);
      const res = await apiRequest("PATCH", `/api/users/${user.id}`, data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update profile");
      }
      const updatedUser = await res.json();
      console.log("Profile update response:", updatedUser);
      return updatedUser;
    },
    onSuccess: (updatedUser) => {
      // Directly update the cache with the new user data
      queryClient.setQueryData(["/api/user"], updatedUser);
      
      // Also invalidate the query to ensure fresh data on next fetch
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      // Update local state
      setProfileData(form.getValues());
      setEditMode(false);
      
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      console.error("Profile update error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate({
      name: data.name,
      phone: data.phone,
      email: data.email,
      address: data.address,
      bio: data.bio,
      qualifications: data.qualifications,
      experience: data.experience,
      workingHours: data.workingHours,
      languages: data.languages
    });
  };
  
  const toggleEditMode = () => {
    if (editMode) {
      // If we're exiting edit mode without saving, reset form to current profile data
      form.reset(profileData || undefined);
    }
    setEditMode(!editMode);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Profile Settings</h1>
          {!editMode && (
            <Button
              type="button"
              onClick={toggleEditMode}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          )}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Profile Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={!editMode} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" disabled={!editMode} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" disabled={!editMode} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="languages"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Languages</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., English, Hindi, Tamil" disabled={!editMode} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea {...field} disabled={!editMode} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Tell us about yourself and your services" disabled={!editMode} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="qualifications"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qualifications</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="List your relevant qualifications and certifications" disabled={!editMode} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="experience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Experience</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Describe your work experience" disabled={!editMode} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="workingHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Working Hours</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Mon-Fri: 9 AM - 6 PM" disabled={!editMode} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  {editMode ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={toggleEditMode}
                        disabled={updateProfileMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={updateProfileMutation.isPending}
                      >
                        {updateProfileMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </Button>
                    </>
                  ) : null}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}