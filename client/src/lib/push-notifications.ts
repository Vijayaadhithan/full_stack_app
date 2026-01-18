/**
 * Push Notifications Helper
 * 
 * This module provides helper functions for managing web push notifications
 * using Firebase Cloud Messaging.
 */

import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";
import { app } from "./firebase";
import { apiRequest } from "./queryClient";
import { debugLog, debugWarn } from "./debug";

let messaging: Messaging | null = null;
const FCM_TOKEN_STORAGE_KEY = "fcm_token";
const FCM_TOKEN_SYNC_KEY = "fcm_token_needs_sync";

/**
 * Check if push notifications are supported in this browser
 */
export function isPushNotificationSupported(): boolean {
    return (
        typeof window !== "undefined" &&
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window
    );
}

/**
 * Get the current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
    if (!isPushNotificationSupported()) {
        return "unsupported";
    }
    return Notification.permission;
}

/**
 * Initialize Firebase Messaging
 * Must be called before other messaging functions
 */
export async function initializeMessaging(): Promise<Messaging | null> {
    if (!isPushNotificationSupported()) {
        debugWarn("Push notifications not supported in this browser");
        return null;
    }

    if (messaging) {
        return messaging;
    }

    try {
        // Register the service worker first
        const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        debugLog("Service worker registered:", registration.scope);

        // Set up service worker message handler for notification clicks
        setupServiceWorkerMessageHandler();

        if (!app) {
            debugWarn("Firebase app not initialized");
            return null;
        }

        messaging = getMessaging(app);
        return messaging;
    } catch (error) {
        console.error("Failed to initialize Firebase Messaging:", error);
        return null;
    }
}

/**
 * Set up handler for messages from service worker (e.g., notification clicks)
 */
function setupServiceWorkerMessageHandler(): void {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
                const url = event.data.url;
                debugLog("Received notification click from service worker:", url);

                // Navigate to the URL
                if (url && typeof window !== 'undefined') {
                    // Extract path from absolute URL if needed
                    let path = url;
                    try {
                        const urlObj = new URL(url);
                        path = urlObj.pathname + urlObj.search;
                    } catch {
                        // URL is already a path
                    }

                    // Navigate using window.location
                    window.location.href = path;
                }
            }
        });
    }
}

/**
 * Request notification permission from the user
 * @returns The permission state after the request
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (!isPushNotificationSupported()) {
        debugWarn("Push notifications not supported");
        return "denied";
    }

    try {
        const permission = await Notification.requestPermission();
        debugLog("Notification permission:", permission);
        return permission;
    } catch (error) {
        console.error("Error requesting notification permission:", error);
        return "denied";
    }
}

/**
 * Get FCM token for the current device
 * @param vapidKey The VAPID key from Firebase Console
 * @returns The FCM token or null if unavailable
 */
export async function getFcmToken(vapidKey?: string): Promise<string | null> {
    if (!isPushNotificationSupported()) {
        return null;
    }

    const permission = Notification.permission;
    if (permission !== "granted") {
        debugWarn("Notification permission not granted");
        return null;
    }

    try {
        const msg = await initializeMessaging();
        if (!msg) {
            return null;
        }

        const registration = await navigator.serviceWorker.ready;
        const token = await getToken(msg, {
            vapidKey: vapidKey || import.meta.env.VITE_FIREBASE_VAPID_KEY,
            serviceWorkerRegistration: registration,
        });

        debugLog("FCM token obtained");
        return token;
    } catch (error) {
        console.error("Error getting FCM token:", error);
        return null;
    }
}

/**
 * Register FCM token with the backend
 */
export async function registerPushToken(token: string): Promise<boolean> {
    localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
    localStorage.setItem(FCM_TOKEN_SYNC_KEY, "true");
    try {
        const response = await apiRequest("POST", "/api/fcm/register", {
            token,
            platform: "web",
            deviceInfo: navigator.userAgent,
        }, {
            allowStatuses: [401, 403],
        });

        if (response.ok) {
            debugLog("FCM token registered with backend");
            localStorage.setItem(FCM_TOKEN_SYNC_KEY, "false");
            return true;
        } else if (response.status === 401 || response.status === 403) {
            // User is not authenticated - this is expected in some cases
            debugLog("FCM token registration skipped - user not authenticated");
            localStorage.setItem(FCM_TOKEN_SYNC_KEY, "true");
            return false;
        } else {
            debugWarn("Failed to register FCM token:", response.status);
            localStorage.setItem(FCM_TOKEN_SYNC_KEY, "true");
            return false;
        }
    } catch (error) {
        console.error("Error registering FCM token:", error);
        localStorage.setItem(FCM_TOKEN_SYNC_KEY, "true");
        return false;
    }
}

/**
 * Unregister FCM token from the backend (on logout)
 */
export async function unregisterPushToken(): Promise<boolean> {
    const token = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
    if (!token) {
        return true;
    }

    try {
        const response = await apiRequest("DELETE", "/api/fcm/unregister", { token }, {
            allowStatuses: [401, 403],
        });

        if (response.ok) {
            debugLog("FCM token unregistered from backend");
            localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
            localStorage.removeItem(FCM_TOKEN_SYNC_KEY);
            return true;
        } else if (response.status === 401 || response.status === 403) {
            // Session already expired - just clean up local storage
            debugLog("FCM token unregistration skipped - session expired");
            localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
            localStorage.removeItem(FCM_TOKEN_SYNC_KEY);
            return true;
        }
        return false;
    } catch (error) {
        // On logout, the session might already be gone, so just clean up
        debugWarn("Error unregistering FCM token (session may be expired):", error);
        localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
        localStorage.removeItem(FCM_TOKEN_SYNC_KEY);
        return false;
    }
}

export function getStoredFcmToken(): string | null {
    return localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
}

export function isStoredFcmTokenSyncPending(): boolean {
    return localStorage.getItem(FCM_TOKEN_SYNC_KEY) === "true";
}

export async function syncStoredPushToken(): Promise<boolean> {
    const token = getStoredFcmToken();
    if (!token) {
        return false;
    }

    if (!isStoredFcmTokenSyncPending()) {
        return true;
    }

    return registerPushToken(token);
}

/**
 * Set up foreground message handler
 * @param callback Function to call when a message is received in foreground
 */
export function setupForegroundMessageHandler(
    callback: (payload: { title?: string; body?: string; data?: Record<string, string> }) => void
): (() => void) | null {
    if (!messaging) {
        debugWarn("Messaging not initialized");
        return null;
    }

    const unsubscribe = onMessage(messaging, (payload) => {
        debugLog("Foreground message received:", payload);
        callback({
            title: payload.notification?.title,
            body: payload.notification?.body,
            data: payload.data as Record<string, string>,
        });
    });

    return unsubscribe;
}

/**
 * Full registration flow for push notifications
 * 1. Check support
 * 2. Request permission
 * 3. Get token
 * 4. Register with backend
 */
export async function registerPushNotifications(): Promise<boolean> {
    if (!isPushNotificationSupported()) {
        debugLog("Push notifications not supported");
        return false;
    }

    try {
        // Request permission
        const permission = getNotificationPermission();
        if (permission !== "granted") {
            const requested = await requestNotificationPermission();
            if (requested !== "granted") {
                debugLog("Notification permission denied");
                return false;
            }
        }

        // Get FCM token
        const token = await getFcmToken();
        if (!token) {
            console.error("Failed to get FCM token");
            return false;
        }

        // Register with backend
        return await registerPushToken(token);
    } catch (error) {
        console.error("Error in push notification registration:", error);
        return false;
    }
}
