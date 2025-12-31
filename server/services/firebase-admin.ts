/**
 * Firebase Admin SDK Service
 * 
 * This service handles server-side verification of Firebase ID tokens
 * to ensure OTP verification actually happened before registration/PIN reset.
 */

import admin from "firebase-admin";
import logger from "../logger";
import fs from "fs";

let firebaseApp: admin.app.App | null = null;

/**
 * Initialize Firebase Admin SDK
 * Uses the service account specified in FIREBASE_SERVICE_ACCOUNT_PATH env var
 */
export function initializeFirebaseAdmin(): boolean {
    if (firebaseApp) {
        return true; // Already initialized
    }

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (!serviceAccountPath) {
        logger.warn(
            "FIREBASE_SERVICE_ACCOUNT_PATH not set. Firebase Admin SDK will not be initialized. " +
            "Server-side OTP verification will be disabled."
        );
        return false;
    }

    // Check if file exists
    if (!fs.existsSync(serviceAccountPath)) {
        logger.error(
            { path: serviceAccountPath },
            "Firebase service account file not found. Server-side OTP verification will be disabled."
        );
        return false;
    }

    try {
        // Read and parse the service account file
        const serviceAccountJson = fs.readFileSync(serviceAccountPath, "utf-8");
        const serviceAccount = JSON.parse(serviceAccountJson);

        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id,
        });

        logger.info(
            { projectId: serviceAccount.project_id },
            "Firebase Admin SDK initialized successfully"
        );
        return true;
    } catch (error) {
        logger.error({ err: error }, "Failed to initialize Firebase Admin SDK");
        return false;
    }
}

/**
 * Check if Firebase Admin is initialized and available
 */
export function isFirebaseAdminAvailable(): boolean {
    return firebaseApp !== null;
}

/**
 * Verify a Firebase ID token and return the decoded token
 * 
 * @param idToken - The Firebase ID token from the client
 * @returns The decoded token if valid, null if invalid
 */
export async function verifyFirebaseIdToken(
    idToken: string
): Promise<admin.auth.DecodedIdToken | null> {
    if (!firebaseApp) {
        logger.error("Firebase Admin SDK not initialized. Cannot verify ID token.");
        return null;
    }

    try {
        const decodedToken = await admin.auth(firebaseApp).verifyIdToken(idToken);
        logger.debug(
            { uid: decodedToken.uid, phone: decodedToken.phone_number },
            "Firebase ID token verified successfully"
        );
        return decodedToken;
    } catch (error: any) {
        if (error.code === "auth/id-token-expired") {
            logger.warn("Firebase ID token has expired");
        } else if (error.code === "auth/id-token-revoked") {
            logger.warn("Firebase ID token has been revoked");
        } else if (error.code === "auth/argument-error") {
            logger.warn("Invalid Firebase ID token format");
        } else {
            logger.error({ err: error }, "Failed to verify Firebase ID token");
        }
        return null;
    }
}

/**
 * Extract the phone number from a verified Firebase token
 * 
 * @param decodedToken - The decoded Firebase ID token
 * @returns The phone number (e.g., "+919876543210") or null if not present
 */
export function extractPhoneFromToken(
    decodedToken: admin.auth.DecodedIdToken
): string | null {
    const phoneNumber = decodedToken.phone_number;

    if (!phoneNumber) {
        logger.warn(
            { uid: decodedToken.uid },
            "Firebase token does not contain a phone number"
        );
        return null;
    }

    return phoneNumber;
}

/**
 * Normalize phone number from Firebase format (+919876543210) to local format (9876543210)
 * 
 * @param firebasePhone - Phone number from Firebase (with country code)
 * @returns Normalized 10-digit phone number
 */
export function normalizeFirebasePhone(firebasePhone: string): string {
    // Remove the +91 country code prefix for India
    if (firebasePhone.startsWith("+91")) {
        return firebasePhone.slice(3);
    }
    // Handle other country codes if needed
    if (firebasePhone.startsWith("+")) {
        // Generic: strip + and country code (assume last 10 digits are the number)
        const digits = firebasePhone.replace(/\D/g, "");
        if (digits.length >= 10) {
            return digits.slice(-10);
        }
    }
    return firebasePhone;
}

/**
 * Full verification flow: verify token and extract normalized phone number
 * 
 * @param idToken - The Firebase ID token from the client
 * @returns Object with success status and phone number, or error message
 */
export async function verifyAndExtractPhone(idToken: string): Promise<{
    success: boolean;
    phone?: string;
    error?: string;
}> {
    if (!isFirebaseAdminAvailable()) {
        return {
            success: false,
            error: "Firebase verification not available. Please contact support.",
        };
    }

    const decodedToken = await verifyFirebaseIdToken(idToken);
    if (!decodedToken) {
        return {
            success: false,
            error: "Invalid or expired verification token. Please try again.",
        };
    }

    const firebasePhone = extractPhoneFromToken(decodedToken);
    if (!firebasePhone) {
        return {
            success: false,
            error: "Phone number not found in verification token.",
        };
    }

    const normalizedPhone = normalizeFirebasePhone(firebasePhone);

    return {
        success: true,
        phone: normalizedPhone,
    };
}
