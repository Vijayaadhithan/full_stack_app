# Mobile, Firebase, and Cloud Integration Guide

Use this document whenever you need to ship the hybrid (web + Android) experience, configure push/email providers, or enable Google Sign-In in production. Follow the sections in order the first time you set things up.

## 1. Create a Firebase project

1. Visit [console.firebase.google.com](https://console.firebase.google.com/) and create a new project.
2. Disable Google Analytics unless you already have a property.
3. Once provisioned, open **Project settings → General** and add a new **Android app**:
   - **Package name**: match `appId` in `capacitor.config.ts` (default: `com.doorstep.app`).
   - **App nickname**: anything (e.g., `DoorStep Android`).
   - **Debug signing certificate**: optional during dev, paste `keytool -list -v -alias androiddebugkey -keystore ~/.android/debug.keystore` output if you plan to use Google auth via Firebase.
4. Download the generated `google-services.json` file and place it under `android/app/`.
5. In the same settings screen copy your **Web API Key**—add it to the frontend as `VITE_FIREBASE_API_KEY` if you plan to use Firebase SDKs in the browser.

## 2. Configure Capacitor + Android Studio

1. Ensure the Android toolchain is installed (Android Studio, SDK 33+, JDK 17).
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

```
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

## 3. Push notifications (optional)

If you plan to send push notifications, enable **Cloud Messaging** in Firebase and store the server key in your backend `.env` as `FIREBASE_SERVER_KEY`. Use the Capacitor Push Notifications plugin on the client.

## 4. Email (SMTP) configuration

The backend uses Nodemailer. Provide these environment variables (already surfaced in `README.md`):

```
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=465
SMTP_USER=apikey-or-username
SMTP_PASSWORD=super-secret
EMAIL_FROM="DoorStep <no-reply@doorstep.in>"
```

For Gmail use [App Passwords](https://support.google.com/accounts/answer/185833) (2FA required) or set up a dedicated SMTP provider (SendGrid, Mailgun). Test with `npm run dev:server` and hit `/api/verify-email` flow to ensure outbound mail succeeds.

## 5. Google OAuth configuration

1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → create OAuth 2.0 Client IDs for both **Web** and **Android** (if you use Google Sign-In natively).
2. Add the following to the Web client:
   - Authorized JavaScript origins: your production frontend, `http://localhost:5173`
   - Authorized redirect URIs: `https://<api>/auth/google/callback`, `http://localhost:5000/auth/google/callback`
3. Save the client ID/secret in `.env`:

   ```env
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   FRONTEND_URL=https://your-frontend
   APP_BASE_URL=https://your-api
   ```

4. For Android Google Sign-In, configure the SHA-1 fingerprint and package name in Google Cloud → Credentials, download `google-services.json`, and add the `com.google.android.gms:play-services-auth` dependency in Android if you plan to call Google Sign-In natively.

## 6. Putting it all together

1. Fill out `.env` with DB, SMTP, Google OAuth, admin bootstrap credentials.
2. Run migrations: `npm run db:migrate`.
3. Start the API and client: `npm run dev:server`, `npm run dev:client`.
4. For mobile testing, ensure LAN hosts (`HOST=0.0.0.0`, `DEV_SERVER_HOST`) are set, then run `npx cap run android`.
5. Use the new README sections for observability and debugging; inspect `logs/app.log` for slow-request timing entries.

With these steps you can build the mobile APK, configure Firebase-backed features, and wire up Google+email integrations without hunting through the codebase.
