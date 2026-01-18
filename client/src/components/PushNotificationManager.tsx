import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
    registerPushNotifications as registerFcmPushNotifications,
    isPushNotificationSupported,
    unregisterPushToken,
} from "@/lib/push-notifications";
import { debugLog, debugWarn } from "@/lib/debug";

/**
 * PushNotificationManager component
 * 
 * This component watches for authentication state changes and:
 * - Registers FCM token when user logs in
 * - Unregisters FCM token when user logs out
 * 
 * Should be placed inside AuthProvider in the component tree.
 */
export function PushNotificationManager() {
    const { user, isFetching } = useAuth();
    const hasRegistered = useRef(false);
    const previousUserId = useRef<number | null>(null);

    useEffect(() => {
        // Don't do anything while auth is still loading
        if (isFetching) {
            return;
        }

        // Check if push notifications are supported
        if (!isPushNotificationSupported()) {
            debugWarn("Push notifications not supported in this browser");
            return;
        }

        const handleAuthChange = async () => {
            // User just logged in
            if (user && !hasRegistered.current) {
                debugLog("User authenticated, registering push notifications...");
                try {
                    const success = await registerFcmPushNotifications();
                    if (success) {
                        debugLog("Push notifications registered for user:", user.id);
                        hasRegistered.current = true;
                        previousUserId.current = user.id;
                    }
                } catch (error) {
                    console.error("Failed to register push notifications:", error);
                }
            }

            // User just logged out (was logged in before)
            if (!user && previousUserId.current) {
                debugLog("User logged out, unregistering push token...");
                try {
                    await unregisterPushToken();
                    hasRegistered.current = false;
                    previousUserId.current = null;
                } catch (error) {
                    console.error("Failed to unregister push token:", error);
                }
            }
        };

        handleAuthChange();
    }, [user, isFetching]);

    // This component doesn't render anything
    return null;
}
