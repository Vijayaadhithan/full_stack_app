package com.doorstep.tn.provider.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.automirrored.filled.Message
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.common.ui.PollingEffect
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.core.network.ServiceReview
import com.doorstep.tn.customer.ui.CustomerViewModel
import com.doorstep.tn.provider.data.model.ProviderBooking
import com.doorstep.tn.provider.data.model.ProviderService
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.ceil

/**
 * Service Provider Dashboard Screen with web parity
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProviderDashboardScreen(
    viewModel: ProviderViewModel = hiltViewModel(),
    onNavigateToServices: () -> Unit,
    onNavigateToBookings: () -> Unit,
    onNavigateToEarnings: () -> Unit,
    onNavigateToReviews: () -> Unit,
    onNavigateToNotifications: () -> Unit,
    onNavigateToProfile: () -> Unit,
    onLogout: () -> Unit
) {
    val notificationsViewModel: CustomerViewModel = hiltViewModel()
    val isAvailable by viewModel.isAvailable.collectAsState()
    val pendingBookings by viewModel.pendingBookings.collectAsState()
    val isLoadingPendingBookings by viewModel.isLoadingPendingBookings.collectAsState()
    val services by viewModel.services.collectAsState()
    val bookings by viewModel.bookings.collectAsState()
    val bookingHistory by viewModel.bookingHistory.collectAsState()
    val isLoadingBookingHistory by viewModel.isLoadingBookingHistory.collectAsState()
    val reviews by viewModel.reviews.collectAsState()
    val isLoadingReviews by viewModel.isLoadingReviews.collectAsState()
    val error by viewModel.error.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val unreadNotificationCount by notificationsViewModel.unreadNotificationCount.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) {
        viewModel.loadDashboardData()
        notificationsViewModel.loadNotifications()
    }

    PollingEffect(intervalMs = 30_000L) {
        viewModel.loadPendingBookings()
        viewModel.loadAllBookings()
        viewModel.loadBookingHistory()
        notificationsViewModel.loadNotifications()
    }

    LaunchedEffect(successMessage) {
        successMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearSuccessMessage()
        }
    }

    LaunchedEffect(error) {
        error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    var showActionDialog by remember { mutableStateOf(false) }
    var actionBooking by remember { mutableStateOf<ProviderBooking?>(null) }
    var isAcceptAction by remember { mutableStateOf(true) }
    var comments by remember { mutableStateOf("") }

    val averageRating = remember(reviews) {
        if (reviews.isEmpty()) 0.0 else reviews.sumOf { it.rating.toDouble() } / reviews.size
    }

    val earningsSummary = remember(bookings) { buildEarningsSummary(bookings) }
    val upcomingBookings = remember(bookings) { buildUpcomingBookings(bookings) }
    val topCustomers = earningsSummary.topCustomers

    val pendingCount = remember(pendingBookings) { pendingBookings.size }
    val hasServices = services.isNotEmpty()

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Provider Dashboard",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = ProviderBlue
                        )
                        Text(
                            text = "Manage your services",
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteTextMuted
                        )
                    }
                },
                actions = {
                    IconButton(onClick = onNavigateToNotifications) {
                        BadgedBox(
                            badge = {
                                if (unreadNotificationCount > 0) {
                                    Badge(
                                        containerColor = ErrorRed
                                    ) {
                                        Text(
                                            text = if (unreadNotificationCount > 99) "99+" else "$unreadNotificationCount",
                                            color = WhiteText
                                        )
                                    }
                                }
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.Notifications,
                                contentDescription = "Notifications",
                                tint = WhiteText
                            )
                        }
                    }
                    IconButton(onClick = onNavigateToProfile) {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = "Settings",
                            tint = WhiteText
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = SlateBackground
                )
            )
        },
        containerColor = SlateDarker
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                AvailabilityCard(
                    isAvailable = isAvailable,
                    hasServices = hasServices,
                    isUpdating = isLoading,
                    onSetAvailable = { viewModel.setAvailability(true) },
                    onSetUnavailable = { viewModel.setAvailability(false) }
                )
            }

            item {
                MetricGrid(
                    todayEarnings = earningsSummary.todayEarnings,
                    monthEarnings = earningsSummary.monthEarnings,
                    pendingCount = pendingCount,
                    averageRating = averageRating
                )
            }

            item {
                SectionHeader(
                    title = "Pending Requests",
                    actionLabel = "View All",
                    onAction = onNavigateToBookings
                )
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    when {
                        isLoadingPendingBookings -> {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(24.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator(color = ProviderBlue)
                            }
                        }
                        pendingBookings.isEmpty() -> {
                            EmptyCardMessage("No pending requests")
                        }
                        else -> {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                pendingBookings.take(3).forEach { booking ->
                                    PendingBookingItem(
                                        booking = booking,
                                        onAccept = {
                                            actionBooking = booking
                                            isAcceptAction = true
                                            comments = ""
                                            showActionDialog = true
                                        },
                                        onReject = {
                                            actionBooking = booking
                                            isAcceptAction = false
                                            comments = ""
                                            showActionDialog = true
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }

            item {
                SectionHeader(
                    title = "Earnings by Customer",
                    actionLabel = "View All",
                    onAction = onNavigateToEarnings
                )
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        if (topCustomers.isEmpty()) {
                            Text(
                                text = "No earnings yet",
                                style = MaterialTheme.typography.bodySmall,
                                color = WhiteTextMuted
                            )
                        } else {
                            topCustomers.forEach { customer ->
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = customer.name,
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = WhiteText
                                        )
                                        Text(
                                            text = "${customer.count} job${if (customer.count == 1) "" else "s"}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = WhiteTextMuted
                                        )
                                    }
                                    Text(
                                        text = formatRupees(customer.total),
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = SuccessGreen,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                HorizontalDivider(color = GlassBorder)
                            }
                        }
                    }
                }
            }

            item {
                SectionHeader(
                    title = "Recent Booking History",
                    actionLabel = "View All",
                    onAction = onNavigateToBookings
                )
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    when {
                        isLoadingBookingHistory -> {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(24.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator(color = ProviderBlue)
                            }
                        }
                        bookingHistory.isEmpty() -> {
                            EmptyCardMessage("No booking history yet")
                        }
                        else -> {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                bookingHistory.take(4).forEach { booking ->
                                    HistoryBookingItem(booking = booking)
                                }
                            }
                        }
                    }
                }
            }

            item {
                SectionHeader(
                    title = "Upcoming Bookings",
                    actionLabel = "View All",
                    onAction = onNavigateToBookings
                )
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    if (upcomingBookings.isEmpty()) {
                        EmptyCardMessage("No upcoming bookings")
                    } else {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            upcomingBookings.forEach { booking ->
                                UpcomingBookingItem(booking = booking)
                            }
                        }
                    }
                }
            }

            item {
                SectionHeader(
                    title = "Recent Reviews",
                    actionLabel = "View All",
                    onAction = onNavigateToReviews
                )
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    when {
                        isLoadingReviews -> {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(24.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator(color = ProviderBlue)
                            }
                        }
                        reviews.isEmpty() -> {
                            EmptyCardMessage("No reviews yet")
                        }
                        else -> {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                reviews.take(5).forEach { review ->
                                    ReviewItem(review = review)
                                }
                            }
                        }
                    }
                }
            }

            item {
                SectionHeader(
                    title = "My Services",
                    actionLabel = "View All",
                    onAction = onNavigateToServices
                )
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    if (services.isEmpty()) {
                        EmptyCardMessage("No services yet")
                    } else {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            services.take(4).forEach { service ->
                                ServicePreviewItem(service = service)
                            }
                        }
                    }
                }
            }

            item {
                OutlinedButton(
                    onClick = onLogout,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = ErrorRed
                    )
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Logout,
                        contentDescription = null
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Logout")
                }
            }
        }
    }

    if (showActionDialog && actionBooking != null) {
        AlertDialog(
            onDismissRequest = { showActionDialog = false },
            title = {
                Text(
                    text = if (isAcceptAction) "Accept Booking" else "Reject Booking",
                    color = WhiteText
                )
            },
            text = {
                Column {
                    Text(
                        text = "${actionBooking?.serviceName} for ${actionBooking?.customerName}",
                        color = WhiteTextMuted
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    OutlinedTextField(
                        value = comments,
                        onValueChange = { comments = it },
                        label = { Text("Comments (optional)") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = if (isAcceptAction) SuccessGreen else ErrorRed,
                            unfocusedBorderColor = GlassBorder
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        actionBooking?.let {
                            if (isAcceptAction) {
                                viewModel.acceptBooking(it.id, comments.ifBlank { null })
                            } else {
                                viewModel.rejectBooking(it.id, comments.ifBlank { null })
                            }
                        }
                        showActionDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isAcceptAction) SuccessGreen else ErrorRed
                    )
                ) {
                    Text(if (isAcceptAction) "Accept" else "Reject")
                }
            },
            dismissButton = {
                TextButton(onClick = { showActionDialog = false }) {
                    Text("Cancel", color = WhiteTextMuted)
                }
            },
            containerColor = SlateCard
        )
    }
}

@Composable
private fun AvailabilityCard(
    isAvailable: Boolean,
    hasServices: Boolean,
    isUpdating: Boolean,
    onSetAvailable: () -> Unit,
    onSetUnavailable: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = if (isAvailable) "I am Working Today" else "I am Busy",
                style = MaterialTheme.typography.titleMedium,
                color = if (isAvailable) SuccessGreen else ErrorRed,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "One tap to pause all new requests.",
                style = MaterialTheme.typography.bodySmall,
                color = WhiteTextMuted
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Button(
                    onClick = onSetAvailable,
                    enabled = hasServices && !isUpdating,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isAvailable) SuccessGreen else SuccessGreen.copy(alpha = 0.2f),
                        contentColor = if (isAvailable) WhiteText else SuccessGreen
                    )
                ) {
                    Text("Working")
                }
                Button(
                    onClick = onSetUnavailable,
                    enabled = hasServices && !isUpdating,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (!isAvailable) ErrorRed else ErrorRed.copy(alpha = 0.2f),
                        contentColor = if (!isAvailable) WhiteText else ErrorRed
                    )
                ) {
                    Text("Busy")
                }
            }
            if (!hasServices) {
                Text(
                    text = "Add at least one service to go online.",
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted
                )
            }
        }
    }
}

@Composable
private fun MetricGrid(
    todayEarnings: Double,
    monthEarnings: Double,
    pendingCount: Int,
    averageRating: Double
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            MetricCard(
                title = "Today's earnings",
                value = formatRupees(todayEarnings),
                icon = Icons.Default.AccountBalanceWallet,
                accentColor = SuccessGreen,
                modifier = Modifier.weight(1f)
            )
            MetricCard(
                title = "Month earnings",
                value = formatRupees(monthEarnings),
                icon = Icons.Default.AccountBalanceWallet,
                accentColor = ProviderBlue,
                modifier = Modifier.weight(1f)
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            MetricCard(
                title = "Pending requests",
                value = pendingCount.toString(),
                icon = Icons.Default.Notifications,
                accentColor = OrangePrimary,
                modifier = Modifier.weight(1f)
            )
            MetricCard(
                title = "Average rating",
                value = if (averageRating == 0.0) "N/A" else String.format(Locale.US, "%.1f", averageRating),
                icon = Icons.Default.Star,
                accentColor = AmberSecondary,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun MetricCard(
    title: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    accentColor: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted
                )
                Icon(imageVector = icon, contentDescription = null, tint = accentColor)
            }
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                color = WhiteText,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun SectionHeader(
    title: String,
    actionLabel: String,
    onAction: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            color = WhiteText,
            fontWeight = FontWeight.Bold
        )
        TextButton(onClick = onAction) {
            Text(actionLabel, color = OrangePrimary)
        }
    }
}

@Composable
private fun EmptyCardMessage(message: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = message,
            style = MaterialTheme.typography.bodySmall,
            color = WhiteTextMuted
        )
    }
}

@Composable
private fun PendingBookingItem(
    booking: ProviderBooking,
    onAccept: () -> Unit,
    onReject: () -> Unit
) {
    val context = LocalContext.current
    val phoneDigits = booking.customer?.phone?.let { normalizePhoneNumber(it) }.orEmpty()
    val canContact = phoneDigits.isNotBlank()
    val whatsAppUri = buildWhatsAppUri(booking.customer?.phone, buildWhatsAppMessage(booking))
    val landmark = resolveLandmark(booking)
    val addressLine = formatAddressLine(booking)
    val locationLabel = if (booking.serviceLocation == "provider") {
        booking.providerAddress?.takeIf { it.isNotBlank() } ?: "Provider address not shared"
    } else {
        addressLine
    }
    val serviceMeta = listOfNotNull(
        booking.service?.price?.takeIf { it.isNotBlank() }?.let { "₹$it" } ?: "Price TBD",
        booking.service?.category?.takeIf { it.isNotBlank() },
        booking.service?.duration?.let { "$it mins" }
    ).joinToString(" • ")
    val expiresLabel = formatExpiryLabel(booking.expiresAt)

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = SlateBackground)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
                Text(
                    text = booking.serviceName,
                    style = MaterialTheme.typography.bodyMedium,
                    color = WhiteText,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = booking.customerName,
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted
                )
                Text(
                    text = "${formatBookingDate(booking.bookingDate)} • ${formatTimeSlot(booking.timeSlotLabel, booking.bookingDate)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = OrangePrimary
                )
                Text(
                    text = serviceMeta,
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted
                )
                if (booking.serviceLocation != "provider") {
                    Text(
                        text = "Landmark: $landmark",
                        style = MaterialTheme.typography.bodySmall,
                        color = WarningYellow
                    )
                }
                Text(
                    text = locationLabel,
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextSubtle
                )
                booking.proximityInfo?.message?.takeIf { it.isNotBlank() }?.let { message ->
                    Text(
                        text = message,
                        style = MaterialTheme.typography.bodySmall,
                        color = ProviderBlue
                    )
                }
                expiresLabel?.let { label ->
                    Text(
                        text = label,
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            if (canContact) {
                                val intent = Intent(Intent.ACTION_DIAL).apply {
                                    data = Uri.parse("tel:$phoneDigits")
                                }
                                context.startActivity(intent)
                            }
                        },
                        enabled = canContact,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = WhiteText)
                    ) {
                        Icon(Icons.Default.Phone, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Call")
                    }
                    OutlinedButton(
                        onClick = {
                            whatsAppUri?.let {
                                val intent = Intent(Intent.ACTION_VIEW, it)
                                context.startActivity(intent)
                            }
                        },
                        enabled = canContact && whatsAppUri != null,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = WhiteText)
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Message, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("WhatsApp")
                    }
                }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = onReject,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = ErrorRed)
                ) {
                    Text("Reject")
                }
                Button(
                    onClick = onAccept,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen)
                ) {
                    Text("Accept")
                }
            }
        }
    }
}

@Composable
private fun HistoryBookingItem(booking: ProviderBooking) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(SlateBackground, RoundedCornerShape(10.dp))
            .padding(12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = booking.serviceName,
                style = MaterialTheme.typography.bodyMedium,
                color = WhiteText,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = formatBookingDate(booking.bookingDate),
                style = MaterialTheme.typography.bodySmall,
                color = WhiteTextMuted
            )
        }
        StatusChip(status = booking.status)
    }
}

@Composable
private fun UpcomingBookingItem(booking: ProviderBooking) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(SlateBackground, RoundedCornerShape(10.dp))
            .padding(12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = booking.serviceName,
                style = MaterialTheme.typography.bodyMedium,
                color = WhiteText,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = "${formatBookingDate(booking.bookingDate)} • ${formatTimeSlot(booking.timeSlotLabel, booking.bookingDate)}",
                style = MaterialTheme.typography.bodySmall,
                color = WhiteTextMuted
            )
        }
        Icon(
            imageVector = Icons.Default.Schedule,
            contentDescription = null,
            tint = WhiteTextMuted
        )
    }
}

@Composable
private fun ReviewItem(review: ServiceReview) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(SlateBackground, RoundedCornerShape(10.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            repeat(5) { index ->
                Icon(
                    imageVector = Icons.Default.Star,
                    contentDescription = null,
                    tint = if (index < review.rating) AmberSecondary else WhiteTextMuted.copy(alpha = 0.3f),
                    modifier = Modifier.size(14.dp)
                )
            }
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = review.createdAt?.take(10) ?: "",
                style = MaterialTheme.typography.labelSmall,
                color = WhiteTextMuted
            )
        }
        Text(
            text = review.review?.takeIf { it.isNotBlank() } ?: "No comment",
            style = MaterialTheme.typography.bodySmall,
            color = WhiteText
        )
    }
}

@Composable
private fun ServicePreviewItem(service: ProviderService) {
    val isOnline = service.isAvailable && service.isAvailableNow != false
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(SlateBackground, RoundedCornerShape(10.dp))
            .padding(12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = service.name,
                style = MaterialTheme.typography.bodyMedium,
                color = WhiteText,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = "₹${service.price ?: "0"}",
                style = MaterialTheme.typography.bodySmall,
                color = SuccessGreen
            )
        }
        Text(
            text = if (isOnline) "Online" else "Paused",
            style = MaterialTheme.typography.labelSmall,
            color = if (isOnline) SuccessGreen else WarningYellow
        )
    }
}

@Composable
private fun StatusChip(status: String) {
    val color = when (status) {
        "pending", "rescheduled_pending_provider_approval" -> OrangePrimary
        "accepted", "rescheduled", "rescheduled_by_provider" -> ProviderBlue
        "en_route" -> ProviderBlue
        "awaiting_payment" -> WarningYellow
        "completed" -> SuccessGreen
        "rejected" -> ErrorRed
        else -> WhiteTextMuted
    }

    Surface(
        shape = RoundedCornerShape(6.dp),
        color = color.copy(alpha = 0.2f)
    ) {
        Text(
            text = status.replace("_", " ").replaceFirstChar { it.uppercase() },
            style = MaterialTheme.typography.labelSmall,
            color = color,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

private data class CustomerEarnings(
    val name: String,
    val total: Double,
    val count: Int
)

private data class EarningsSummary(
    val todayEarnings: Double,
    val monthEarnings: Double,
    val topCustomers: List<CustomerEarnings>
)

private fun buildEarningsSummary(bookings: List<ProviderBooking>): EarningsSummary {
    val todayKey = currentIndianDayKey()
    val monthKey = currentIndianMonthKey()

    val totalsByCustomer = mutableMapOf<String, CustomerEarnings>()
    var todayTotal = 0.0
    var monthTotal = 0.0

    bookings.forEach { booking ->
        if (booking.status !in setOf("completed", "awaiting_payment")) return@forEach
        val amount = booking.service?.price?.toDoubleOrNull() ?: return@forEach
        val bookingDay = bookingDayKey(booking.bookingDate)
        val bookingMonth = bookingMonthKey(booking.bookingDate)

        if (bookingDay != null && bookingDay == todayKey) {
            todayTotal += amount
        }
        if (bookingMonth != null && bookingMonth == monthKey) {
            monthTotal += amount
        }

        val name = booking.customer?.name?.takeIf { it.isNotBlank() } ?: "Customer"
        val key = booking.customer?.id?.let { "customer-$it" } ?: "booking-${booking.id}"
        val current = totalsByCustomer[key] ?: CustomerEarnings(name = name, total = 0.0, count = 0)
        totalsByCustomer[key] = current.copy(
            total = current.total + amount,
            count = current.count + 1
        )
    }

    val topCustomers = totalsByCustomer.values.sortedByDescending { it.total }.take(4)

    return EarningsSummary(
        todayEarnings = todayTotal,
        monthEarnings = monthTotal,
        topCustomers = topCustomers
    )
}

private fun buildUpcomingBookings(bookings: List<ProviderBooking>): List<ProviderBooking> {
    val todayKey = currentIndianDayKey()
    val activeStatuses = setOf("accepted", "rescheduled", "rescheduled_by_provider", "en_route")
    return bookings
        .filter { booking ->
            if (booking.status !in activeStatuses) return@filter false
            val bookingKey = bookingDayKey(booking.bookingDate) ?: return@filter false
            bookingKey >= todayKey
        }
        .sortedBy { it.bookingDate }
        .take(5)
}

private fun currentIndianDayKey(): String {
    return LocalDate.now(ZoneId.of("Asia/Kolkata")).toString()
}

private fun currentIndianMonthKey(): String {
    return YearMonth.now(ZoneId.of("Asia/Kolkata")).toString()
}

private fun bookingDayKey(dateStr: String?): String? {
    val instant = parseBookingInstant(dateStr) ?: return null
    return instant.atZone(ZoneId.of("Asia/Kolkata")).toLocalDate().toString()
}

private fun bookingMonthKey(dateStr: String?): String? {
    val instant = parseBookingInstant(dateStr) ?: return null
    return YearMonth.from(instant.atZone(ZoneId.of("Asia/Kolkata"))).toString()
}

private fun parseBookingInstant(dateStr: String?): Instant? {
    if (dateStr.isNullOrBlank()) return null
    return try {
        val clean = dateStr.substringBefore("[").trim()
        Instant.parse(if (clean.endsWith("Z")) clean else "${clean}Z")
    } catch (_: Exception) {
        null
    }
}

private fun formatBookingDate(dateStr: String?): String {
    val instant = parseBookingInstant(dateStr) ?: return "Date not set"
    val localDate = instant.atZone(ZoneId.of("Asia/Kolkata")).toLocalDate()
    return localDate.format(DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH))
}

private fun formatTimeSlot(timeSlot: String?, bookingDate: String?): String {
    val instant = parseBookingInstant(bookingDate)
    if (instant != null) {
        val localDateTime = instant.atZone(ZoneId.of("Asia/Kolkata")).toLocalDateTime()
        val timeString = localDateTime.format(DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH))
        if (!timeSlot.isNullOrBlank()) {
            val formattedSlot = timeSlot.lowercase().replaceFirstChar { it.uppercase() }
            return "$timeString ($formattedSlot)"
        }
        return timeString
    }
    if (timeSlot.isNullOrBlank()) return "Flexible time"
    val formattedSlot = timeSlot.lowercase().replaceFirstChar { it.uppercase() }
    return if (formattedSlot in listOf("Morning", "Afternoon", "Evening")) {
        "$formattedSlot (Flexible)"
    } else {
        formattedSlot
    }
}

private fun formatRupees(amount: Double): String {
    val formatter = NumberFormat.getNumberInstance(Locale("en", "IN")).apply {
        maximumFractionDigits = 0
    }
    return "₹${formatter.format(amount)}"
}

private fun normalizePhoneNumber(phone: String): String {
    return phone.filter { it.isDigit() }
}

private fun buildWhatsAppMessage(booking: ProviderBooking): String {
    val name = booking.customer?.name?.takeIf { it.isNotBlank() } ?: "there"
    val service = booking.serviceName
    return "Hello $name, I am coming in 10 mins for $service."
}

private fun buildWhatsAppUri(phone: String?, message: String?): Uri? {
    val digits = phone?.filter { it.isDigit() }?.takeIf { it.isNotBlank() } ?: return null
    val base = "https://wa.me/$digits"
    return if (!message.isNullOrBlank()) {
        Uri.parse("$base?text=${Uri.encode(message)}")
    } else {
        Uri.parse(base)
    }
}

private fun resolveLandmark(booking: ProviderBooking): String {
    val address = booking.relevantAddress
    val landmark = booking.customer?.addressLandmark?.trim()
        ?: address?.addressLandmark?.trim()
    if (!landmark.isNullOrBlank()) return landmark
    val street = address?.addressStreet?.trim()
    if (!street.isNullOrBlank()) return street
    val city = address?.addressCity?.trim()
    if (!city.isNullOrBlank()) return city
    val state = address?.addressState?.trim()
    if (!state.isNullOrBlank()) return state
    return "Location not shared"
}

private fun formatAddressLine(booking: ProviderBooking): String {
    val address = booking.relevantAddress
    if (address == null) return "Address not shared"
    val parts = listOf(
        address.addressStreet,
        address.addressCity,
        address.addressState,
        address.addressPostalCode
    ).mapNotNull { it?.trim()?.takeIf { value -> value.isNotBlank() } }
    return if (parts.isNotEmpty()) parts.joinToString(", ") else "Address not shared"
}

private fun formatExpiryLabel(expiresAt: String?): String? {
    val instant = parseBookingInstant(expiresAt) ?: return null
    val millisRemaining = instant.toEpochMilli() - System.currentTimeMillis()
    if (millisRemaining <= 0) return null
    val daysRemaining = ceil(millisRemaining / (1000.0 * 60 * 60 * 24)).toInt()
    if (daysRemaining <= 0) return null
    val unit = if (daysRemaining == 1) "day" else "days"
    return "Expires in $daysRemaining $unit"
}
