package com.doorstep.tn.core.network

import android.content.Context
import android.util.Base64
import com.doorstep.tn.core.security.SecureSessionStore
import com.doorstep.tn.BuildConfig
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import org.json.JSONObject
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Interceptor to add authentication headers to API requests.
 * Handles session cookies and CSRF tokens for the Express.js backend.
 */
class AuthInterceptor(
    private val context: Context
) : Interceptor {
    
    companion object {
        private const val AUTH_SCHEME = "DoorStep"
        private const val HEADER_CSRF_RETRY = "X-CSRF-Retry"
        private val CSRF_SAFE_METHODS = setOf("GET", "HEAD", "OPTIONS")
    }

    private val csrfClient = OkHttpClient.Builder().build()
    
    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        
        val appContext = context.applicationContext
        val method = originalRequest.method.uppercase()
        val requiresCsrf = !CSRF_SAFE_METHODS.contains(method)

        var sessionCookie = SecureSessionStore.getSessionCookie(appContext)
        var csrfToken = SecureSessionStore.getCsrfToken(appContext)
        val signingSecret = SecureSessionStore.getOrCreateSigningSecret(appContext)
        val signedAuthHeader = buildSignedAuthHeader(originalRequest, signingSecret)

        if (requiresCsrf && csrfToken.isNullOrBlank()) {
            fetchCsrfToken(sessionCookie)?.let { fetched ->
                csrfToken = fetched.token
                SecureSessionStore.setCsrfToken(appContext, fetched.token)
                if (!fetched.sessionCookie.isNullOrBlank()) {
                    sessionCookie = fetched.sessionCookie
                    SecureSessionStore.setSessionCookie(appContext, fetched.sessionCookie)
                }
            }
        }
        
        val requestBuilder = originalRequest.newBuilder()
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            // Add X-Mobile-Client header to identify mobile app requests
            .header("X-Mobile-Client", "DoorStepTN-Android/1.0")
            // Signed mobile token reserved for server-side verification.
            .header("Authorization", signedAuthHeader)
        
        // Add session cookie if available
        sessionCookie?.let { requestBuilder.header("Cookie", it) }
        
        // Add CSRF token if available (for servers that require it even with auth header)
        if (requiresCsrf) {
            csrfToken?.let { requestBuilder.header("X-CSRF-Token", it) }
        }
        
        var response = chain.proceed(requestBuilder.build())
        
        // Save session cookie from response
        response.headers("Set-Cookie").forEach { cookie ->
            if (cookie.startsWith("connect.sid")) {
                SecureSessionStore.setSessionCookie(appContext, cookie)
            }
        }
        
        // Check if response contains CSRF token in header
        response.header("X-CSRF-Token")?.let { newCsrfToken ->
            SecureSessionStore.setCsrfToken(appContext, newCsrfToken)
        }

        if (response.code == 403 && requiresCsrf && originalRequest.header(HEADER_CSRF_RETRY) == null) {
            response.close()
            val refreshed = fetchCsrfToken(sessionCookie)
            if (refreshed != null) {
                SecureSessionStore.setCsrfToken(appContext, refreshed.token)
                if (!refreshed.sessionCookie.isNullOrBlank()) {
                    sessionCookie = refreshed.sessionCookie
                    SecureSessionStore.setSessionCookie(appContext, refreshed.sessionCookie)
                }
                val retryRequest = originalRequest.newBuilder()
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("X-Mobile-Client", "DoorStepTN-Android/1.0")
                    .header("Authorization", signedAuthHeader)
                    .header(HEADER_CSRF_RETRY, "1")
                    .apply {
                        sessionCookie?.let { header("Cookie", it) }
                        header("X-CSRF-Token", refreshed.token)
                    }
                    .build()

                response = chain.proceed(retryRequest)
                response.headers("Set-Cookie").forEach { cookie ->
                    if (cookie.startsWith("connect.sid")) {
                        SecureSessionStore.setSessionCookie(appContext, cookie)
                    }
                }
                response.header("X-CSRF-Token")?.let { newCsrfToken ->
                    SecureSessionStore.setCsrfToken(appContext, newCsrfToken)
                }
            }
        }
        
        return response
    }

    private data class CsrfFetchResult(
        val token: String,
        val sessionCookie: String?
    )

    private fun fetchCsrfToken(sessionCookie: String?): CsrfFetchResult? {
        val url = (BuildConfig.API_BASE_URL.trimEnd('/') + "/api/csrf-token")
            .toHttpUrlOrNull()
            ?: return null
        val requestBuilder = Request.Builder()
            .url(url)
            .get()
            .header("Accept", "application/json")
        sessionCookie?.let { requestBuilder.header("Cookie", it) }

        val response = csrfClient.newCall(requestBuilder.build()).execute()
        response.use {
            if (!it.isSuccessful) return null
            val bodyString = it.body?.string() ?: return null
            val token = JSONObject(bodyString).optString("csrfToken", "").trim()
            if (token.isBlank()) return null
            val cookie = it.headers("Set-Cookie")
                .firstOrNull { header -> header.startsWith("connect.sid") }
            return CsrfFetchResult(token, cookie)
        }
    }

    private fun buildSignedAuthHeader(request: okhttp3.Request, secret: ByteArray): String {
        val timestamp = System.currentTimeMillis().toString()
        val payload = listOf(timestamp, request.method, request.url.encodedPath).joinToString("|")
        val signature = hmacSha256(secret, payload)
        return "$AUTH_SCHEME $timestamp.$signature"
    }

    private fun hmacSha256(secret: ByteArray, payload: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret, "HmacSHA256"))
        val raw = mac.doFinal(payload.toByteArray(Charsets.UTF_8))
        return Base64.encodeToString(raw, Base64.NO_WRAP or Base64.URL_SAFE)
    }
}
