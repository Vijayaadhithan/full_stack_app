# Mobile, Firebase, and Cloud Integration Guide

Use this document when you want to ship the hybrid (web + Android) experience, configure Firebase phone OTP, or wire optional mobile integrations. The backend currently focuses on session-based auth and does not ship a built-in email or Google OAuth provider.

## 1. Create a Firebase project (OTP + optional FCM)

1. Visit <https://console.firebase.google.com/> and create a new project.
2. Disable Google Analytics unless you already have a property.
3. Open **Project settings -> General** and add a new **Android app**:
   - **Package name**: match `appId` in `capacitor.config.ts` (default: `com.example.app`).
   - **App nickname**: anything (e.g. `DoorStep Android`).
4. Download the generated `google-services.json` file and place it under `android/app/`.
5. Add a **Web app** in Firebase if you want Phone Auth for the web UI and copy the config values.

## 2. Configure Capacitor + Android Studio

1. Install Android Studio, SDK 33+, and JDK 17.
2. Sync Capacitor with the native project:

```bash
npm install
npm run build           # generate latest client bundle
npx cap sync android
```

3. Open the Android project in Android Studio:

```bash
npx cap open android
```

4. Verify `android/app/google-services.json` is present. If you enabled Firebase services (Crashlytics, Messaging), add the corresponding Gradle plugins under `android/app/build.gradle` as instructed by Firebase.
5. Update `android/app/src/main/AndroidManifest.xml` with any required permissions (camera/storage for uploads, network state, etc.).
6. Optional: customize the Capacitor splash screen and app icon using `npx @capacitor/assets generate`.

### Building an APK (debug)

```bash
npx cap run android --target <emulator-name>
# or
./gradlew assembleDebug   # from android/ directory
```

The unsigned debug APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`.

### Building a release-signed APK

1. Create a release keystore:

```bash
keytool -genkey -v -keystore door-step-release.keystore -alias doorstep -keyalg RSA -keysize 2048 -validity 10000
```

2. Move the keystore to `android/app/door-step-release.keystore` (or secure location) and add the credentials to `android/gradle.properties`:

```properties
DOORSTEP_KEYSTORE=door-step-release.keystore
DOORSTEP_KEY_ALIAS=doorstep
DOORSTEP_KEY_PASSWORD=********
DOORSTEP_KEYSTORE_PASSWORD=********
```

3. Edit `android/app/build.gradle` signing config:

```gradle
signingConfigs {
  release {
    storeFile file(DOORSTEP_KEYSTORE)
    storePassword DOORSTEP_KEYSTORE_PASSWORD
    keyAlias DOORSTEP_KEY_ALIAS
    keyPassword DOORSTEP_KEY_PASSWORD
  }
}
buildTypes {
  release {
    signingConfig signingConfigs.release
    minifyEnabled false
  }
}
```

4. Build the signed bundle:

```bash
cd android
./gradlew assembleRelease   # produces app-release.apk
./gradlew bundleRelease     # produces .aab for Play Store
```

## 3. Firebase Phone OTP (optional)

The frontend already includes Firebase helpers in `client/src/lib/firebase.ts`. To enable Phone Auth:

1. Add the Firebase config values to `.env`:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

2. Restart the Vite dev server so the `VITE_` variables are picked up.
3. The Forgot PIN flow uses Firebase Phone Auth by default. If you want rural registration to verify OTP, wire `sendOTP`/`verifyOTP` into `client/src/pages/auth/RuralAuthFlow.tsx`.

## 4. Push notifications (optional)

Capacitor push notification plugins are included on the client, but backend delivery is not wired yet. If you want to enable FCM:

- Configure Firebase Cloud Messaging and include `google-services.json`.
- Add endpoints to register device tokens and send messages from the backend.

## 5. Cloud URLs and remote access

- Set `DEV_SERVER_HOST` and `CAPACITOR_SERVER_URL` for on-device hot reload.
- Use `config/network-config.json` (or `NETWORK_CONFIG_PATH`) when switching between LAN and public URLs.
- For sharing outside your LAN, see `docs/remote-access.md`.

## 6. Optional integrations not wired by default

- **Google OAuth**: The frontend has a Google sign-in button, but the backend route (`/auth/google`) is not implemented. Add it if you want OAuth.
- **Email/SMS providers**: Booking email notifications and SMS providers are not integrated by default; wire your provider of choice if you need them.
