import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.example.app",
  appName: "DoorStep",
  webDir: "dist/public",
  server: {
    androidScheme: "http",
    allowNavigation: [
      // Add your computer's local IP address here
      // e.g., '192.168.1.100:5000'
    ],
  },
};

export default config;
