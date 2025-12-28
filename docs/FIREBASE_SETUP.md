# Firebase Phone Authentication Setup Guide

## Overview

This guide helps you set up Firebase Phone Authentication for OTP verification in the DoorStepTN rural-first authentication flow.

---

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"** or **"Add project"**
3. Enter project name: `doorstep-tn` (or your preferred name)
4. Disable Google Analytics (optional for development)
5. Click **"Create project"**

---

## Step 2: Enable Phone Authentication

1. In Firebase Console, go to **Authentication** (left sidebar)
2. Click **"Get started"** if first time
3. Go to **"Sign-in method"** tab
4. Click on **"Phone"**
5. Toggle **Enable** to ON
6. Click **Save**

---

## Step 3: Add Web App to Firebase

1. In Firebase Console, click the **gear icon** → **Project settings**
2. Scroll down to **"Your apps"** section
3. Click the **web icon** (`</>`) to add a web app
4. Enter app nickname: `doorstep-web`
5. Check **"Also set up Firebase Hosting"** (optional)
6. Click **"Register app"**
7. **Copy the Firebase config** - you'll need this!

The config looks like this:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456"
};
```

---

## Step 4: Install Firebase SDK

Run in your project directory:

```bash
npm install firebase
```

---

## Step 5: Create Firebase Config File

Create `client/src/lib/firebase.ts`:

```typescript
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  RecaptchaVerifier, 
  signInWithPhoneNumber,
  ConfirmationResult
} from "firebase/auth";

// Replace with your Firebase config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Store confirmation result globally
let confirmationResult: ConfirmationResult | null = null;

// Initialize reCAPTCHA verifier (invisible)
export function initRecaptcha(buttonId: string) {
  if (typeof window === "undefined") return null;
  
  const recaptchaVerifier = new RecaptchaVerifier(auth, buttonId, {
    size: "invisible",
    callback: () => {
      // reCAPTCHA solved, allow signInWithPhoneNumber
      console.log("reCAPTCHA verified");
    },
    "expired-callback": () => {
      // Response expired, re-verify
      console.log("reCAPTCHA expired");
    }
  });

  return recaptchaVerifier;
}

// Send OTP to phone number
export async function sendOTP(
  phoneNumber: string, 
  recaptchaVerifier: RecaptchaVerifier
): Promise<boolean> {
  try {
    // Format phone number with country code
    const formattedPhone = phoneNumber.startsWith("+91") 
      ? phoneNumber 
      : `+91${phoneNumber}`;
    
    confirmationResult = await signInWithPhoneNumber(
      auth, 
      formattedPhone, 
      recaptchaVerifier
    );
    
    return true;
  } catch (error) {
    console.error("Error sending OTP:", error);
    throw error;
  }
}

// Verify OTP code
export async function verifyOTP(otpCode: string): Promise<string | null> {
  if (!confirmationResult) {
    throw new Error("No OTP request pending");
  }
  
  try {
    const result = await confirmationResult.confirm(otpCode);
    // Return the Firebase ID token for backend verification (optional)
    const idToken = await result.user.getIdToken();
    return idToken;
  } catch (error) {
    console.error("Error verifying OTP:", error);
    throw error;
  }
}
```

---

## Step 6: Add Environment Variables

Add to your `.env` file:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

Then update `firebase.ts` to use env variables:

```typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
```

---

## Step 7: Update RuralAuthFlow Component

Update `client/src/pages/auth/RuralAuthFlow.tsx` to use Firebase:

```typescript
import { initRecaptcha, sendOTP, verifyOTP } from "@/lib/firebase";
import { RecaptchaVerifier } from "firebase/auth";

// Inside the component:
const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);

// Initialize reCAPTCHA on mount
useEffect(() => {
  const verifier = initRecaptcha("otp-button");
  if (verifier) {
    setRecaptchaVerifier(verifier);
  }
}, []);

// Update handlePhoneSubmit to send real OTP
async function handlePhoneSubmit() {
  if (phone.length !== 10 || !/^\d{10}$/.test(phone)) {
    toast({ title: "Invalid phone", description: "Please enter 10 digits", variant: "destructive" });
    return;
  }

  setIsLoading(true);
  try {
    const res = await apiRequest("POST", "/api/auth/check-user", { phone });
    const data = await res.json();

    localStorage.setItem("lastPhone", phone);

    if (data.exists) {
      setIsExistingUser(true);
      setUserName(data.name || "");
      setStep("pin-entry"); // Skip OTP for existing users with PIN
    } else {
      setIsExistingUser(false);
      
      // Send OTP via Firebase
      if (recaptchaVerifier) {
        await sendOTP(phone, recaptchaVerifier);
        toast({ title: "OTP Sent", description: `OTP sent to ${phone}` });
      }
      setStep("otp");
    }
  } catch (error) {
    toast({ title: "Error", description: "Could not send OTP", variant: "destructive" });
  } finally {
    setIsLoading(false);
  }
}

// Update handleOtpVerify to use Firebase
async function handleOtpVerify() {
  if (otp.length !== 6) {
    toast({ title: "Invalid OTP", description: "Please enter 6 digits", variant: "destructive" });
    return;
  }

  setIsLoading(true);
  try {
    await verifyOTP(otp);
    toast({ title: "Verified!", description: "Phone number verified" });
    setStep("profile-setup");
  } catch (error) {
    toast({ title: "Invalid OTP", description: "Please check and try again", variant: "destructive" });
  } finally {
    setIsLoading(false);
  }
}

// Add invisible reCAPTCHA button in the JSX:
<button id="otp-button" style={{ display: "none" }} />
```

---

## Step 8: Test Phone Numbers (Development)

For testing without real SMS:

1. Go to Firebase Console → **Authentication** → **Sign-in method**
2. Scroll to **"Phone numbers for testing"**
3. Click **"Add phone number for testing"**
4. Add: `+919999999999` with code: `123456`
5. Use this number in development

---

## Step 9: Enable reCAPTCHA for Production

For production, you need to:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to **APIs & Services** → **Credentials**
4. Create a new **API key** with domain restrictions
5. Add your domain to the allowed list

---

## Cost Estimation

### Firebase Free Tier (Spark Plan):
- **10,000 free phone verifications per month**
- Then $0.01 per verification (in US/Canada)
- India pricing: ~$0.05 per verification

### Cost-Saving Strategy (Implemented):
- OTP only for **new user registration** or **PIN reset**
- **PIN-based login** for returning users = **₹0 cost**
- Long sessions (30 days) = fewer re-logins

---

## Troubleshooting

### "auth/invalid-api-key"
→ Check your Firebase config API key

### "auth/operation-not-allowed"
→ Enable Phone authentication in Firebase Console

### "auth/too-many-requests"
→ You've hit rate limits; wait and try again

### reCAPTCHA not loading
→ Check that your domain is authorized in Firebase Console

---

## Useful Links

- [Firebase Console](https://console.firebase.google.com/)
- [Firebase Phone Auth Docs](https://firebase.google.com/docs/auth/web/phone-auth)
- [Firebase Pricing](https://firebase.google.com/pricing)
- [reCAPTCHA Enterprise](https://cloud.google.com/recaptcha-enterprise)
- [Firebase Web SDK Reference](https://firebase.google.com/docs/reference/js/auth)

---

## Summary

| Step | Action |
|------|--------|
| 1 | Create Firebase project |
| 2 | Enable Phone Auth |
| 3 | Add web app & get config |
| 4 | Install `firebase` npm package |
| 5 | Create `firebase.ts` config file |
| 6 | Add env variables |
| 7 | Update RuralAuthFlow with Firebase calls |
| 8 | Test with test phone numbers |
| 9 | Configure reCAPTCHA for production |
