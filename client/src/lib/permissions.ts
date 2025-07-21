import { Geolocation } from "@capacitor/geolocation";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications, Token } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";

// --- Geolocation Permissions ---
export const checkLocationPermission = async (): Promise<string> => {
  try {
    const status = await Geolocation.checkPermissions();
    return status.location;
  } catch (e) {
    console.error("Error checking location permission:", e);
    return "denied"; // Default to denied on error
  }
};

export const requestLocationPermission = async (): Promise<string> => {
  try {
    const status = await Geolocation.requestPermissions();
    return status.location;
  } catch (e) {
    console.error("Error requesting location permission:", e);
    return "denied";
  }
};

export const getCurrentPosition = async () => {
  try {
    const permission = await requestLocationPermission();
    if (permission === "granted") {
      const coordinates = await Geolocation.getCurrentPosition();
      console.log("Current position:", coordinates);
      return coordinates;
    } else {
      console.warn("Location permission not granted.");
      return null;
    }
  } catch (e) {
    console.error("Error getting current position:", e);
    return null;
  }
};

// --- Filesystem (Storage) Permissions (Approximation) ---
// Note: Capacitor's Filesystem API doesn't have explicit permission checks like Geolocation.
// Permissions are generally handled by the OS when the app tries to read/write.
// We'll simulate a check by trying a benign read operation.

export const checkStoragePermission = async (): Promise<boolean> => {
  try {
    // Try to read a non-existent file to see if basic access is allowed.
    // This is an indirect way to check if storage is generally accessible.
    await Filesystem.readFile({
      path: "capacitor.check.txt",
      directory: Directory.Data, // Or Directory.Documents / Directory.ExternalStorage depending on need
      encoding: Encoding.UTF8,
    });
    return true; // If it doesn't throw, we assume some level of access
  } catch (e: any) {
    if (
      e.message === "File does not exist." ||
      e.message === "File not found"
    ) {
      // This is an expected error if the file doesn't exist, implies we can try to access storage
      return true;
    }
    console.warn("Storage access might be restricted:", e);
    return false; // Other errors might indicate a permission issue
  }
};

// Example: Writing a file (implicitly requests permission if needed on some platforms/versions)
export const writeFileToStorage = async (fileName: string, data: string) => {
  try {
    await Filesystem.writeFile({
      path: fileName,
      data: data,
      directory: Directory.Data, // Choose appropriate directory
      encoding: Encoding.UTF8,
    });
    console.log("File written successfully:", fileName);
    const contents = await Filesystem.readFile({
      path: fileName,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    console.log("File content:", contents.data);
    return true;
  } catch (e) {
    console.error("Error writing file:", e);
    return false;
  }
};

// --- Local Notifications Permissions ---
export const checkNotificationPermission = async (): Promise<string> => {
  try {
    const status = await LocalNotifications.checkPermissions();
    return status.display;
  } catch (e) {
    console.error("Error checking notification permission:", e);
    return "denied";
  }
};

export const requestNotificationPermission = async (): Promise<string> => {
  try {
    const status = await LocalNotifications.requestPermissions();
    return status.display;
  } catch (e) {
    console.error("Error requesting notification permission:", e);
    return "denied";
  }
};

export const scheduleLocalNotification = async () => {
  try {
    const permission = await requestNotificationPermission();
    if (permission === "granted") {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: "Test Notification",
            body: "This is a test local notification!",
            id: 1,
            schedule: { at: new Date(Date.now() + 1000 * 5) }, // 5 seconds from now
            sound: undefined,
            attachments: undefined,
            actionTypeId: "",
            extra: null,
          },
        ],
      });
      console.log("Local notification scheduled");
    } else {
      console.warn("Notification permission not granted.");
    }
  } catch (e) {
    console.error("Error scheduling local notification:", e);
  }
};

// --- Push Notifications ---
// Basic setup, registration, and listeners.
// Full implementation requires a backend service (e.g., Firebase Cloud Messaging).

export const registerPushNotifications = async () => {
  if (!Capacitor.isNativePlatform()) {
    console.log("Push notifications not supported on web.");
    return false;
  }
  let permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === "prompt") {
    permStatus = await PushNotifications.requestPermissions();
  }

  if (permStatus.receive !== "granted") {
    console.warn("Push notification permission not granted.");
    return false;
  }

  // Register with Apple / Google to receive push via APNS/FCM
  await PushNotifications.register();
  return true;
};

export const addPushNotificationListeners = () => {
  if (!Capacitor.isNativePlatform()) {
    return; // Do nothing on web
  }
  // On success, we should be able to receive notifications
  PushNotifications.addListener("registration", (token: Token) => {
    console.info("Push registration success, token: " + token.value);
    // Send token to your server here to store it for sending pushes
  });

  // Some issue with registration, perhaps definitional
  PushNotifications.addListener("registrationError", (error: any) => {
    console.error("Error on push registration: " + JSON.stringify(error));
  });

  // Show us the notification payload if the app is open on our device
  PushNotifications.addListener(
    "pushNotificationReceived",
    (notification: any) => {
      console.log("Push received: " + JSON.stringify(notification));
      // You might want to display a local notification here if the app is in the foreground
      // or update UI based on the payload
    },
  );

  // Method called when tapping on a notification
  PushNotifications.addListener(
    "pushNotificationActionPerformed",
    (notification: any) => {
      console.log("Push action performed: " + JSON.stringify(notification));
      // Navigate to a specific screen or perform an action based on the notification
    },
  );
};

// Call this early in your app's lifecycle, e.g., in App.tsx
export const initializePushNotifications = async () => {
  if (!Capacitor.isNativePlatform()) {
    console.log("Skipping push notification initialization on web.");
    return;
  }
  const registered = await registerPushNotifications();
  if (registered) {
    addPushNotificationListeners();
  }
};

// --- General Notes ---
// 1. Web Functionality: Most of your existing web application logic (UI rendering, API calls to your backend)
//    should work as is within the Capacitor WebView. Capacitor primarily bridges native device features.
// 2. In-App Notifications: If your current "in-app notifications" are custom UI elements displayed within your web app's HTML/JS,
//    they will continue to work. The LocalNotifications and PushNotifications plugins are for native OS-level notifications.
//    You can, however, trigger your existing in-app notification UI when a push notification is received while the app is open.
// 3. Contacts: Accessing device contacts typically requires a dedicated Cordova plugin (e.g., `cordova-plugin-contacts`)
//    and setting it up with Capacitor. This is a more involved process than the direct Capacitor plugins.
