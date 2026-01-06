package com.doorstep.tn.core.network

import android.content.Context
import androidx.datastore.preferences.core.stringPreferencesKey
import com.doorstep.tn.core.datastore.dataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Interceptor to add authentication headers to API requests.
 * Handles session cookies and CSRF tokens for the Express.js backend.
 */
class AuthInterceptor(
    private val context: Context
) : Interceptor {
    
    companion object {
        val SESSION_COOKIE_KEY = stringPreferencesKey("session_cookie")
        val CSRF_TOKEN_KEY = stringPreferencesKey("csrf_token")
    }
    
    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        
        // Get session cookie and CSRF token from DataStore
        val (sessionCookie, csrfToken) = runBlocking {
            val prefs = context.dataStore.data.first()
            Pair(prefs[SESSION_COOKIE_KEY], prefs[CSRF_TOKEN_KEY])
        }
        
        val requestBuilder = originalRequest.newBuilder()
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            // Add X-Mobile-Client header to identify mobile app requests
            .header("X-Mobile-Client", "DoorStepTN-Android/1.0")
            // Add Authorization header to bypass CSRF protection for mobile apps
            // The server allows requests with Authorization header to skip CSRF validation
            .header("Authorization", "Mobile DoorStepTN")
        
        // Add session cookie if available
        sessionCookie?.let {
            requestBuilder.header("Cookie", it)
        }
        
        // Add CSRF token if available (for servers that require it even with auth header)
        csrfToken?.let {
            requestBuilder.header("X-CSRF-Token", it)
        }
        
        val response = chain.proceed(requestBuilder.build())
        
        // Save session cookie from response
        response.headers("Set-Cookie").forEach { cookie ->
            if (cookie.startsWith("connect.sid")) {
                runBlocking {
                    context.dataStore.updateData { preferences ->
                        preferences.toMutablePreferences().apply {
                            set(SESSION_COOKIE_KEY, cookie)
                        }
                    }
                }
            }
        }
        
        // Check if response contains CSRF token in header
        response.header("X-CSRF-Token")?.let { newCsrfToken ->
            runBlocking {
                context.dataStore.updateData { preferences ->
                    preferences.toMutablePreferences().apply {
                        set(CSRF_TOKEN_KEY, newCsrfToken)
                    }
                }
            }
        }
        
        return response
    }
}
