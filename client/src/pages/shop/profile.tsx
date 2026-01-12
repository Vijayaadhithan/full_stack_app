import React from 'react';
import { ShopLayout } from "@/components/layout/shop-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormControl,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Edit, Save, Trash2 } from "lucide-react";
import type { Shop } from "@shared/schema";
import { z } from "zod";
import { COUNTRY_OPTIONS, INDIA_STATES } from "@/lib/location-options";
import { getUpiSuggestions } from "@/lib/upi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// import { TimePicker } from "@/components/ui/time-picker"; // Removed unused import
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Switch } from "@/components/ui/switch";
import { ProfileLocationSection } from "@/components/location/profile-location-section";

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
  name: z.string().min(1, "Owner name is required"),
  shopName: z.string().min(1, "Shop name is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  businessType: z.string().min(1, "Business type is required"),
  gstin: z.string().optional(),
  phone: z.string().min(10, "Valid phone number is required"),
  email: z.string().email("Valid email is required"),
  upiId: z.string().optional(),
  pickupAvailable: z.boolean().optional(),
  deliveryAvailable: z.boolean().optional(),
  returnsEnabled: z.boolean().optional(),
  catalogModeEnabled: z.boolean().optional(),
  openOrderMode: z.boolean().optional(),
  allowPayLater: z.boolean().optional(),
  payLaterWhitelist: z.array(z.number()).optional(),
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
  const [profileData, setProfileData] = useState<ShopProfileFormData | null>(
    null,
  );

  // Fetch current shop data to get real location coordinates and profile details
  const { data: currentShop } = useQuery<Shop | null>({
    queryKey: ["/api/shops/current"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/shops/current");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user,
  });

  const getFormDefaults = useCallback((shop?: Shop | null): ShopProfileFormData => ({
    name: user?.name || "",
    shopName: shop?.shopName ?? user?.shopProfile?.shopName ?? "",
    description: shop?.description ?? user?.shopProfile?.description ?? "",
    businessType: shop?.businessType ?? user?.shopProfile?.businessType ?? "",
    gstin: shop?.gstin ?? user?.shopProfile?.gstin ?? "",
    phone: user?.phone || "",
    email: user?.email || "",
    upiId: user?.upiId || "",
    pickupAvailable: user?.pickupAvailable ?? true,
    deliveryAvailable: user?.deliveryAvailable ?? false,
    returnsEnabled: user?.returnsEnabled ?? true,
    catalogModeEnabled:
      shop?.catalogModeEnabled ??
      user?.shopProfile?.catalogModeEnabled ??
      false,
    openOrderMode:
      shop?.openOrderMode ??
      user?.shopProfile?.openOrderMode ??
      user?.shopProfile?.catalogModeEnabled ??
      false,
    allowPayLater:
      shop?.allowPayLater ?? user?.shopProfile?.allowPayLater ?? false,
    payLaterWhitelist:
      shop?.payLaterWhitelist ?? user?.shopProfile?.payLaterWhitelist ?? [],
    workingHours:
      shop?.workingHours ??
      user?.shopProfile?.workingHours ?? {
        from: "09:00",
        to: "18:00",
        days: [],
      },
    shippingPolicy:
      shop?.shippingPolicy ?? user?.shopProfile?.shippingPolicy ?? "",
    returnPolicy: shop?.returnPolicy ?? user?.shopProfile?.returnPolicy ?? "",
    addressStreet: shop?.shopAddressStreet ?? user?.addressStreet ?? "",
    addressCity: shop?.shopAddressCity ?? user?.addressCity ?? "",
    addressState: shop?.shopAddressState ?? user?.addressState ?? "",
    addressPostalCode:
      shop?.shopAddressPincode ?? user?.addressPostalCode ?? "",
    addressCountry: user?.addressCountry ?? "India",
  }), [user]);

  const form = useForm<ShopProfileFormData>({
    resolver: zodResolver(shopProfileSchema),
    defaultValues: getFormDefaults(currentShop),
  });
  const upiIdValue = form.watch("upiId") || "";
  const upiSuggestions = useMemo(
    () => getUpiSuggestions(upiIdValue),
    [upiIdValue],
  );

  // Update form and profile data when user data changes
  useEffect(() => {
    if (!user) return;
    const shopData = getFormDefaults(currentShop);
    form.reset(shopData);
    setProfileData(shopData);
  }, [currentShop, form, getFormDefaults, user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ShopProfileFormData) => {
      if (!user?.id) throw new Error("User not found");

      // Separate shopProfile fields from address fields
      const {
        addressStreet,
        addressCity,
        addressState,
        addressPostalCode,
        addressCountry,
        phone,
        name,
        email,
        upiId,
        pickupAvailable,
        deliveryAvailable,
        returnsEnabled,
        ...shopProfileData
      } = data;
      const updatePayload = {
        shopProfile: shopProfileData,
        addressStreet,
        addressCity,
        addressState,
        addressPostalCode,
        addressCountry,
        phone,
        email,
        name,
        upiId,
        pickupAvailable,
        returnsEnabled,
        deliveryAvailable,
      };

      console.log("Updating user profile with data:", updatePayload);
      const res = await apiRequest(
        "PATCH",
        `/api/users/${user.id}`,
        updatePayload,
      );
      console.log("Shop profile update response:", res);

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update profile");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shops/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/profiles"] });
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
    // Log form data before sending to server for debugging
    console.log("[ShopProfile] submitting", data);
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
        description:
          "Your account and all associated data have been successfully deleted.",
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
    <ShopLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Manage Shop Profile</h1>
          {!editMode && (
            <Button type="button" onClick={toggleEditMode} className="w-full sm:w-auto">
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
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                      <div
                        className="bg-primary h-2.5 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${user.profileCompleteness || 0}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">
                      {user.profileCompleteness || 0}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <ProfileLocationSection
          user={user}
          initialCoordinates={
            currentShop?.shopLocationLat && currentShop?.shopLocationLng
              ? {
                latitude: Number(currentShop.shopLocationLat),
                longitude: Number(currentShop.shopLocationLng),
              }
              : null
          }
          title="Store Location"
          description="Drag the pin to your storefront or service area so that nearby customers can find you."
        />

        <Card>
          <CardHeader>
            <CardTitle>Shop Information Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Owner Name</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={!editMode} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                            <SelectItem value="manufacturer">
                              Manufacturer
                            </SelectItem>
                            <SelectItem value="distributor">
                              Distributor
                            </SelectItem>
                          </SelectContent>
                        </Select>
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
                          <Select
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            disabled={!editMode}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select state" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {INDIA_STATES.map((state) => (
                                <SelectItem key={state} value={state}>
                                  {state}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                          <Select
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            disabled={!editMode}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select country" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {COUNTRY_OPTIONS.map((country) => (
                                <SelectItem key={country} value={country}>
                                  {country}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Payment Details</h3>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="upiId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UPI ID</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={!editMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {editMode && upiSuggestions.length > 0 && (
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
                    <FormField
                      control={form.control}
                      name="pickupAvailable"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-md border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Enable In-Store Pickup</FormLabel>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={!editMode}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="deliveryAvailable"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-md border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Enable Local Delivery</FormLabel>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={!editMode}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="returnsEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-md border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Allow Returns</FormLabel>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={!editMode}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="catalogModeEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-md border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Catalog Mode</FormLabel>
                            <p className="text-xs text-muted-foreground">
                              Show your catalogue without tracking stock counts.
                            </p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                if (checked) {
                                  form.setValue("openOrderMode", true);
                                }
                              }}
                              disabled={!editMode}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="openOrderMode"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-md border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Allow Open Orders</FormLabel>
                            <p className="text-xs text-muted-foreground">
                              Let customers place orders even when stock is low or zero. You&apos;ll confirm availability before fulfillment.
                            </p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={!editMode}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="allowPayLater"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-md border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Enable Pay Later / Khata</FormLabel>
                            <p className="text-xs text-muted-foreground">
                              Repeat or whitelisted customers can request Pay Later. Orders stay pending until you approve credit.
                            </p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={!editMode}
                            />
                          </FormControl>
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
                            <div
                              key={day}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                checked={form
                                  .watch("workingHours.days")
                                  .includes(day)}
                                onCheckedChange={(checked) => {
                                  if (!editMode) return;
                                  const days = form.watch("workingHours.days");
                                  if (checked) {
                                    form.setValue("workingHours.days", [
                                      ...days,
                                      day,
                                    ]);
                                  } else {
                                    form.setValue(
                                      "workingHours.days",
                                      days.filter((d) => d !== day),
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
    </ShopLayout>
  );
}
