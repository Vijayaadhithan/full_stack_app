package com.doorstep.tn.provider.ui

import androidx.compose.runtime.Composable
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.core.network.AppNotification
import com.doorstep.tn.customer.ui.CustomerViewModel
import com.doorstep.tn.customer.ui.notifications.NotificationsScreen

@Composable
fun ProviderNotificationsScreen(
    viewModel: CustomerViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToBookings: () -> Unit,
    onNavigateToEarnings: () -> Unit,
    onNavigateToReviews: () -> Unit,
    onNavigateToServices: () -> Unit,
    onNavigateToDashboard: () -> Unit
) {
    NotificationsScreen(
        viewModel = viewModel,
        screenTitle = "Provider Notifications",
        onNavigateBack = onNavigateBack,
        onNotificationNavigate = { notification, _ ->
            handleProviderNotification(
                notification = notification,
                onNavigateToBookings = onNavigateToBookings,
                onNavigateToEarnings = onNavigateToEarnings,
                onNavigateToReviews = onNavigateToReviews,
                onNavigateToServices = onNavigateToServices,
                onNavigateToDashboard = onNavigateToDashboard
            )
        }
    )
}

private fun handleProviderNotification(
    notification: AppNotification,
    onNavigateToBookings: () -> Unit,
    onNavigateToEarnings: () -> Unit,
    onNavigateToReviews: () -> Unit,
    onNavigateToServices: () -> Unit,
    onNavigateToDashboard: () -> Unit
) {
    when (notification.type) {
        "booking", "booking_request", "booking_update",
        "booking_confirmed", "booking_rejected", "booking_cancelled_by_customer",
        "booking_rescheduled_request", "booking_rescheduled_by_provider",
        "service", "service_request" -> onNavigateToBookings()
        "review", "service_review", "provider_review" -> onNavigateToReviews()
        "earning", "payout", "payment", "payment_received", "payment_failed" -> onNavigateToEarnings()
        "promotion", "offer" -> onNavigateToServices()
        "order", "shop", "return" -> onNavigateToDashboard()
        "system" -> Unit
        else -> onNavigateToBookings()
    }
}
