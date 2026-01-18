import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { registerPushNotifications } from "@/lib/permissions";
import { isPushNotificationSupported } from "@/lib/push-notifications";
import { debugLog, debugWarn } from "@/lib/debug";
import { API_BASE_URL } from "@/lib/queryClient";

/**
 * PushNotificationManager component
 * 
 * This component watches for authentication state changes and:
 * - Registers FCM token when user logs in
 * - Clears local FCM token when user logs out
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

        let cancelled = false;

        const handleAuthChange = async () => {
            // User just logged in
            if (user && (!hasRegistered.current || previousUserId.current !== user.id)) {
                debugLog("User authenticated, scheduling push notification registration...");

                // Wait for the session cookie to be properly established
                // This delay ensures the login response cookies are fully processed
                await new Promise(resolve => setTimeout(resolve, 1500));

                if (cancelled) return;

                // Verify the session is actually established before registering
                try {
                    const sessionCheck = await fetch(`${API_BASE_URL}/api/user`, {
                        credentials: "include",
                    });

                    if (!sessionCheck.ok || cancelled) {
                        debugWarn("Session not yet established, skipping FCM registration");
                        return;
                    }

                    const sessionUser = await sessionCheck.json();
                    if (!sessionUser || cancelled) {
                        debugWarn("Session check returned no user, skipping FCM registration");
                        return;
                    }
                } catch (error) {
                    debugWarn("Session verification failed, skipping FCM registration:", error);
                    return;
                }

                debugLog("Session verified, registering push notifications...");
                try {
                    const success = await registerPushNotifications();
                    if (success && !cancelled) {
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
                debugLog("User logged out, clearing local push state...");
                hasRegistered.current = false;
                previousUserId.current = null;
                localStorage.removeItem("fcm_token");
                localStorage.removeItem("fcm_token_needs_sync");
            }
        };

        handleAuthChange();

        return () => {
            cancelled = true;
        };
    }, [user, isFetching]);

    // This component doesn't render anything
    return null;
}
