package com.doorstep.tn.customer.ui.notifications

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.common.ui.PollingEffect
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.core.network.AppNotification
import com.doorstep.tn.customer.ui.CustomerViewModel
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

/**
 * Notifications Screen - matches web app's notifications functionality
 * Shows user notifications with read/unread status
 * Clicking a notification navigates to the relevant page based on notification type
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(
    viewModel: CustomerViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToBooking: (Int) -> Unit = {},
    onNavigateToBookings: () -> Unit = {},
    onNavigateToOrders: () -> Unit = {},
    onNavigateToOrder: (Int) -> Unit = {}
) {
    val notifications by viewModel.notifications.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    
    LaunchedEffect(Unit) {
        viewModel.loadNotifications()
    }

    PollingEffect(intervalMs = 30_000L) {
        viewModel.loadNotifications()
    }
    
    // Sort notifications: unread first, then by date (newest first) - matches web
    val sortedNotifications = remember(notifications) {
        notifications.sortedWith(
            compareBy<AppNotification> { it.isRead }
                .thenByDescending { it.createdAt ?: "" }
        )
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Notifications", color = WhiteText) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = WhiteText
                        )
                    }
                },
                actions = {
                    // Mark all as read button
                    val unreadCount = notifications.count { !it.isRead }
                    if (unreadCount > 0) {
                        TextButton(
                            onClick = { viewModel.markAllNotificationsRead() }
                        ) {
                            Text("Mark all read", color = OrangePrimary)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SlateBackground)
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = SlateDarker
    ) { paddingValues ->
        when {
            isLoading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = OrangePrimary)
                }
            }
            error != null -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.Error,
                            contentDescription = null,
                            tint = ErrorRed,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(error ?: "Error loading notifications", color = ErrorRed)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = { viewModel.loadNotifications() },
                            colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary)
                        ) {
                            Text("Retry")
                        }
                    }
                }
            }
            notifications.isEmpty() -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.Notifications,
                            contentDescription = null,
                            tint = WhiteTextMuted,
                            modifier = Modifier.size(64.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "No notifications yet",
                            color = WhiteTextMuted,
                            style = MaterialTheme.typography.bodyLarge
                        )
                    }
                }
            }
            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(sortedNotifications) { notification ->
                        NotificationCard(
                            notification = notification,
                            onClick = {
                                // Mark as read when clicked
                                if (!notification.isRead) {
                                    viewModel.markNotificationRead(notification.id)
                                }

                                val entityId = extractEntityId(notification)

                                // Navigate based on notification type - matches web's navigateToRelevantPage
                                when (notification.type) {
                                    // Booking-related types - navigate to specific booking or bookings list
                                    "booking", "booking_request", "booking_update", 
                                    "booking_confirmed", "booking_rejected", "booking_cancelled_by_customer",
                                    "booking_rescheduled_request", "booking_rescheduled_by_provider",
                                    "service", "service_request" -> {
                                        entityId?.let { bookingId ->
                                            onNavigateToBooking(bookingId)
                                        } ?: onNavigateToBookings()
                                    }
                                    // Order-related types - navigate to orders
                                    "order", "shop" -> {
                                        if (entityId != null) {
                                            onNavigateToOrder(entityId)
                                        } else {
                                            onNavigateToOrders()
                                        }
                                    }
                                    // Return types - navigate to orders (returns are under orders)
                                    "return" -> {
                                        onNavigateToOrders()
                                    }
                                    // Promotion and system - no specific navigation
                                    "promotion", "system" -> {
                                        // Just mark as read, no navigation
                                    }
                                    // Default fallback - try booking if ID available
                                    else -> {
                                        notification.relatedBookingId?.let { bookingId ->
                                            onNavigateToBooking(bookingId)
                                        }
                                    }
                                }
                            },
                            onDelete = {
                                viewModel.deleteNotification(notification.id)
                            }
                        )
                    }
                }
            }
        }
    }
}

private fun extractEntityId(notification: AppNotification): Int? {
    notification.relatedBookingId?.let { return it }

    val haystack = "${notification.title} ${notification.message}"
    val patterns = listOf(
        Regex("""ID:\s*(\d+)""", RegexOption.IGNORE_CASE),
        Regex("""\border\s*#\s*(\d+)""", RegexOption.IGNORE_CASE),
        Regex("""\bbooking\s*#\s*(\d+)""", RegexOption.IGNORE_CASE),
        Regex("""#\s*(\d+)""")
    )

    for (pattern in patterns) {
        val match = pattern.find(haystack)
        val value = match?.groupValues?.getOrNull(1)?.toIntOrNull()
        if (value != null) return value
    }

    return null
}

@Composable
private fun NotificationCard(
    notification: AppNotification,
    onClick: () -> Unit,
    onDelete: () -> Unit
) {
    // Emoji icon matching web's getNotificationIcon function
    val emoji = when (notification.type) {
        "booking", "booking_request", "booking_update", "booking_confirmed", "booking_rescheduled_request" -> "📅"
        "order", "shop" -> "📦"
        "return" -> "↩️"
        "service", "service_request" -> "🛠️"
        "promotion" -> "🎁"
        "system" -> "ℹ️"
        "booking_rejected", "booking_cancelled_by_customer" -> "❌"
        else -> "📬"
    }
    
    val iconColor = when (notification.type) {
        "booking", "booking_request", "booking_confirmed" -> ProviderBlue
        "booking_rejected", "booking_cancelled_by_customer" -> ErrorRed
        "order", "shop" -> OrangePrimary
        "promotion" -> SuccessGreen
        else -> WhiteTextMuted
    }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (notification.isRead) SlateCard else SlateCard.copy(alpha = 0.9f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Unread indicator
            if (!notification.isRead) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(OrangePrimary)
                )
                Spacer(modifier = Modifier.width(8.dp))
            }
            
            // Emoji icon (matching web design)
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(iconColor.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = emoji,
                    style = MaterialTheme.typography.titleLarge
                )
            }
            
            Spacer(modifier = Modifier.width(12.dp))
            
            // Content
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = notification.title,
                    style = MaterialTheme.typography.titleSmall,
                    color = WhiteText,
                    fontWeight = if (notification.isRead) FontWeight.Normal else FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = notification.message,
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = formatNotificationDate(notification.createdAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = WhiteTextMuted.copy(alpha = 0.7f)
                )
            }
            
            // Delete button
            IconButton(onClick = onDelete) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Delete",
                    tint = WhiteTextMuted,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}

private fun formatNotificationDate(dateStr: String?): String {
    if (dateStr.isNullOrEmpty()) return ""
    
    return try {
        val cleanDate = dateStr.substringBefore("[").trim()
        val instant = java.time.Instant.parse(
            if (cleanDate.endsWith("Z")) cleanDate else "${cleanDate}Z"
        )
        val istZone = java.time.ZoneId.of("Asia/Kolkata")
        val localDateTime = instant.atZone(istZone).toLocalDateTime()
        val outputFormatter = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd hh:mm a")
        localDateTime.format(outputFormatter)
    } catch (e: Exception) {
        dateStr.take(16).replace("T", " ")
    }
}
