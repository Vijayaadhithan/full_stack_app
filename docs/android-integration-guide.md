# Android Integration & Production Readiness Guide

This document captures the outstanding work required to finish the Android deliverable for the DoorStep/IndianBudgetTracker project. It covers environment setup, bridging the existing backend to a Capacitor-based Android shell, enabling Google authentication, and preparing both backend and Android builds for production.

---

## 1. Current State Recap
- The web client (React + Vite) already consumes the Express backend via `fetch` calls that rely on cookies (`credentials: "include"`).
- The Capacitor Android shell exists (`android/`), but retains default identifiers (`com.example.app`) and has not been wired up to use production APIs or Google Sign-In.
- Server CORS is limited to browser origins (`server/index.ts`), so Android-origin requests would currently be rejected.
- Google OAuth on the backend (`server/auth.ts`) redirects to `FRONTEND_URL`; no mobile-specific callback exists yet.

---

## 2. Android Project Setup

### 2.1 Required Tooling
- Android Studio (latest stable) with Android SDK 35, build tools 35.x.
- Java 17 (Android Gradle Plugin 8.x requirement).
- Capacitor CLI (`npx cap doctor` should report all green).

### 2.2 Local Configuration
1. Ensure `android/local.properties` points to your local SDK (`sdk.dir=/Users/<you>/Library/Android/sdk`).
2. Run `npm install` at repo root to guarantee matching Capacitor versions.
3. Generate web assets before each native build:
   ```bash
   npm run build
   npx cap sync android
   ```
   This populates `android/app/src/main/assets/public` with the latest frontend build.

### 2.3 Rename the Application
Update every placeholder to your final identifiers:
- `capacitor.config.ts` and `android/capacitor.config.ts`: set `appId` and `appName`.
- `android/app/build.gradle`: change `namespace`, `applicationId`, `versionCode`, `versionName`.
- `android/app/src/main/AndroidManifest.xml`: ensure `<application android:label>` and `<activity android:label>` reference the desired app name.
- `android/app/src/main/res/values/strings.xml`: update `app_name`, `title_activity_main`, `package_name`, `custom_url_scheme`.
- Java/Kotlin package path: rename `android/app/src/main/java/com/example/app` to match the new package (or convert to Kotlin if preferred). Update the `package` statement in `MainActivity` accordingly.

> Tip: use `npx cap copy android` after renaming packages so generated files stay in sync.

---

## 3. Wiring the Backend for Android

### 3.1 API Base URLs
- Define `VITE_API_URL` in your `.env` (and `.env.production`) for the frontend build; Android must ship with the production HTTPS API endpoint:
  ```dotenv
  VITE_API_URL="https://api.yourdomain.com"
  ```
- For non-production builds, create `.env.staging` or `.env.dev` with the appropriate base URL and run `VITE_API_URL=... npm run build` before syncing.

### 3.2 Session/CORS Configuration
Adjust `server/index.ts` so Android-origin requests are accepted and cookies survive:
- Extend `allowedOrigins` to include:
  - `"capacitor://localhost"`
  - `"http://localhost"` (useful when debugging via emulator serving from dev machine)
  - Each deployed web origin (`https://app.yourdomain.com`).
- Example snippet (`server/index.ts:25`):
  ```ts
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.ANDROID_WEBVIEW_ORIGIN, // e.g. capacitor://localhost
    "http://localhost:5173",
    "capacitor://localhost",
  ].filter(Boolean) as string[];
  ```
- Add a dedicated env var (`ANDROID_WEBVIEW_ORIGIN`) so production config stays declarative.
- Ensure the Express `cors` middleware uses `credentials: true` (already handled) and that the session cookie is configured with:
  - `sameSite: "none"` **only** if you stay on cross-domain HTTPS.
  - `secure: true` when `NODE_ENV=production` (already present).

### 3.3 Network Security & HTTPS
- Production Android builds must hit HTTPS APIs. Set `server.androidScheme` in `capacitor.config.ts` to `https` and remove `allowNavigation` entries before release.
- If you must test against HTTP during development, configure a [network security config](https://developer.android.com/training/articles/security-config) that allows cleartext only for your dev host and add `android:usesCleartextTraffic="true"` in the debug manifest (not main manifest).

### 3.4 File Uploads & Permissions
- The app currently requests legacy storage permissions (`READ/WRITE_EXTERNAL_STORAGE`). Audit whether the web app still needs them; if not, remove these from `AndroidManifest.xml` to comply with Play policies.
- For camera/gallery uploads within Capacitor, consider using modern scoped storage permissions (`READ_MEDIA_IMAGES` on API 33+). Update permission prompts and test uploads end-to-end.

### 3.5 Background Services & Jobs
- If any backend cron jobs send notifications or rely on time zone logic, verify Android clients receive updates via polling or push (see §5).

---

## 4. Google Authentication Bridging

The backend uses Passport’s web-based OAuth flow, which redirects to `FRONTEND_URL`. Native Android apps cannot register `capacitor://localhost` as a valid OAuth redirect URI, so choose one of these approaches:

### Option A – Hosted Web Callback + Deep Link (Recommended if you host the web app)
1. **Host the web client** at a real HTTPS domain (e.g. `https://app.yourdomain.com`).
2. **Update OAuth Client in Google Cloud Console**:
   - Authorized JavaScript origins: add your hosted web domain.
   - Authorized redirect URI: `https://api.yourdomain.com/auth/google/callback`.
3. **Configure Mobile Deep Link**:
   - Add an `<intent-filter>` in `AndroidManifest.xml` under `MainActivity` for a custom scheme (`doorstep://auth-callback`).
   - Update backend success redirect (`server/auth.ts:409`) to send mobile users to that deep link when `req.session.returnTo` equals a mobile flag (store flag before redirect).
   - In the web app, before sending users to `/auth/google`, set a query flag (e.g. `?source=android`) so the backend knows to deep-link on success.
4. **Handle Deep Link in Capacitor**:
   - Install `@capacitor/app` and register a listener for `appUrlOpen` to route users to `/customer`, `/provider`, etc. inside the SPA.

### Option B – Native Google Sign-In + Backend Token Exchange
1. Add `com.google.android.gms:play-services-auth` to `android/app/build.gradle`.
2. Use a Capacitor plugin (e.g. `@capacitor/google-sign-in` or `@codetrix-studio/capacitor-google-auth`) to obtain the user’s ID token on Android.
3. Create a new backend endpoint (e.g. `POST /auth/google/mobile`) that:
   - Verifies the ID token with Google.
   - Looks up/creates the user (reuse logic from Passport strategy).
   - Establishes a session (set cookie) or returns a JWT for mobile clients.
4. Update the Android-side auth screens to call this endpoint and persist the returned session token (for cookie-based flow, use Capacitor’s `CapacitorHttp` with `webFetch` disabled so cookies are honoured).

*Decision Point:* choose one approach early; it affects both backend changes and mobile UX.

### Additional OAuth Tasks
- Add package name and SHA-1 fingerprint to Google Cloud Console once you sign the app (required for native Sign-In or if you ship via Play Store).
- Store secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) securely using environment variables on the server and `strings.xml` (only the web client ID is safe to embed).

---

## 5. Push Notifications / Firebase (Optional but Dependency Present)
- `android/app/build.gradle` already pulls `firebase-messaging`. Supply `google-services.json` (downloaded from Firebase) under `android/app/` and ensure it is excluded from version control if containing secrets.
- Verify the backend can send FCM tokens to your notification service; if not, add endpoints to register/unregister device tokens.
- Update manifest with a `FirebaseMessagingService` subclass if you plan to handle background messages.
- Ensure Play compliance by providing a privacy policy covering push usage.

---

## 6. Backend Production Configuration Checklist
Update `.env` (or platform environment variables) before deploying:
- `NODE_ENV=production`
- `PORT=5000` (or whichever port the hosting platform maps)
- `APP_BASE_URL=https://api.yourdomain.com`
- `FRONTEND_URL=https://app.yourdomain.com`
- `ANDROID_WEBVIEW_ORIGIN=capacitor://localhost`
- `SESSION_SECRET=<strong-random-string>`
- `DATABASE_URL=postgres://…`
- `DB_POOL_SIZE`, `DB_SLOW_THRESHOLD_MS` tuned for production workload.
- `REDIS_URL` if you plan to use Redis-backed session storage.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `EMAIL_SENDER` for OAuth/email flows.
- Cron-related envs (`BOOKING_EXPIRATION_CRON`, `PAYMENT_REMINDER_CRON`, `CRON_TZ`) set to production cadence.

Also:
- Confirm HTTPS termination (reverse proxy or platform) forwards the `X-Forwarded-Proto` header so Express can set secure cookies correctly.
- Enable logging to file by setting `LOG_FILE_PATH` and `LOG_LEVEL` according to monitoring needs.
- Decide whether to enable rate limiters differently for production (tune values in `server/security/rateLimiters.ts`).

---

## 7. Android Release Checklist
- **Branding**: Replace launcher icons (`android/app/src/main/res/mipmap-*`) and adaptive icons as per design specs.
- **Splash Screen**: Configure `styles.xml` and `drawable/splash.xml` if using Capacitor Splash Screen plugin.
- **Permissions Audit**: Remove unused permissions; add justifications for those kept.
- **Versioning**: Increment `versionCode`/`versionName` for every release (`build.gradle`).
- **Code Shrinking**: Enable R8/ProGuard (`minifyEnabled true`, `shrinkResources true`) and adjust `proguard-rules.pro` to keep Capacitor/React classes.
- **Signing**: Generate a keystore (`keytool ...`), store it securely, and add a `signingConfigs` block in `build.gradle`. Never commit the keystore.
- **Build Commands**:
  ```bash
  cd android
  ./gradlew clean
  ./gradlew bundleRelease   # Upload to Play Store
  ./gradlew assembleRelease # APK for sideload/testing
  ```
- **Testing**: Run instrumentation tests (`./gradlew connectedAndroidTest`) on Firebase Test Lab or physical devices covering minSdk and targetSdk.
- **App Bundle Validation**: Use `bundletool` or Play Console’s pre-launch report to ensure no runtime crashes.

---

## 8. QA & Monitoring
- Create manual test cases that mirror primary backend flows (login, listing browsing, checkout, bookings, payments, uploads, notifications).
- Verify cookie-based sessions survive app restarts (Capacitor leverages Android WebView cookie store).
- Instrument crash reporting (Firebase Crashlytics or Sentry for Android). Add DSNs to secure storage.
- Monitor backend health (PM2 logs, pino output, database metrics) after mobile release; adjust rate limits if mobile traffic changes load patterns.

---

## 9. Outstanding Engineering Tasks
1. Update CORS and session logic to recognise Android origin and deep-link redirects (`server/index.ts`, `server/auth.ts`).
2. Decide and implement the Google Sign-In flow for mobile (Option A or B) including frontend changes.
3. Audit and prune Android permissions; implement scoped storage if required.
4. Replace placeholder IDs/names/icons; refactor Java package to match final domain.
5. Add environment-specific build steps (scripts for `npm run build:android:staging`, etc.).
6. Document release process in the repo (link this guide from `README.md`).
7. Configure CI to build and test the Android app (GitHub Actions, Bitrise, etc.) for regression protection.

---

## 10. Post-Deployment Checks
- Confirm session cookies are `Secure`, `HttpOnly`, and have reasonable expiry.
- Ensure `helmet` HSTS is active in production (auto-enabled when `NODE_ENV=production`).
- Monitor Google OAuth quota and refresh token usage.
- Review server logs for 401/403 spikes from mobile clients to catch CORS/cookie regressions early.

Keep this document updated as you implement each bullet so future releases remain smooth.
