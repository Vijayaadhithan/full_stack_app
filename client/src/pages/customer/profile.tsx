import React from 'react';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Form } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { COUNTRY_OPTIONS, INDIA_STATES } from "@/lib/location-options";
import { getUpiSuggestions } from "@/lib/upi";
import {
  Loader2,
  Phone,
  Mail,
  MapPin,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
// useState removed - profile picture upload not currently used
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"; // Added for delete confirmation
import { ProfileLocationSection } from "@/components/location/profile-location-section";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(10, "Invalid phone number"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  upiId: z.string().optional(),
  addressLandmark: z.string().optional(),
  addressStreet: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressPostalCode: z.string().optional(),
  addressCountry: z.string().optional(),
});

export default function CustomerProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  // Profile picture upload functionality removed - not currently used

  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      phone: user?.phone || "",
      email: user?.email || "",
      upiId: user?.upiId || "",
      addressLandmark: user?.addressLandmark || "",
      addressStreet: user?.addressStreet || "",
      addressCity: user?.addressCity || "",
      addressState: user?.addressState || "",
      addressPostalCode: user?.addressPostalCode || "",
      addressCountry: user?.addressCountry || "India",
    },
  });
  const upiSuggestions = getUpiSuggestions(form.watch("upiId") || "");

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<User>) => {
      const res = await apiRequest("PATCH", `/api/users/${user?.id}`, data);
      return res.json();
    },
    onSuccess: (_updatedUser: User) => {
      // queryClient.setQueryData(["/api/user"], updatedUser); // Can be kept or removed, invalidateQueries is more robust for ensuring fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
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
        description:
          "Your account and all associated data have been successfully deleted.",
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

  // handleImageChange function removed - profile picture upload not currently used

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
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((data) =>
                    updateProfileMutation.mutate(data),
                  )}
                  className="space-y-4"
                >
                  {user && (
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 border rounded-lg bg-secondary/30">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          Verification Status
                        </Label>
                        <p
                          className={`text-lg font-semibold ${user.verificationStatus === "verified" ? "text-green-600" : user.verificationStatus === "pending" ? "text-yellow-600" : "text-red-600"}`}
                        >
                          {user.verificationStatus
                            ? user.verificationStatus.charAt(0).toUpperCase() +
                            user.verificationStatus.slice(1)
                            : "Not Available"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          Profile Completeness
                        </Label>
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                            <div
                              className="bg-primary h-2.5 rounded-full transition-all duration-500 ease-out"
                              style={{
                                width: `${user.profileCompleteness || 0}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">
                            {user.profileCompleteness || 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
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
                          Email Address (Optional)
                        </span>
                      </Label>
                      <Input {...form.register("email")} type="email" placeholder="yourname@example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="upiId">
                        <span className="flex items-center gap-2">
                          💳 UPI ID (for payments)
                        </span>
                      </Label>
                      <Input {...form.register("upiId")} placeholder="yourname@upi" />
                      {upiSuggestions.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Suggested UPI IDs
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {upiSuggestions.map((suggestion) => (
                              <Button
                                key={suggestion}
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  form.setValue("upiId", suggestion, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                  })
                                }
                              >
                                {suggestion}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Address Section */}
                    <div className="md:col-span-2 space-y-4 pt-4 border-t">
                      <h3 className="font-semibold flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Address Details
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="addressStreet">Street Address</Label>
                          <Input {...form.register("addressStreet")} placeholder="Door No, Street Name" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="addressCity">City/Village</Label>
                          <Input {...form.register("addressCity")} placeholder="City or Village name" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="addressState">State</Label>
                          <Controller
                            control={form.control}
                            name="addressState"
                            render={({ field }) => (
                              <Select
                                value={field.value || ""}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger id="addressState">
                                  <SelectValue placeholder="Select state" />
                                </SelectTrigger>
                                <SelectContent>
                                  {INDIA_STATES.map((state) => (
                                    <SelectItem key={state} value={state}>
                                      {state}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="addressPostalCode">Postal Code</Label>
                          <Input {...form.register("addressPostalCode")} placeholder="600001" inputMode="numeric" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="addressCountry">Country</Label>
                          <Controller
                            control={form.control}
                            name="addressCountry"
                            render={({ field }) => (
                              <Select
                                value={field.value || ""}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger id="addressCountry">
                                  <SelectValue placeholder="Select country" />
                                </SelectTrigger>
                                <SelectContent>
                                  {COUNTRY_OPTIONS.map((country) => (
                                    <SelectItem key={country} value={country}>
                                      {country}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="addressLandmark">
                        <span className="flex items-center gap-2">
                          📍 Landmark / House Description
                        </span>
                      </Label>
                      <Textarea
                        {...form.register("addressLandmark")}
                        placeholder='Example: "Opposite Government School, Blue House."'
                        className="min-h-[80px] text-base"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use a nearby landmark locals recognize (school, temple,
                        ration shop, main bus stop).
                      </p>
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

          <ProfileLocationSection
            user={user}
            title="GPS Pin"
            description="Drop a pin with your phone GPS so shops can find you faster."
            className="md:col-span-2"
          />

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
                    <AlertDialogTitle>
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      your account and remove all your data from our servers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      disabled={deleteAccountMutation.isPending}
                    >
                      {deleteAccountMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Yes, delete my account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <p className="text-sm text-muted-foreground mt-2">
                Permanently delete your account and all associated data. This
                action is irreversible.
              </p>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
