import {
  emailNotificationPreferences,
  type EmailNotificationAudience,
  type EmailNotificationType,
  type EmailRecipient,
} from "@shared/config";
import { emailNotificationPreferenceOverrides } from "@shared/schema";
import { db } from "./db";
import logger from "./logger";
import { and, eq } from "drizzle-orm";

/**
 * In-memory cache for preference overrides to avoid repeated DB round-trips per email dispatch.
 */
const CACHE_TTL_MS = 60_000;
let cachedOverrides: {
  fetchedAt: number;
  data: EmailPreferenceOverrides;
} | null = null;

export type EmailPreferenceOverrides = Partial<
  Record<EmailNotificationType, Partial<Record<EmailRecipient, boolean>>>
>;

function cloneDefaultPreferences(): Record<
  EmailNotificationType,
  EmailNotificationAudience
> {
  const cloned = {} as Record<
    EmailNotificationType,
    EmailNotificationAudience
  >;
  for (const [type, audience] of Object.entries(emailNotificationPreferences)) {
    cloned[type as EmailNotificationType] = { ...audience };
  }
  return cloned;
}

function toRecipient(recipient: string): EmailRecipient {
  if (recipient === "customer") return "customer";
  if (recipient === "serviceProvider") return "serviceProvider";
  if (recipient === "shop") return "shop";
  logger.warn(
    `[EmailPreferences] Unknown recipient type '${recipient}'. Defaulting to 'customer'.`,
  );
  return "customer";
}

function toNotificationType(type: string): EmailNotificationType | null {
  if (type in emailNotificationPreferences) {
    return type as EmailNotificationType;
  }
  logger.warn(
    `[EmailPreferences] Unknown notification type '${type}'. Ignoring override row.`,
  );
  return null;
}

async function fetchOverrides(): Promise<EmailPreferenceOverrides> {
  const now = Date.now();
  if (cachedOverrides && now - cachedOverrides.fetchedAt < CACHE_TTL_MS) {
    return cachedOverrides.data;
  }

  const overrides: EmailPreferenceOverrides = {};
  try {
    const rows = await db
      .select({
        notificationType:
          emailNotificationPreferenceOverrides.notificationType,
        recipientType: emailNotificationPreferenceOverrides.recipientType,
        enabled: emailNotificationPreferenceOverrides.enabled,
      })
      .from(emailNotificationPreferenceOverrides);

    for (const row of rows) {
      const notificationType = toNotificationType(row.notificationType);
      if (!notificationType) continue;
      const recipient = toRecipient(row.recipientType);
      overrides[notificationType] = overrides[notificationType] || {};
      overrides[notificationType]![recipient] = row.enabled;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message.toLowerCase() : "unknown error";
    if (
      message.includes("email_notification_preferences") &&
      message.includes("does not exist")
    ) {
      logger.warn(
        "[EmailPreferences] Overrides table missing. Run migration 0017 email_notification_preferences.sql to enable admin overrides.",
      );
    } else if (message.includes("does not exist")) {
      logger.warn(
        "[EmailPreferences] Database unavailable while loading overrides. Falling back to defaults.",
      );
    } else {
      logger.error({ err: error }, "[EmailPreferences] Failed to load overrides; falling back to defaults");
    }
  }

  cachedOverrides = { fetchedAt: now, data: overrides };
  return overrides;
}

export function invalidateEmailPreferenceCache(): void {
  cachedOverrides = null;
}

export async function isEmailNotificationEnabled(
  type: EmailNotificationType,
  recipient: EmailRecipient,
): Promise<boolean> {
  const overrides = await fetchOverrides();
  const override = overrides[type]?.[recipient];
  if (typeof override === "boolean") {
    return override;
  }

  const defaultAudience = emailNotificationPreferences[type];
  if (defaultAudience && recipient in defaultAudience) {
    return defaultAudience[recipient];
  }

  // Default to sending to avoid silently dropping important emails when config is missing.
  logger.warn(
    `[EmailPreferences] No default preference found for type '${type}' and recipient '${recipient}'. Allowing email by default.`,
  );
  return true;
}

export async function getEffectiveEmailPreferences(): Promise<
  Record<EmailNotificationType, EmailNotificationAudience>
> {
  const combined = cloneDefaultPreferences();
  const overrides = await fetchOverrides();

  for (const [type, audiences] of Object.entries(overrides)) {
    const notificationType = type as EmailNotificationType;
    combined[notificationType] = {
      ...combined[notificationType],
      ...audiences,
    } as EmailNotificationAudience;
  }

  return combined;
}

export async function getEmailPreferenceOverridesMap(): Promise<
  EmailPreferenceOverrides
> {
  const overrides = await fetchOverrides();
  const clone: EmailPreferenceOverrides = {};
  for (const [type, recipients] of Object.entries(overrides)) {
    clone[type as EmailNotificationType] = { ...recipients };
  }
  return clone;
}

export async function upsertEmailPreference(
  type: EmailNotificationType,
  recipient: EmailRecipient,
  enabled: boolean,
  updatedByAdminId?: string,
): Promise<void> {
  try {
    await db
      .insert(emailNotificationPreferenceOverrides)
      .values({
        notificationType: type,
        recipientType: recipient,
        enabled,
        updatedByAdminId: updatedByAdminId ?? null,
      })
      .onConflictDoUpdate({
        target: [
          emailNotificationPreferenceOverrides.notificationType,
          emailNotificationPreferenceOverrides.recipientType,
        ],
        set: {
          enabled,
          updatedAt: new Date(),
          updatedByAdminId: updatedByAdminId ?? null,
        },
      });
  } catch (error) {
    const message =
      error instanceof Error ? error.message.toLowerCase() : "unknown error";
    if (message.includes("email_notification_preferences") &&
        message.includes("does not exist")) {
      throw new Error(
        "Email notification preference table missing. Run migration 0017_email_notification_preferences.sql",
      );
    }
    throw error;
  }

  invalidateEmailPreferenceCache();
}

export async function resetEmailPreference(
  type: EmailNotificationType,
  recipient: EmailRecipient,
): Promise<void> {
  try {
    await db
      .delete(emailNotificationPreferenceOverrides)
      .where(
        and(
          eq(emailNotificationPreferenceOverrides.notificationType, type),
          eq(emailNotificationPreferenceOverrides.recipientType, recipient),
        ),
      );
  } catch (error) {
    const message =
      error instanceof Error ? error.message.toLowerCase() : "unknown error";
    if (message.includes("email_notification_preferences") &&
        message.includes("does not exist")) {
      throw new Error(
        "Email notification preference table missing. Run migration 0017_email_notification_preferences.sql",
      );
    }
    throw error;
  }
  invalidateEmailPreferenceCache();
}
