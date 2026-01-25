package com.doorstep.tn.core.security

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import java.security.SecureRandom

/**
 * Encrypted storage for session cookies, CSRF tokens, and mobile signing secret.
 */
object SecureSessionStore {
    private const val PREFS_NAME = "secure_session"
    private const val KEY_SESSION_COOKIE = "session_cookie"
    private const val KEY_CSRF_TOKEN = "csrf_token"
    private const val KEY_SIGNING_SECRET = "mobile_signing_secret"

    @Volatile
    private var cachedPrefs: SharedPreferences? = null

    private fun getPrefs(context: Context): SharedPreferences {
        val existing = cachedPrefs
        if (existing != null) return existing
        return synchronized(this) {
            val again = cachedPrefs
            if (again != null) {
                again
            } else {
                val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
                val created = EncryptedSharedPreferences.create(
                    PREFS_NAME,
                    masterKeyAlias,
                    context.applicationContext,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
                )
                cachedPrefs = created
                created
            }
        }
    }

    fun getSessionCookie(context: Context): String? {
        return getPrefs(context).getString(KEY_SESSION_COOKIE, null)
    }

    fun setSessionCookie(context: Context, cookie: String?) {
        val prefs = getPrefs(context)
        if (cookie.isNullOrBlank()) {
            prefs.edit().remove(KEY_SESSION_COOKIE).apply()
        } else {
            prefs.edit().putString(KEY_SESSION_COOKIE, cookie).apply()
        }
    }

    fun getCsrfToken(context: Context): String? {
        return getPrefs(context).getString(KEY_CSRF_TOKEN, null)
    }

    fun setCsrfToken(context: Context, token: String?) {
        val prefs = getPrefs(context)
        if (token.isNullOrBlank()) {
            prefs.edit().remove(KEY_CSRF_TOKEN).apply()
        } else {
            prefs.edit().putString(KEY_CSRF_TOKEN, token).apply()
        }
    }

    fun getOrCreateSigningSecret(context: Context): ByteArray {
        val prefs = getPrefs(context)
        val existing = prefs.getString(KEY_SIGNING_SECRET, null)
        if (!existing.isNullOrBlank()) {
            return Base64.decode(existing, Base64.NO_WRAP or Base64.URL_SAFE)
        }

        val secret = ByteArray(32)
        SecureRandom().nextBytes(secret)
        val encoded = Base64.encodeToString(secret, Base64.NO_WRAP or Base64.URL_SAFE)
        prefs.edit().putString(KEY_SIGNING_SECRET, encoded).apply()
        return secret
    }

    fun clearSession(context: Context) {
        getPrefs(context).edit()
            .remove(KEY_SESSION_COOKIE)
            .remove(KEY_CSRF_TOKEN)
            .apply()
    }
}
