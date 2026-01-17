package com.doorstep.tn

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
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
        
        Log.d(TAG, "Handling notification intent: clickUrl=$clickUrl, type=$notificationType, relatedId=$relatedId")
        
        if (clickUrl != null) {
            // Convert web URL to Android route
            pendingNotificationRoute = convertClickUrlToRoute(clickUrl, notificationType, relatedId)
            Log.d(TAG, "Pending navigation route: $pendingNotificationRoute")
        } else if (notificationType != null) {
            // Fallback: use type to determine route
            pendingNotificationRoute = getRouteFromType(notificationType, relatedId)
            Log.d(TAG, "Fallback navigation route: $pendingNotificationRoute")
        }
    }
    
    /**
     * Convert web click URL to Android navigation route
     */
    private fun convertClickUrlToRoute(clickUrl: String, type: String?, relatedId: String?): String {
        // Parse the clickUrl and convert to Android route
        return when {
            clickUrl.contains("/provider/bookings") -> {
                if (relatedId != null) "provider_booking/$relatedId" else "provider_bookings"
            }
            clickUrl.contains("/customer/bookings") -> {
                if (relatedId != null) "customer_booking/$relatedId" else "customer_bookings"
            }
            clickUrl.contains("/shop/orders") -> {
                if (relatedId != null) "shop_order/$relatedId" else "shop_orders"
            }
            clickUrl.contains("/customer/orders") -> {
                if (relatedId != null) "customer_order/$relatedId" else "customer_orders"
            }
            clickUrl.contains("/notifications") -> {
                when {
                    clickUrl.contains("/provider/") -> "provider_notifications"
                    clickUrl.contains("/shop/") -> "shop_notifications"
                    else -> "customer_notifications"
                }
            }
            else -> "customer_notifications"
        }
    }
    
    /**
     * Get route from notification type (fallback)
     */
    private fun getRouteFromType(type: String, relatedId: String?): String {
        return when (type) {
            "booking", "booking_request", "new_booking", "booking_accepted", 
            "booking_completed", "payment_submitted", "payment_confirmed" -> {
                if (relatedId != null) "customer_booking/$relatedId" else "customer_bookings"
            }
            "order", "new_order", "order_shipped", "order_delivered" -> {
                if (relatedId != null) "customer_order/$relatedId" else "customer_orders"
            }
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
            getSharedPreferences("fcm_prefs", MODE_PRIVATE)
                .edit()
                .putString("fcm_token", token)
                .putBoolean("token_needs_sync", true)
                .apply()
        }
    }
}
