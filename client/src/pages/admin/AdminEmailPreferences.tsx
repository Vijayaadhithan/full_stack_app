import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  emailNotificationTypes,
  emailRecipients,
  type EmailNotificationType,
  type EmailRecipient,
} from "@shared/config";

type RecipientPreferenceSummary = {
  default: boolean;
  effective: boolean;
  overridden: boolean;
};

type EmailPreferenceEntry = {
  notificationType: EmailNotificationType;
  recipients: Record<EmailRecipient, RecipientPreferenceSummary>;
};

type EmailPreferencesResponse = {
  preferences: EmailPreferenceEntry[];
};

type UpdateVariables = {
  notificationType: EmailNotificationType;
  recipient: EmailRecipient;
  enabled: boolean;
};

type ResetVariables = {
  notificationType: EmailNotificationType;
  recipient: EmailRecipient;
  defaultValue: boolean;
};

type PreferenceMutationResponse = {
  notificationType: EmailNotificationType;
  recipient: EmailRecipient;
  effective: boolean;
  overridden: boolean;
};

const recipientLabels: Record<EmailRecipient, string> = {
  customer: "Customer",
  serviceProvider: "Service Provider",
  shop: "Shop",
};

function formatNotificationLabel(type: EmailNotificationType): string {
  return type
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/(^|\s)([a-z])/g, (match) => match.toUpperCase());
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unexpected error";
}

export default function AdminEmailPreferences() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [optimisticOverrides, setOptimisticOverrides] = useState<
    Map<string, boolean>
  >(new Map());

  const { data, isLoading, isError, error } = useQuery<EmailPreferencesResponse>({
    queryKey: ["/api/admin/email-preferences"],
    queryFn: async () =>
      apiRequest("GET", "/api/admin/email-preferences").then((res) =>
        res.json(),
      ),
  });

  const markPending = (key: string, isPending: boolean) => {
    setPendingKeys((prev) => {
      const next = new Set(prev);
      if (isPending) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const updateOptimisticValue = (key: string, value: boolean | null) => {
    setOptimisticOverrides((prev) => {
      const next = new Map(prev);
      if (value === null) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      return next;
    });
  };

  const invalidatePreferences = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/admin/email-preferences"] });

  const updatePreferenceMutation = useMutation<
    PreferenceMutationResponse,
    Error,
    UpdateVariables
  >({
    mutationFn: async ({ notificationType, recipient, enabled }) =>
      apiRequest(
        "PUT",
        `/api/admin/email-preferences/${notificationType}/${recipient}`,
        { enabled },
      ).then((res) => res.json()),
    onMutate: ({ notificationType, recipient, enabled }) => {
      const key = `${notificationType}:${recipient}`;
      markPending(key, true);
      updateOptimisticValue(key, enabled);
    },
    onError: (err, { notificationType, recipient }) => {
      const key = `${notificationType}:${recipient}`;
      markPending(key, false);
      updateOptimisticValue(key, null);
      toast({
        title: "Failed to update preference",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
    onSuccess: (_data, { notificationType, recipient }) => {
      toast({
        title: "Preference updated",
        description: `${formatNotificationLabel(notificationType)} → ${recipientLabels[recipient]} is now updated.`,
      });
    },
    onSettled: (_res, _err, { notificationType, recipient }) => {
      const key = `${notificationType}:${recipient}`;
      markPending(key, false);
      updateOptimisticValue(key, null);
      invalidatePreferences();
    },
  });

  const resetPreferenceMutation = useMutation<
    PreferenceMutationResponse,
    Error,
    ResetVariables
  >({
    mutationFn: async ({ notificationType, recipient }) =>
      apiRequest(
        "DELETE",
        `/api/admin/email-preferences/${notificationType}/${recipient}`,
      ).then((res) => res.json()),
    onMutate: ({ notificationType, recipient, defaultValue }) => {
      const key = `${notificationType}:${recipient}`;
      markPending(key, true);
      updateOptimisticValue(key, defaultValue);
    },
    onError: (err, { notificationType, recipient }) => {
      const key = `${notificationType}:${recipient}`;
      markPending(key, false);
      updateOptimisticValue(key, null);
      toast({
        title: "Failed to reset preference",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
    onSuccess: (_data, { notificationType, recipient }) => {
      toast({
        title: "Preference reset",
        description: `${formatNotificationLabel(notificationType)} → ${recipientLabels[recipient]} reverted to default.`,
      });
    },
    onSettled: (_res, _err, { notificationType, recipient }) => {
      const key = `${notificationType}:${recipient}`;
      markPending(key, false);
      updateOptimisticValue(key, null);
      invalidatePreferences();
    },
  });

  const preferences = useMemo(
    () => data?.preferences ?? [],
    [data?.preferences],
  );

  if (isLoading) {
    return <div>Loading email notification preferences…</div>;
  }

  if (isError) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Email Preferences</h1>
        <p className="text-sm text-destructive">
          {`Failed to load email preferences: ${getErrorMessage(error)}`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Email Preferences</h1>
        <p className="text-sm text-muted-foreground">
          Enable or disable automated emails per template and recipient group.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left font-medium px-4 py-3 border-b">
                Notification
              </th>
              {emailRecipients.map((recipient) => (
                <th
                  key={recipient}
                  className="text-left font-medium px-4 py-3 border-b"
                >
                  {recipientLabels[recipient]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {emailNotificationTypes.map((notificationType) => {
              const entry = preferences.find(
                (pref) => pref.notificationType === notificationType,
              );
              const recipients = entry?.recipients;

              return (
                <tr key={notificationType} className="border-b last:border-0">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium">
                      {formatNotificationLabel(notificationType)}
                    </div>
                  </td>
                  {emailRecipients.map((recipient) => {
                    const summary = recipients?.[recipient];
                    const preferenceKey = `${notificationType}:${recipient}`;
                    const isPending = pendingKeys.has(preferenceKey);
                    const optimisticValue = optimisticOverrides.get(
                      preferenceKey,
                    );
                    const checkedValue =
                      optimisticValue !== undefined
                        ? optimisticValue
                        : summary?.effective ?? false;

                    if (!summary) {
                      return (
                        <td key={recipient} className="px-4 py-3 text-muted-foreground">
                          Not available
                        </td>
                      );
                    }

                    return (
                      <td key={recipient} className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={checkedValue}
                              onCheckedChange={(checked) =>
                                updatePreferenceMutation.mutate({
                                  notificationType,
                                  recipient,
                                  enabled: checked,
                                })
                              }
                              disabled={isPending}
                            />
                            <Badge variant="outline">
                              Default: {summary.default ? "On" : "Off"}
                            </Badge>
                            {summary.overridden && (
                              <Badge variant="secondary">Overridden</Badge>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {summary.overridden && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  resetPreferenceMutation.mutate({
                                    notificationType,
                                    recipient,
                                    defaultValue: summary.default,
                                  })
                                }
                                disabled={isPending}
                              >
                                Reset to default
                              </Button>
                            )}
                            {isPending && (
                              <span className="text-xs text-muted-foreground">
                                Saving…
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
