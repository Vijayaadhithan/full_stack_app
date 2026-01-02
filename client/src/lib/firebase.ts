import { initializeApp } from "firebase/app";
import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    ConfirmationResult,
    Auth
} from "firebase/auth";

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

const isDev = import.meta.env.DEV;

// Debug: Log Firebase configuration status (only in development)
if (isDev) {
    console.log("Firebase Config Check:", {
        hasApiKey: !!firebaseConfig.apiKey,
        hasAuthDomain: !!firebaseConfig.authDomain,
        hasProjectId: !!firebaseConfig.projectId,
        apiKeyPreview: firebaseConfig.apiKey ? firebaseConfig.apiKey.substring(0, 10) + "..." : "MISSING",
        authDomain: firebaseConfig.authDomain || "MISSING",
        projectId: firebaseConfig.projectId || "MISSING"
    });
}

// Check if Firebase is configured
export const isFirebaseConfigured = Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId
);

if (isDev) {
    console.log("isFirebaseConfigured:", isFirebaseConfigured);
}

// Initialize Firebase only if configured
let app: ReturnType<typeof initializeApp> | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        if (isDev) {
            console.log("Firebase initialized successfully, auth:", !!auth);
        }
    } catch (error) {
        console.error("Firebase initialization error:", error);
    }
} else {
    if (isDev) {
        console.warn("Firebase NOT configured - missing environment variables. Expected VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID in .env");
    }
}

export { auth };

// Store confirmation result globally
let confirmationResult: ConfirmationResult | null = null;
let recaptchaVerifierInstance: RecaptchaVerifier | null = null;

/**
 * Initialize reCAPTCHA verifier (invisible)
 * Call this once when the OTP button is mounted
 * Returns a promise that resolves to the verifier once rendered
 */
export async function initRecaptcha(buttonId: string): Promise<RecaptchaVerifier | null> {
    if (typeof window === "undefined") {
        console.warn("Window not available");
        return null;
    }

    if (!auth) {
        console.warn("Firebase Auth not available - check Firebase configuration");
        return null;
    }

    // Clean up existing verifier
    if (recaptchaVerifierInstance) {
        try {
            recaptchaVerifierInstance.clear();
        } catch (e) {
            // Ignore cleanup errors
        }
        recaptchaVerifierInstance = null;
    }

    // Wait for button to be in DOM
    const button = document.getElementById(buttonId);
    if (!button) {
        console.warn(`Button with id "${buttonId}" not found in DOM`);
        return null;
    }

    try {
        recaptchaVerifierInstance = new RecaptchaVerifier(auth, buttonId, {
            size: "invisible",
            callback: () => {
                console.log("reCAPTCHA verified");
            },
            "expired-callback": () => {
                console.log("reCAPTCHA expired - user needs to re-verify");
            }
        });

        // Render the reCAPTCHA widget - this is important!
        await recaptchaVerifierInstance.render();
        console.log("reCAPTCHA initialized successfully");

        return recaptchaVerifierInstance;
    } catch (error) {
        console.error("Error initializing reCAPTCHA:", error);
        return null;
    }
}

/**
 * Send OTP to phone number
 * @param phoneNumber - 10-digit Indian phone number (without country code)
 * @param recaptchaVerifier - The reCAPTCHA verifier instance
 * @returns true if OTP was sent successfully
 */
export async function sendOTP(
    phoneNumber: string,
    recaptchaVerifier: RecaptchaVerifier
): Promise<boolean> {
    if (!auth) {
        throw new Error("Firebase Auth not initialized. Please configure Firebase.");
    }

    // Format phone number with India country code
    const formattedPhone = phoneNumber.startsWith("+91")
        ? phoneNumber
        : `+91${phoneNumber.replace(/\D/g, "")}`;

    try {
        console.log("Sending OTP to:", formattedPhone);

        confirmationResult = await signInWithPhoneNumber(
            auth,
            formattedPhone,
            recaptchaVerifier
        );

        console.log("OTP sent successfully");
        return true;
    } catch (error: any) {
        console.error("Error sending OTP:", error);

        // Provide user-friendly error messages
        if (error.code === "auth/invalid-phone-number") {
            throw new Error("Invalid phone number format");
        } else if (error.code === "auth/too-many-requests") {
            // In DEV, if we hit rate limits, we can also fallback to mock
            if (isDev) {
                console.warn("Firebase rate limit hit in DEV. Switching to MOCK mode.");
                return setupMockAuth(formattedPhone);
            }
            throw new Error("Too many attempts. Please try again later.");
        } else if (error.code === "auth/operation-not-allowed") {
            // In DEV, if auth is not enabled, fallback to mock
            if (isDev) {
                console.warn("Firebase auth not enabled in DEV. Switching to MOCK mode.");
                return setupMockAuth(formattedPhone);
            }
            throw new Error("Phone authentication is not enabled. Please contact support.");
        } else if (error.code === "auth/billing-not-enabled") {
            // SPECIFIC FIX: Fallback to mock if billing is not enabled in DEV
            if (isDev) {
                console.warn("Firebase billing not enabled in DEV. Switching to MOCK mode.");
                return setupMockAuth(formattedPhone);
            }
            throw new Error("Firebase billing is not enabled. Please enable billing or contact support.");
        }

        throw error;
    }
}

/**
 * Setup mock authentication result
 */
function setupMockAuth(phoneNumber: string): boolean {
    console.log(`[MOCK AUTH] OTP sent to ${phoneNumber}. Use code 123456 to verify.`);

    // Create a mock ConfirmationResult that matches the Firebase interface
    const mockResult: any = {
        verificationId: "mock-verification-id-" + Date.now(),
        confirm: async (verificationCode: string) => {
            console.log(`[MOCK AUTH] Verifying code: ${verificationCode}`);
            if (verificationCode === "123456") {
                return {
                    user: {
                        phoneNumber: phoneNumber,
                        uid: "mock-uid-" + phoneNumber,
                        getIdToken: async () => `mock-token-${phoneNumber}`
                    },
                    operationType: "signIn"
                };
            }
            throw { code: "auth/invalid-verification-code", message: "Invalid verification code" };
        }
    };

    confirmationResult = mockResult;
    return true;
}

/**
 * Verify OTP code entered by user
 * @param otpCode - 6-digit OTP code
 * @returns Firebase ID token (can be used for backend verification)
 */
export async function verifyOTP(otpCode: string): Promise<string | null> {
    if (!confirmationResult) {
        throw new Error("No OTP request pending. Please request a new OTP.");
    }

    try {
        const result = await confirmationResult.confirm(otpCode);
        console.log("OTP verified successfully for:", result.user.phoneNumber);

        // Get Firebase ID token (optional - for backend verification)
        const idToken = await result.user.getIdToken();

        // Clear the confirmation result
        confirmationResult = null;

        return idToken;
    } catch (error: any) {
        console.error("Error verifying OTP:", error);

        if (error.code === "auth/invalid-verification-code") {
            throw new Error("Invalid OTP code. Please check and try again.");
        } else if (error.code === "auth/code-expired") {
            throw new Error("OTP has expired. Please request a new one.");
        }

        throw error;
    }
}

/**
 * Clean up reCAPTCHA verifier
 * Call this when unmounting the component
 */
export function cleanupRecaptcha(): void {
    if (recaptchaVerifierInstance) {
        try {
            recaptchaVerifierInstance.clear();
            recaptchaVerifierInstance = null;
        } catch (e) {
            // Ignore cleanup errors
        }
    }
    confirmationResult = null;
}

/**
 * Mock OTP functions for development without Firebase
 */
export const mockOtp = {
    // Simulates sending OTP (always succeeds)
    async sendOTP(phoneNumber: string): Promise<boolean> {
        console.log("[MOCK] Sending OTP to:", phoneNumber);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return true;
    },

    // Simulates verifying OTP (accepts "123456" as valid code)
    async verifyOTP(otpCode: string): Promise<boolean> {
        console.log("[MOCK] Verifying OTP:", otpCode);
        await new Promise(resolve => setTimeout(resolve, 500));

        // For development, accept "123456" as valid OTP
        if (otpCode === "123456") {
            return true;
        }
        throw new Error("Invalid OTP code");
    }
};
