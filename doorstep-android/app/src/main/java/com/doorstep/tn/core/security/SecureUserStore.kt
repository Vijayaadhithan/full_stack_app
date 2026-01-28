package com.doorstep.tn.core.security

import android.content.Context
import android.content.SharedPreferences
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import com.doorstep.tn.core.datastore.PreferenceKeys
import com.doorstep.tn.core.datastore.dataStore

/**
 * Encrypted storage for user profile fields and FCM token state.
 */
object SecureUserStore {
    private const val PREFS_NAME = "secure_user"

    private const val KEY_USER_ID = "user_id"
    private const val KEY_USER_NAME = "user_name"
    private const val KEY_USER_ROLE = "user_role"
    private const val KEY_USER_PHONE = "user_phone"
    private const val KEY_LAST_PHONE = "last_phone"

    private const val KEY_FCM_TOKEN = "fcm_token"
    private const val KEY_FCM_NEEDS_SYNC = "fcm_token_needs_sync"

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

    private fun setString(prefs: SharedPreferences, key: String, value: String?) {
        if (value.isNullOrBlank()) {
            prefs.edit().remove(key).apply()
        } else {
            prefs.edit().putString(key, value).apply()
        }
    }

    fun getUserId(context: Context): String? = getPrefs(context).getString(KEY_USER_ID, null)

    fun setUserId(context: Context, userId: String?) {
        setString(getPrefs(context), KEY_USER_ID, userId)
    }

    fun getUserName(context: Context): String? = getPrefs(context).getString(KEY_USER_NAME, null)

    fun setUserName(context: Context, userName: String?) {
        setString(getPrefs(context), KEY_USER_NAME, userName)
    }

    fun getUserRole(context: Context): String? = getPrefs(context).getString(KEY_USER_ROLE, null)

    fun setUserRole(context: Context, role: String?) {
        setString(getPrefs(context), KEY_USER_ROLE, role)
    }

    fun getUserPhone(context: Context): String? = getPrefs(context).getString(KEY_USER_PHONE, null)

    fun setUserPhone(context: Context, phone: String?) {
        setString(getPrefs(context), KEY_USER_PHONE, phone)
    }

    fun getLastPhone(context: Context): String? = getPrefs(context).getString(KEY_LAST_PHONE, null)

    fun setLastPhone(context: Context, phone: String?) {
        setString(getPrefs(context), KEY_LAST_PHONE, phone)
    }

    fun clearUser(context: Context) {
        getPrefs(context).edit()
            .remove(KEY_USER_ID)
            .remove(KEY_USER_NAME)
            .remove(KEY_USER_ROLE)
            .remove(KEY_USER_PHONE)
            .apply()
    }

    fun getFcmToken(context: Context): String? = getPrefs(context).getString(KEY_FCM_TOKEN, null)

    fun setFcmToken(context: Context, token: String?) {
        setString(getPrefs(context), KEY_FCM_TOKEN, token)
    }

    fun getFcmNeedsSync(context: Context): Boolean {
        return getPrefs(context).getBoolean(KEY_FCM_NEEDS_SYNC, false)
    }

    fun setFcmNeedsSync(context: Context, needsSync: Boolean) {
        getPrefs(context).edit().putBoolean(KEY_FCM_NEEDS_SYNC, needsSync).apply()
    }

    fun migrateFromDataStore(context: Context, prefs: Preferences): Boolean {
        var migrated = false

        val legacyUserId = prefs[PreferenceKeys.USER_ID]
        if (getUserId(context).isNullOrBlank() && !legacyUserId.isNullOrBlank()) {
            setUserId(context, legacyUserId)
            migrated = true
        }

        val legacyUserName = prefs[PreferenceKeys.USER_NAME]
        if (getUserName(context).isNullOrBlank() && !legacyUserName.isNullOrBlank()) {
            setUserName(context, legacyUserName)
            migrated = true
        }

        val legacyUserRole = prefs[PreferenceKeys.USER_ROLE]
        if (getUserRole(context).isNullOrBlank() && !legacyUserRole.isNullOrBlank()) {
            setUserRole(context, legacyUserRole)
            migrated = true
        }

        val legacyUserPhone = prefs[PreferenceKeys.USER_PHONE]
        if (getUserPhone(context).isNullOrBlank() && !legacyUserPhone.isNullOrBlank()) {
            setUserPhone(context, legacyUserPhone)
            migrated = true
        }

        val legacyLastPhone = prefs[PreferenceKeys.LAST_PHONE]
        if (getLastPhone(context).isNullOrBlank() && !legacyLastPhone.isNullOrBlank()) {
            setLastPhone(context, legacyLastPhone)
            migrated = true
        }

        return migrated
    }

    suspend fun clearLegacyDataStore(context: Context) {
        context.dataStore.edit { legacyPrefs ->
            legacyPrefs.remove(PreferenceKeys.USER_ID)
            legacyPrefs.remove(PreferenceKeys.USER_NAME)
            legacyPrefs.remove(PreferenceKeys.USER_ROLE)
            legacyPrefs.remove(PreferenceKeys.USER_PHONE)
            legacyPrefs.remove(PreferenceKeys.LAST_PHONE)
        }
    }

    fun migrateLegacyFcmPrefs(context: Context): Boolean {
        val legacyPrefs = context.getSharedPreferences("fcm_prefs", Context.MODE_PRIVATE)
        val token = legacyPrefs.getString("fcm_token", null)
        val needsSync = legacyPrefs.getBoolean("token_needs_sync", false)
        if (token.isNullOrBlank() && !needsSync) {
            return false
        }
        if (!token.isNullOrBlank()) {
            setFcmToken(context, token)
            setFcmNeedsSync(context, needsSync)
        }
        legacyPrefs.edit().clear().apply()
        return true
    }
}
