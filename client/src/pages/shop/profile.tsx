import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Edit, Save, Trash2 } from "lucide-react";
import { z } from "zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { TimePicker } from "@/components/ui/time-picker"; // Removed unused import
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"; // Added for delete confirmation

const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const shopProfileSchema = z.object({
  shopName: z.string().min(1, "Shop name is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  businessType: z.string().min(1, "Business type is required"),
  gstin: z.string().optional(),
  bankDetails: z.object({
    accountNumber: z.string().min(1, "Account number is required"),
    ifscCode: z.string().min(1, "IFSC code is required"),
    accountHolderName: z.string().min(1, "Account holder name is required"),
  }),
  workingHours: z.object({
    from: z.string().min(1, "Opening time is required"),
    to: z.string().min(1, "Closing time is required"),
    days: z.array(z.string()).min(1, "Select at least one working day"),
  }),
  shippingPolicy: z.string().optional(),
  returnPolicy: z.string().optional(),
  addressStreet: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressPostalCode: z.string().optional(),
  addressCountry: z.string().optional(),
});

type ShopProfileFormData = z.infer<typeof shopProfileSchema>;

export default function ShopProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [profileData, setProfileData] = useState<ShopProfileFormData | null>(null);

  const form = useForm<ShopProfileFormData>({
    resolver: zodResolver(shopProfileSchema),
    defaultValues: {
      shopName: user?.shopProfile?.shopName || "",
      description: user?.shopProfile?.description || "",
      businessType: user?.shopProfile?.businessType || "",
      gstin: user?.shopProfile?.gstin || "",
      bankDetails: user?.shopProfile?.bankDetails || {
        accountNumber: "",
        ifscCode: "",
        accountHolderName: "",
      },
      workingHours: user?.shopProfile?.workingHours || {
        from: "09:00",
        to: "18:00",
        days: [],
      },
      shippingPolicy: user?.shopProfile?.shippingPolicy || "",
      returnPolicy: user?.shopProfile?.returnPolicy || "",
      addressStreet: user?.addressStreet || "",
      addressCity: user?.addressCity || "",
      addressState: user?.addressState || "",
      addressPostalCode: user?.addressPostalCode || "",
      addressCountry: user?.addressCountry || "",
    },
  });
  
  // Update form and profile data when user data changes
  useEffect(() => {
    if (user?.shopProfile) {
      const shopData = {
        shopName: user.shopProfile.shopName || "",
        description: user.shopProfile.description || "",
        businessType: user.shopProfile.businessType || "",
        gstin: user.shopProfile.gstin || "",
        bankDetails: user.shopProfile.bankDetails || {
          accountNumber: "",
          ifscCode: "",
          accountHolderName: "",
        },
        workingHours: user.shopProfile.workingHours || {
          from: "09:00",
          to: "18:00",
          days: [],
        },
        shippingPolicy: user.shopProfile.shippingPolicy || "",
        returnPolicy: user.shopProfile.returnPolicy || "",
        addressStreet: user.addressStreet || "",
        addressCity: user.addressCity || "",
        addressState: user.addressState || "",
        addressPostalCode: user.addressPostalCode || "",
        addressCountry: user.addressCountry || "",
      };
      form.reset(shopData);
      setProfileData(shopData);
    }
  }, [user, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ShopProfileFormData) => {
      if (!user?.id) throw new Error("User not found");

      // Separate shopProfile fields from address fields
      const { addressStreet, addressCity, addressState, addressPostalCode, addressCountry, ...shopProfileData } = data;
      const updatePayload = {
        shopProfile: shopProfileData,
        addressStreet,
        addressCity,
        addressState,
        addressPostalCode,
        addressCountry,
      };

      console.log("Updating user profile with data:", updatePayload);
      const res = await apiRequest("PATCH", `/api/users/${user.id}`, updatePayload);
      console.log("Shop profile update response:", res);
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update profile");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setProfileData(form.getValues());
      setEditMode(false);
      toast({
        title: "Success",
        description: "Shop profile updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ShopProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

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
          <h1 className="text-2xl font-bold">Manage Shop Profile</h1>
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
            <CardTitle>Shop Profile & Verification</CardTitle>
          </CardHeader>
          <CardContent>
            {user && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 border rounded-lg bg-secondary/30">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Verification Status</Label>
                  <p className={`text-lg font-semibold ${user.verificationStatus === 'verified' ? 'text-green-600' : user.verificationStatus === 'pending' ? 'text-yellow-600' : 'text-red-600'}`}>
                    {user.verificationStatus ? user.verificationStatus.charAt(0).toUpperCase() + user.verificationStatus.slice(1) : 'Not Available'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Profile Completeness</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                      <div 
                        className="bg-primary h-2.5 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${user.profileCompleteness || 0}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">{user.profileCompleteness || 0}%</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shop Information Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="shopName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shop Name</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={!editMode} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled={!editMode}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select business type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="retail">Retail</SelectItem>
                            <SelectItem value="wholesale">Wholesale</SelectItem>
                            <SelectItem value="manufacturer">Manufacturer</SelectItem>
                            <SelectItem value="distributor">Distributor</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={4} disabled={!editMode} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gstin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GSTIN (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!editMode} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <h3 className="font-medium">Address</h3>
                  <FormField
                    control={form.control}
                    name="addressStreet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={!editMode} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="addressCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={!editMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="addressState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={!editMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="addressPostalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postal Code</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={!editMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="addressCountry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={!editMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Bank Details</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="bankDetails.accountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Number</FormLabel>
                          <FormControl>
                            <Input {...field} type="text" disabled={!editMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bankDetails.ifscCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IFSC Code</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={!editMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bankDetails.accountHolderName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Holder Name</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={!editMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Working Hours</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="workingHours.from"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Opening Time</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="time"
                              disabled={!editMode}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="workingHours.to"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Closing Time</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="time"
                              disabled={!editMode}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="workingHours.days"
                    render={() => (
                      <FormItem>
                        <FormLabel>Working Days</FormLabel>
                        <div className="grid grid-cols-4 gap-2">
                          {daysOfWeek.map((day) => (
                            <div key={day} className="flex items-center space-x-2">
                              <Checkbox
                                checked={form.watch("workingHours.days").includes(day)}
                                onCheckedChange={(checked) => {
                                  if (!editMode) return;
                                  const days = form.watch("workingHours.days");
                                  if (checked) {
                                    form.setValue("workingHours.days", [...days, day]);
                                  } else {
                                    form.setValue(
                                      "workingHours.days",
                                      days.filter((d) => d !== day)
                                    );
                                  }
                                }}
                                disabled={!editMode}
                              />
                              <div className="space-y-0.5">
                                <Label className="text-sm font-normal">
                                  {day}
                                </Label>
                              </div>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="shippingPolicy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shipping Policy (optional)</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={4} disabled={!editMode} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="returnPolicy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Return Policy (optional)</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={4} disabled={!editMode} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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

        <Card>
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
    </DashboardLayout>
  );
}
