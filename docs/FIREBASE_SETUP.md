# Firebase Phone Authentication Setup Guide

## Overview

This guide explains how to enable Firebase Phone Auth (OTP) for the DoorStep frontend. The project already includes a Firebase helper (`client/src/lib/firebase.ts`) and the Forgot PIN flow uses it when configured.

---

## 1. Create a Firebase Project

1. Go to <https://console.firebase.google.com/>
2. Click **Create project**
3. Disable Google Analytics unless you need it

---

## 2. Enable Phone Authentication

1. Open **Authentication** in the Firebase console
2. Go to **Sign-in method**
3. Enable **Phone**
4. Save

---

## 3. Add a Web App

1. Open **Project settings**
2. Add a **Web app**
3. Copy the Firebase config values (apiKey, authDomain, projectId, etc.)

---

## 4. Configure Environment Variables

Add the Firebase config to `.env`:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

Restart `npm run dev:client` after editing `.env`.

---

## 5. Client Integration Notes

- `client/src/lib/firebase.ts` reads the `VITE_FIREBASE_*` variables and initializes Firebase.
- `client/src/pages/auth/ForgotPassword.tsx` uses Firebase OTP by default.
- `client/src/pages/auth/RuralAuthFlow.tsx` currently treats OTP as a UI step. If you want to enforce real OTP verification during rural registration, wire `sendOTP` and `verifyOTP` from `client/src/lib/firebase.ts`.

---

## 6. Test Phone Numbers (Development)

1. Firebase Console -> **Authentication** -> **Sign-in method**
2. Add a test number (e.g. `+919999999999`) with a test code (e.g. `123456`)
3. Use the test number to bypass real SMS delivery

---

## 7. Production Notes

- Firebase Phone Auth uses reCAPTCHA in web flows. Ensure your domains are allowed.
- Use a restricted API key for production domains.

---

## Troubleshooting

- **auth/invalid-api-key**: check `VITE_FIREBASE_API_KEY`
- **auth/operation-not-allowed**: enable Phone auth in Firebase
- **auth/too-many-requests**: rate limited by Firebase; wait and retry
- **reCAPTCHA not loading**: ensure your domain is authorized
