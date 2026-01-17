/**
 * Push Notification Service
 * 
 * Handles sending push notifications via Firebase Cloud Messaging (FCM)
 * for both Android and Web clients.
 */

import admin from "firebase-admin";
import logger from "../logger";
import { isFirebaseAdminAvailable, initializeFirebaseAdmin } from "./firebase-admin";

// Initialize Firebase Admin if not already done
initializeFirebaseAdmin();

export interface PushNotificationPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
    imageUrl?: string;
}

export interface SendPushResult {
    success: boolean;
    successCount: number;
    failureCount: number;
    invalidTokens: string[];
}

/**
 * Send push notification to a single device token
 */
export async function sendPushToToken(
    token: string,
    payload: PushNotificationPayload
): Promise<{ success: boolean; invalidToken: boolean }> {
    if (!isFirebaseAdminAvailable()) {
        logger.warn("Firebase Admin not available. Push notification skipped.");
        return { success: false, invalidToken: false };
    }

    try {
        const message: admin.messaging.Message = {
            token,
            notification: {
                title: payload.title,
                body: payload.body,
                ...(payload.imageUrl && { imageUrl: payload.imageUrl }),
            },
            data: payload.data,
            android: {
                priority: "high",
                notification: {
                    channelId: "doorstep_notifications",
                    priority: "high",
                    defaultSound: true,
                    defaultVibrateTimings: true,
                },
            },
            webpush: {
                notification: {
                    icon: "/icon-192.png",
                    badge: "/icon-192.png",
                    requireInteraction: true,
                },
                fcmOptions: {
                    link: "/notifications",
                },
            },
        };

        await admin.messaging().send(message);
        logger.debug({ token: token.substring(0, 20) + "..." }, "Push notification sent successfully");
        return { success: true, invalidToken: false };
    } catch (error: any) {
        // Check if token is invalid/unregistered
        if (
            error.code === "messaging/invalid-registration-token" ||
            error.code === "messaging/registration-token-not-registered"
        ) {
            logger.info({ token: token.substring(0, 20) + "..." }, "FCM token is invalid or unregistered");
            return { success: false, invalidToken: true };
        }
        logger.error({ err: error, token: token.substring(0, 20) + "..." }, "Failed to send push notification");
        return { success: false, invalidToken: false };
    }
}

/**
 * Send push notification to multiple device tokens
 */
export async function sendPushToTokens(
    tokens: string[],
    payload: PushNotificationPayload
): Promise<SendPushResult> {
    if (!isFirebaseAdminAvailable()) {
        logger.warn("Firebase Admin not available. Push notifications skipped.");
        return {
            success: false,
            successCount: 0,
            failureCount: tokens.length,
            invalidTokens: [],
        };
    }

    if (tokens.length === 0) {
        return {
            success: true,
            successCount: 0,
            failureCount: 0,
            invalidTokens: [],
        };
    }

    const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
            title: payload.title,
            body: payload.body,
            ...(payload.imageUrl && { imageUrl: payload.imageUrl }),
        },
        data: payload.data,
        android: {
            priority: "high",
            notification: {
                channelId: "doorstep_notifications",
                priority: "high",
                defaultSound: true,
                defaultVibrateTimings: true,
            },
        },
        webpush: {
            notification: {
                icon: "/icon-192.png",
                badge: "/icon-192.png",
                requireInteraction: true,
            },
            fcmOptions: {
                link: "/notifications",
            },
        },
    };

    try {
        const response = await admin.messaging().sendEachForMulticast(message);

        const invalidTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                const error = resp.error;
                if (
                    error?.code === "messaging/invalid-registration-token" ||
                    error?.code === "messaging/registration-token-not-registered"
                ) {
                    invalidTokens.push(tokens[idx]);
                }
            }
        });

        logger.info(
            {
                successCount: response.successCount,
                failureCount: response.failureCount,
                invalidTokenCount: invalidTokens.length,
            },
            "Push notifications sent"
        );

        return {
            success: response.successCount > 0,
            successCount: response.successCount,
            failureCount: response.failureCount,
            invalidTokens,
        };
    } catch (error) {
        logger.error({ err: error }, "Failed to send multicast push notification");
        return {
            success: false,
            successCount: 0,
            failureCount: tokens.length,
            invalidTokens: [],
        };
    }
}

/**
 * Helper to create notification data from notification type
 * @param notificationType - The type of notification (booking, order, etc.)
 * @param relatedId - The related booking/order ID
 * @param clickUrl - Optional URL to navigate to when notification is clicked
 */
export function createPushData(
    notificationType: string,
    relatedId?: number | null,
    clickUrl?: string
): Record<string, string> {
    const data: Record<string, string> = {
        type: notificationType,
        timestamp: new Date().toISOString(),
    };

    if (relatedId) {
        data.relatedId = relatedId.toString();
    }

    // Add click URL for proper navigation
    if (clickUrl) {
        data.clickUrl = clickUrl;
    } else {
        // Generate default click URL based on type
        data.clickUrl = getDefaultClickUrl(notificationType, relatedId);
    }

    return data;
}

/**
 * Get default click URL based on notification type
 * Note: The frontend will determine the correct prefix (customer/provider) based on user role
 */
function getDefaultClickUrl(notificationType: string, relatedId?: number | null): string {
    // For now, just return the path without role prefix
    // The frontend will add the correct prefix based on user role
    switch (notificationType) {
        case 'booking':
        case 'booking_request':
        case 'service':
        case 'new_booking':
        case 'booking_accepted':
        case 'booking_completed':
        case 'payment_submitted':
        case 'payment_confirmed':
            return relatedId ? `/bookings/${relatedId}` : '/bookings';
        case 'order':
        case 'new_order':
        case 'order_shipped':
        case 'order_delivered':
            return relatedId ? `/orders/${relatedId}` : '/orders';
        default:
            return '/notifications';
    }
}
