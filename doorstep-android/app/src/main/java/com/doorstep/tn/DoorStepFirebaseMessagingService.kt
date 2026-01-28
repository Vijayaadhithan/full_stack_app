package com.doorstep.tn

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.doorstep.tn.core.network.DoorStepApi
import com.doorstep.tn.core.network.FcmTokenRequest
import com.doorstep.tn.core.security.SecureUserStore
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Firebase Messaging Service for handling push notifications
 * 
 * This service:
 * 1. Receives FCM tokens when they're generated/refreshed
 * 2. Handles incoming push notifications
 * 3. Displays notifications when the app is in the background
 */
@AndroidEntryPoint
class DoorStepFirebaseMessagingService : FirebaseMessagingService() {

    @Inject
    lateinit var api: DoorStepApi

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    companion object {
        private const val TAG = "DoorStepFCM"
        const val CHANNEL_ID = "doorstep_notifications"
        const val CHANNEL_NAME = "DoorStep Notifications"
        const val CHANNEL_DESCRIPTION = "Notifications for orders, bookings, and updates"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    /**
     * Called when a new FCM token is generated or refreshed
     * We need to send this token to our backend to enable push notifications
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "New FCM token received")
        
        // Store token locally for later registration after login
        SecureUserStore.setFcmToken(this, token)
        SecureUserStore.setFcmNeedsSync(this, true)
        
        // Try to register token if user is logged in
        registerTokenWithBackend(token)
    }

    /**
     * Called when a message is received while the app is in foreground
     * For background messages, the system handles notification display automatically
     */
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Log.d(TAG, "Message received from: ${message.from}")

        // Check if message contains a notification payload
        message.notification?.let { notification ->
            val title = notification.title ?: "DoorStep"
            val body = notification.body ?: ""
            
            Log.d(TAG, "Notification: $title - $body")
            
            // Show notification (for foreground messages)
            showNotification(title, body, message.data)
        }

        // Handle data-only messages if needed
        if (message.data.isNotEmpty()) {
            Log.d(TAG, "Data payload: ${message.data}")
            Log.i(
                TAG,
                "Push data keys=${message.data.keys} type=${message.data["type"]} relatedId=${message.data["relatedId"]} clickUrl=${message.data["clickUrl"]}"
            )
            handleDataMessage(message.data)
        }
    }

    /**
     * Register FCM token with our backend
     */
    private fun registerTokenWithBackend(token: String) {
        serviceScope.launch {
            try {
                val response = api.registerFcmToken(
                    FcmTokenRequest(
                        token = token,
                        platform = "android",
                        deviceInfo = "${Build.MANUFACTURER} ${Build.MODEL}"
                    )
                )
                if (response.isSuccessful) {
                    Log.d(TAG, "FCM token registered with backend successfully")
                    // Mark token as synced
                    SecureUserStore.setFcmNeedsSync(this@DoorStepFirebaseMessagingService, false)
                } else {
                    Log.w(TAG, "Failed to register FCM token: ${response.code()}")
                    SecureUserStore.setFcmNeedsSync(this@DoorStepFirebaseMessagingService, true)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error registering FCM token", e)
                SecureUserStore.setFcmNeedsSync(this@DoorStepFirebaseMessagingService, true)
                // Token will be synced later when user logs in
            }
        }
    }

    /**
     * Create notification channel for Android 8.0+
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CHANNEL_DESCRIPTION
                enableLights(true)
                enableVibration(true)
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    /**
     * Display notification to the user
     */
    private fun showNotification(title: String, body: String, data: Map<String, String>) {
        val intent = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            // Pass notification data to the activity
            data.forEach { (key, value) ->
                putExtra(key, value)
            }
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            System.currentTimeMillis().toInt(),
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notificationBuilder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)

        val notification = notificationBuilder.build()

        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }

    /**
     * Handle data-only messages (when no notification payload is present)
     */
    private fun handleDataMessage(data: Map<String, String>) {
        // Extract notification type and related ID
        val type = data["type"]
        val relatedId = data["relatedId"]
        
        Log.d(TAG, "Handling data message: type=$type, relatedId=$relatedId")
        
        // For data-only messages, show a notification based on the type
        when (type) {
            "booking", "booking_request", "service" -> {
                showNotification(
                    "Booking Update",
                    "You have a new booking update",
                    data
                )
            }
            "order" -> {
                showNotification(
                    "Order Update", 
                    "You have a new order update",
                    data
                )
            }
            else -> {
                // For other types, only show if we have explicit title/body
                data["title"]?.let { title ->
                    showNotification(title, data["body"] ?: "", data)
                }
            }
        }
    }
}
