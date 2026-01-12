import React from "react";
import { PageHeader } from "@/components/common/page-header";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/language-context";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { COUNTRY_OPTIONS, INDIA_STATES } from "@/lib/location-options";
import { getUpiSuggestions } from "@/lib/upi";
import { Loader2, Edit, Save, Trash2 } from "lucide-react";
import { z } from "zod";
import { useState, useEffect, useMemo } from "react";
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
} from "@/components/ui/alert-dialog";
import { ProfileLocationSection } from "@/components/location/profile-location-section";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  email: z.string().email("Valid email is required"),
  addressStreet: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressPostalCode: z.string().optional(),
  addressCountry: z.string().optional(),
  bio: z.string().min(10, "Bio should be at least 10 characters"),
  qualifications: z.string().optional(),
  experience: z.string().optional(),
  workingHours: z.string().optional(),
  languages: z.string().optional(),
  upiId: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function ProviderProfile() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [profileData, setProfileData] = useState<ProfileFormData | null>(null);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      phone: user?.phone || "",
      email: user?.email || "",
      addressStreet: user?.addressStreet || "",
      addressCity: user?.addressCity || "",
      addressState: user?.addressState || "",
      addressPostalCode: user?.addressPostalCode || "",
      addressCountry: user?.addressCountry || "India",
      bio: user?.bio || "",
      qualifications: user?.qualifications || "",
      experience: user?.experience || "",
      workingHours: user?.workingHours || "",
      languages: user?.languages || "",
      upiId: user?.upiId || "",
    },
  });
  const upiIdValue = form.watch("upiId") || "";
  const upiSuggestions = useMemo(
    () => getUpiSuggestions(upiIdValue),
    [upiIdValue],
  );

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name || "",
        phone: user.phone || "",
        email: user.email || "",
        addressStreet: user.addressStreet || "",
        addressCity: user.addressCity || "",
        addressState: user.addressState || "",
        addressPostalCode: user.addressPostalCode || "",
        addressCountry: user.addressCountry || "India",
        bio: user.bio || "",
        qualifications: user.qualifications || "",
        experience: user.experience || "",
        workingHours: user.workingHours || "",
        languages: user.languages || "",
        upiId: user.upiId || "",
      });
      setProfileData({
        name: user.name || "",
        phone: user.phone || "",
        email: user.email || "",
        addressStreet: user.addressStreet || "",
        addressCity: user.addressCity || "",
        addressState: user.addressState || "",
        addressPostalCode: user.addressPostalCode || "",
        addressCountry: user.addressCountry || "",
        bio: user.bio || "",
        qualifications: user.qualifications || "",
        experience: user.experience || "",
        workingHours: user.workingHours || "",
        languages: user.languages || "",
        upiId: user.upiId || "",
      });
    }
  }, [user, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      if (!user?.id) throw new Error("User not found");
      const res = await apiRequest("PATCH", `/api/users/${user.id}`, data);
      const updatedUser = await res.json();
      return updatedUser;
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setProfileData(form.getValues());
      setEditMode(false);
      toast({
        title: t("success"),
        description: t("profile_updated_successfully"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
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
      addressStreet: data.addressStreet,
      addressCity: data.addressCity,
      addressState: data.addressState,
      addressPostalCode: data.addressPostalCode,
      addressCountry: data.addressCountry,
      bio: data.bio,
      qualifications: data.qualifications,
      experience: data.experience,
      workingHours: data.workingHours,
      languages: data.languages,
      upiId: data.upiId,
    });
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
        title: t("account_deleted"),
        description: t("account_deleted_description"),
      });
      window.location.href = "/auth";
    },
    onError: (error: Error) => {
      toast({
        title: t("deletion_failed"),
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
      form.reset(profileData || undefined);
    }
    setEditMode(!editMode);
  };

  const verificationBadge = useMemo(() => {
    const status = user?.verificationStatus;
    if (status === "verified") {
      return { label: t("verified_status"), className: "bg-emerald-100 text-emerald-700" };
    }
    if (status === "pending") {
      return { label: t("pending"), className: "bg-amber-100 text-amber-700" };
    }
    if (status === "unverified") {
      return { label: t("unverified_status"), className: "bg-red-100 text-red-700" };
    }
    return { label: t("not_available"), className: "bg-muted text-muted-foreground" };
  }, [t, user?.verificationStatus]);

  const profileCompleteness = user?.profileCompleteness || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <PageHeader
          title={t("provider_profile_title")}
          subtitle={t("provider_profile_subtitle")}
          showBackButton={true}
          backDestination="/provider"
        >
          {!editMode ? (
            <Button type="button" onClick={toggleEditMode}>
              <Edit className="mr-2 h-4 w-4" />
              {t("edit_profile")}
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={toggleEditMode}
                disabled={updateProfileMutation.isPending}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                form="provider-profile-form"
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Save className="mr-2 h-4 w-4" />
                {t("save")}
              </Button>
            </div>
          )}
        </PageHeader>

        <Card>
          <CardHeader>
            <CardTitle>{t("profile_overview_title")}</CardTitle>
            <CardDescription>{t("profile_overview_subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  {t("verification_status_label")}
                </Label>
                <div className="mt-2">
                  <Badge className={verificationBadge.className}>
                    {verificationBadge.label}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  {t("profile_completeness_label")}
                </Label>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div
                      className="bg-primary h-2.5 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${profileCompleteness}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">
                    {profileCompleteness}%
                  </span>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  {t("contact_information")}
                </Label>
                <div className="mt-2 space-y-1 text-sm">
                  <p>{user?.phone || t("not_available")}</p>
                  <p>{user?.email || t("not_available")}</p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  {t("languages")}
                </Label>
                <p className="mt-2 text-sm">
                  {user?.languages || t("not_available")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <ProfileLocationSection
          user={user}
          title={t("service_location_title")}
          description={t("service_location_description")}
        />

        <Card>
          <CardHeader>
            <CardTitle>{t("profile_details_title")}</CardTitle>
            <CardDescription>{t("profile_details_subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                id="provider-profile-form"
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <h3 className="text-base font-semibold">
                    {t("personal_information")}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("name")}</FormLabel>
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
                          <FormLabel>{t("phone")}</FormLabel>
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
                          <FormLabel>{t("email")}</FormLabel>
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
                          <FormLabel>{t("languages")}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder={t("languages_placeholder")}
                              disabled={!editMode}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-base font-semibold">
                    {t("address_information")}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="addressStreet"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("address_street")}</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={!editMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="addressCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("address_city")}</FormLabel>
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
                          <FormLabel>{t("address_state")}</FormLabel>
                          <Select
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            disabled={!editMode}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("select_state")} />
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
                    <FormField
                      control={form.control}
                      name="addressPostalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("address_postal_code")}</FormLabel>
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
                          <FormLabel>{t("address_country")}</FormLabel>
                          <Select
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            disabled={!editMode}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("select_country")} />
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

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-base font-semibold">
                    {t("about_provider")}
                  </h3>
                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("bio")}</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder={t("bio_placeholder")}
                            disabled={!editMode}
                          />
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
                        <FormLabel>{t("qualifications")}</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder={t("qualifications_placeholder")}
                            disabled={!editMode}
                          />
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
                        <FormLabel>{t("experience")}</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder={t("experience_placeholder")}
                            disabled={!editMode}
                          />
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
                        <FormLabel>{t("working_hours")}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder={t("working_hours_placeholder")}
                            disabled={!editMode}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-base font-semibold">
                    {t("payment_details_title")}
                  </h3>
                  <FormField
                    control={form.control}
                    name="upiId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("upi_id")}</FormLabel>
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
                        {t("upi_suggestions")}
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
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">
              {t("danger_zone_title")}
            </CardTitle>
            <CardDescription>{t("danger_zone_description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("delete_account")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("delete_account_confirm_title")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("delete_account_confirm_description")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={deleteAccountMutation.isPending}
                  >
                    {deleteAccountMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {t("delete_account_confirm_button")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <p className="text-sm text-muted-foreground mt-2">
              {t("delete_account_warning")}
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
