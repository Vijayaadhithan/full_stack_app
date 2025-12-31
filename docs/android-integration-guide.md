# Android Integration & Production Readiness Guide

This guide captures the work required to ship the Capacitor Android build and align backend configuration with mobile needs. It reflects the current codebase behavior (session-based auth, CSRF protection, no Google OAuth backend yet).

---

## 1. Current State Recap

- The web client (React + Vite) is bundled into a Capacitor Android shell (`android/`).
- Auth is session-based (cookies + CSRF token). The client fetches `/api/csrf-token` automatically.
- Rural auth uses phone + PIN; Forgot PIN uses Firebase Phone Auth if configured.
- Google OAuth is not implemented in the backend (`/auth/google` is missing).
- CORS is configurable via `.env` or `config/network-config.json`.

---

## 2. Android Project Setup

### 2.1 Required Tooling

- Android Studio (latest stable)
- Android SDK 33+
- Java 17
- Capacitor CLI (`npx cap doctor`)

### 2.2 Local Configuration

1. Ensure `android/local.properties` points to your SDK path.
2. Install dependencies at repo root: `npm install`.
3. Build and sync the web assets:

```bash
npm run build
npx cap sync android
```

4. Open the project in Android Studio:

```bash
npx cap open android
```

### 2.3 Rename the Application

Update identifiers:

- `capacitor.config.ts` and `android/capacitor.config.ts`: set `appId` and `appName`.
- `android/app/build.gradle`: change `namespace`, `applicationId`, `versionCode`, `versionName`.
- `android/app/src/main/AndroidManifest.xml`: update labels.
- `android/app/src/main/res/values/strings.xml`: update `app_name`, `title_activity_main`, `package_name`.
- Java/Kotlin package path under `android/app/src/main/java/...`.

---

## 3. Backend Configuration for Android

### 3.1 API Base URLs

The client resolves the API base URL in this order:

- `VITE_API_URL`
- `VITE_APP_BASE_URL`
- `VITE_FALLBACK_API_URL`

For production Android builds, set `VITE_API_URL` to your HTTPS API domain before running `npm run build`.

### 3.2 CORS and Cookies

- In development, CORS is relaxed by default unless `STRICT_CORS=true`.
- In production, add your Android WebView origins to `ALLOWED_ORIGINS`, for example:

```
ALLOWED_ORIGINS=https://app.yourdomain.com,https://api.yourdomain.com,capacitor://localhost
```

- Session cookies are configured via `SESSION_COOKIE_SAMESITE`, `SESSION_COOKIE_SECURE`, and `SESSION_COOKIE_DOMAIN`.

### 3.3 CSRF Tokens

The web client automatically fetches `/api/csrf-token` and sends `x-csrf-token` for non-GET requests. If you build a custom native wrapper, ensure you either:

- Call `/api/csrf-token` and include the header, or
- Use a Bearer token (Authorization header bypasses CSRF checks).

---

## 4. Authentication Guidance

- **Phone + PIN**: `/api/auth/check-user`, `/api/auth/login-pin`, `/api/auth/rural-register`.
- **Worker login**: `/api/auth/worker-login` (worker number + PIN).
- **Forgot PIN**: Firebase Phone Auth on the client + `/api/auth/reset-pin` on the server.

Google OAuth is not currently wired. If you need it, implement `/auth/google` on the backend and update CORS and redirect URLs accordingly.

---

## 5. Firebase / OTP (Optional)

- Configure Firebase Phone Auth and set `VITE_FIREBASE_*` in `.env`.
- The Forgot PIN UI already uses Firebase OTP.
- To verify OTP during rural registration, wire `sendOTP` and `verifyOTP` in `RuralAuthFlow.tsx`.

---

## 6. Push Notifications (Optional)

Capacitor push plugins are included on the client, but backend delivery is not implemented. Add endpoints to register device tokens and send notifications if needed.

---

## 7. Backend Production Checklist

Set these before deploying:

- `NODE_ENV=production`
- `DATABASE_URL=...`
- `SESSION_SECRET=<strong random value>`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- `APP_BASE_URL=https://api.yourdomain.com`
- `FRONTEND_URL=https://app.yourdomain.com`
- `ALLOWED_ORIGINS=...`
- `REDIS_URL=...`

Also tune:

- Job schedules (`BOOKING_EXPIRATION_CRON`, `PAYMENT_REMINDER_CRON`, `LOW_STOCK_DIGEST_CRON`)
- Rate limiters (`DISABLE_RATE_LIMITERS=false`)
- Logging (`LOG_LEVEL`, `LOG_FILE_PATH`)

---

## 8. Android Release Checklist

- Replace icons and splash screen assets.
- Audit permissions and remove unused ones.
- Increment `versionCode` / `versionName` for each release.
- Enable R8/ProGuard as needed.
- Sign with a release keystore.
- Test on physical devices and emulators.

---

## 9. Post-Deployment Checks

- Verify session cookies are `Secure`, `HttpOnly`, and scoped correctly.
- Confirm CSRF tokens are accepted from the mobile client.
- Monitor logs and `/api/admin/monitoring/summary` for error spikes.
