package com.doorstep.tn

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.doorstep.tn.common.theme.DoorStepTheme
import com.doorstep.tn.core.security.SecureUserStore
import com.doorstep.tn.navigation.DoorStepNavHost
import com.google.firebase.messaging.FirebaseMessaging
import dagger.hilt.android.AndroidEntryPoint

/**
 * Main activity for the DoorStep TN app.
 * Uses single-activity architecture with Compose navigation.
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    
    companion object {
        private const val TAG = "MainActivity"
        
        // Stores pending navigation from notification click
        var pendingNotificationRoute: String? = null
            private set
        
        fun clearPendingNotificationRoute() {
            pendingNotificationRoute = null
        }
    }
    
    // Permission launcher for Android 13+ notification permission
    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            Log.d(TAG, "Notification permission granted")
            // Get FCM token after permission is granted
            refreshFcmToken()
        } else {
            Log.w(TAG, "Notification permission denied")
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        
        // Handle notification click intent
        handleNotificationIntent(intent)
        
        // Request notification permission for Android 13+
        requestNotificationPermission()
        
        setContent {
            DoorStepTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    DoorStepNavHost()
                }
            }
        }
    }
    
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Handle notification clicks when app is already open
        handleNotificationIntent(intent)
    }
    
    /**
     * Handle notification click intent and set pending navigation route
     */
    private fun handleNotificationIntent(intent: Intent?) {
        if (intent == null) return
        
        val clickUrl = intent.getStringExtra("clickUrl")
        val notificationType = intent.getStringExtra("type")
        val relatedId = intent.getStringExtra("relatedId")
        val relatedBookingId = intent.getStringExtra("relatedBookingId")
        val relatedOrderId = intent.getStringExtra("relatedOrderId")
        
        Log.d(TAG, "Handling notification intent: clickUrl=$clickUrl, type=$notificationType, relatedId=$relatedId, bookingId=$relatedBookingId, orderId=$relatedOrderId")
        
        if (clickUrl != null) {
            // Convert web URL to Android route
            pendingNotificationRoute = convertClickUrlToRoute(clickUrl, notificationType, relatedId ?: relatedBookingId ?: relatedOrderId)
            Log.d(TAG, "Pending navigation route: $pendingNotificationRoute")
            Log.i(TAG, "Notification route resolved: $pendingNotificationRoute")
        } else if (notificationType != null) {
            // Fallback: use type to determine route
            pendingNotificationRoute = getRouteFromType(notificationType, relatedId ?: relatedBookingId ?: relatedOrderId)
            Log.d(TAG, "Fallback navigation route: $pendingNotificationRoute")
            Log.i(TAG, "Notification route fallback: $pendingNotificationRoute")
        }
    }
    
    /**
     * Convert web click URL to Android navigation route
     */
    private fun convertClickUrlToRoute(clickUrl: String, type: String?, relatedId: String?): String {
        val resolvedRelatedId = relatedId?.takeIf { it.isNotBlank() }
        val bookingId = resolvedRelatedId ?: extractIdFromClickUrl(clickUrl, "bookingId")
        val orderId = resolvedRelatedId ?: extractIdFromClickUrl(clickUrl, "orderId")

        // Parse the clickUrl and convert to Android route
        return when {
            clickUrl.contains("/provider/bookings") -> "provider_bookings"
            clickUrl.contains("/customer/bookings") -> {
                if (bookingId != null) "customer_booking/$bookingId" else "customer_bookings"
            }
            clickUrl.contains("/shop/orders") || clickUrl.contains("/shop/returns") -> "shop_dashboard"
            clickUrl.contains("/shop/inventory") -> "shop_dashboard"
            clickUrl.contains("/customer/returns") -> {
                if (orderId != null) "customer_order/$orderId" else "customer_orders"
            }
            clickUrl.contains("/customer/orders") || clickUrl.contains("/customer/order") -> {
                if (orderId != null) "customer_order/$orderId" else "customer_orders"
            }
            clickUrl.contains("/notifications") -> {
                when {
                    clickUrl.contains("/provider/") -> "provider_notifications"
                    clickUrl.contains("/shop/") -> "shop_dashboard"
                    else -> "customer_notifications"
                }
            }
            clickUrl.contains("/shop") -> "shop_dashboard"
            clickUrl.contains("/provider") -> "provider_dashboard"
            clickUrl.contains("/customer") -> "customer_home"
            else -> "customer_notifications"
        }
    }

    private fun extractIdFromClickUrl(clickUrl: String, queryKey: String): String? {
        return try {
            val uri = Uri.parse(clickUrl)
            val queryValue = uri.getQueryParameter(queryKey)
            if (!queryValue.isNullOrBlank()) {
                queryValue
            } else {
                val lastSegment = uri.pathSegments.lastOrNull()
                if (!lastSegment.isNullOrBlank() && lastSegment.all { it.isDigit() }) {
                    lastSegment
                } else {
                    null
                }
            }
        } catch (e: Exception) {
            null
        }
    }
    
    /**
     * Get route from notification type (fallback)
     */
    private fun getRouteFromType(type: String, relatedId: String?): String {
        return when (type) {
            "booking", "booking_request", "booking_update", "booking_confirmed",
            "booking_rejected", "booking_cancelled_by_customer",
            "booking_rescheduled_request", "booking_rescheduled_by_provider",
            "service", "service_request", "new_booking", "booking_accepted",
            "booking_completed", "payment_submitted", "payment_confirmed" -> {
                if (relatedId != null) "customer_booking/$relatedId" else "customer_bookings"
            }
            "order", "new_order", "order_shipped", "order_delivered", "return" -> {
                if (relatedId != null) "customer_order/$relatedId" else "customer_orders"
            }
            "shop" -> "shop_dashboard"
            else -> "customer_notifications"
        }
    }
    
    /**
     * Request notification permission for Android 13+ (API 33+)
     */
    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            when {
                ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED -> {
                    Log.d(TAG, "Notification permission already granted")
                    // Refresh FCM token to ensure it's registered
                    refreshFcmToken()
                }
                shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) -> {
                    // Show an explanation to the user if needed
                    Log.d(TAG, "Should show rationale for notification permission")
                    requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
                else -> {
                    // Request the permission
                    Log.d(TAG, "Requesting notification permission")
                    requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
        } else {
            // For Android 12 and below, permission is granted at install time
            Log.d(TAG, "Android < 13, notification permission granted by default")
            refreshFcmToken()
        }
    }
    
    /**
     * Refresh FCM token to ensure it's ready for push notifications
     */
    private fun refreshFcmToken() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                Log.w(TAG, "Fetching FCM registration token failed", task.exception)
                return@addOnCompleteListener
            }
            
            // Get new FCM registration token
            val token = task.result
            Log.d(TAG, "FCM Token obtained in MainActivity")
            
            // Store token for later sync with backend
            SecureUserStore.setFcmToken(this, token)
            SecureUserStore.setFcmNeedsSync(this, true)
        }
    }
}
