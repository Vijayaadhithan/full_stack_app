/**
 * Permissions module - Web-only version
 * Uses standard browser APIs instead of Capacitor
 * 
 * Note: For the native Android app, permissions are handled natively.
 * This file is for the web frontend only.
 */

import {
  registerPushNotifications as registerFcmPushNotifications,
  isPushNotificationSupported,
  setupForegroundMessageHandler
} from "./push-notifications";

// --- Geolocation Permissions ---

export const checkLocationPermission = async (): Promise<string> => {
  if (!navigator.geolocation) {
    return "unsupported";
  }

  if (navigator.permissions) {
    try {
      const result = await navigator.permissions.query({ name: "geolocation" });
      return result.state; // "granted", "denied", or "prompt"
    } catch (e) {
      console.warn("Error checking location permission:", e);
      return "unknown";
    }
  }

  return "unknown";
};

export const requestLocationPermission = async (): Promise<string> => {
  if (!navigator.geolocation) {
    return "unsupported";
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve("granted"),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve("denied");
        } else {
          resolve("error");
        }
      },
      { timeout: 5000 }
    );
  });
};

export const getCurrentPosition = async (): Promise<GeolocationPosition | null> => {
  if (!navigator.geolocation) {
    console.warn("Geolocation not supported");
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("Current position:", position);
        resolve(position);
      },
      (error) => {
        console.error("Error getting location:", error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  });
};

// --- Notification Permissions ---

export const checkNotificationPermission = async (): Promise<string> => {
  if (!("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission; // "granted", "denied", or "default"
};

export const requestNotificationPermission = async (): Promise<string> => {
  if (!("Notification" in window)) {
    return "unsupported";
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (e) {
    console.error("Error requesting notification permission:", e);
    return "denied";
  }
};

export const showNotification = (title: string, options?: NotificationOptions): void => {
  if (!("Notification" in window)) {
    console.warn("Notifications not supported");
    return;
  }

  if (Notification.permission === "granted") {
    new Notification(title, options);
  } else {
    console.warn("Notification permission not granted");
  }
};

// --- Storage Permissions ---
// Web storage (localStorage, sessionStorage) doesn't require explicit permissions

export const checkStoragePermission = async (): Promise<boolean> => {
  try {
    localStorage.setItem("__test__", "test");
    localStorage.removeItem("__test__");
    return true;
  } catch (e) {
    console.warn("Storage access restricted:", e);
    return false;
  }
};

// --- Push Notifications (Web with FCM) ---
// For Firebase Cloud Messaging based push notifications

export const registerPushNotifications = async (): Promise<boolean> => {
  if (!isPushNotificationSupported()) {
    console.log("Push notifications not supported in this browser");
    return false;
  }

  try {
    // Check if permission already granted
    if (Notification.permission !== "granted") {
      const permission = await requestNotificationPermission();
      if (permission !== "granted") {
        console.warn("Notification permission denied");
        return false;
      }
    }

    // Register with FCM and backend
    const success = await registerFcmPushNotifications();
    if (success) {
      console.log("FCM push notifications registered successfully");

      // Set up foreground message handler to show toasts
      setupForegroundMessageHandler((payload) => {
        // Show a browser notification for foreground messages
        if (Notification.permission === "granted" && payload.title) {
          new Notification(payload.title, {
            body: payload.body || "",
            icon: "/icon-192.png",
          });
        }
      });
    }
    return success;
  } catch (e) {
    console.error("Error registering push notifications:", e);
    return false;
  }
};

export const initializePushNotifications = async (): Promise<void> => {
  // Delay push notification registration to avoid blocking initial load
  // Also wait a bit to ensure user is authenticated
  setTimeout(async () => {
    const registered = await registerPushNotifications();
    if (registered) {
      console.log("Push notifications initialized with FCM");
    }
  }, 3000); // Wait 3 seconds after page load
};

// --- Placeholder functions for compatibility ---
// These are no-ops since we don't have native capabilities on web

export const addPushNotificationListeners = (): void => {
  // No-op on web
};

export const scheduleLocalNotification = async (): Promise<void> => {
  // Use web notifications instead
  if (Notification.permission === "granted") {
    new Notification("Test Notification", {
      body: "This is a test notification!",
      icon: "/favicon.ico",
    });
  }
};

export const writeFileToStorage = async (
  _fileName: string,
  _data: string
): Promise<boolean> => {
  console.warn("File storage is handled differently on web");
  return false;
};

// For testing
export function __setPermissionsDepsForTesting(
  _overrides: Record<string, unknown>
): void {
  // No-op for web
}
