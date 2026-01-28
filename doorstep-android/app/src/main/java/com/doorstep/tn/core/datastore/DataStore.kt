package com.doorstep.tn.core.datastore

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore

/**
 * DataStore extension for application preferences
 */
val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "doorstep_prefs")

/**
 * Preference keys
 */
object PreferenceKeys {
    val IS_LOGGED_IN = booleanPreferencesKey("is_logged_in")
    val LANGUAGE = stringPreferencesKey("language")
    // Legacy PII keys migrated to SecureUserStore.
    val USER_ID = stringPreferencesKey("user_id")
    val USER_NAME = stringPreferencesKey("user_name")
    val USER_ROLE = stringPreferencesKey("user_role")
    val USER_PHONE = stringPreferencesKey("user_phone")
    val LAST_PHONE = stringPreferencesKey("last_phone")
}
