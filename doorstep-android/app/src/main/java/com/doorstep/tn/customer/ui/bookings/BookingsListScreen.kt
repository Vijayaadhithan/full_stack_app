package com.doorstep.tn.customer.ui.bookings

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.common.util.StatusUtils
import com.doorstep.tn.core.network.ServiceReview
import com.doorstep.tn.customer.data.model.Booking
import com.doorstep.tn.customer.ui.CustomerViewModel
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

/**
 * My Bookings Screen - Matches web app's /customer/bookings page exactly
 * Shows booking info INLINE - no navigation to detail page
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookingsListScreen(
    viewModel: CustomerViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val bookings by viewModel.bookings.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    
    // Time filter: Upcoming or Past (like web)
    var selectedTimeFilter by remember { mutableStateOf("Upcoming") }
    // Status filter (like web)
    var selectedStatusFilter by remember { mutableStateOf("All") }
    
    val timeFilters = listOf("Upcoming", "Past")
    val statusFilters = listOf("All", "Pending", "Accepted", "Rejected", "Completed")
    val reviewByBookingId = remember { mutableStateMapOf<Int, ServiceReview?>() }
    val reviewLoadingByBookingId = remember { mutableStateMapOf<Int, Boolean>() }
    val indiaZoneId = remember { ZoneId.of("Asia/Kolkata") }
    
    LaunchedEffect(Unit) {
        viewModel.loadBookings()
    }
    
    // Filter bookings by time and status (matching web logic)
    val today = LocalDate.now(indiaZoneId)
    val filteredBookings = bookings.filter { booking ->
        val normalizedStatus = normalizeBookingStatus(booking.status)
        val bookingDate = parseBookingLocalDate(booking.bookingDate, indiaZoneId)
        val isArchived = isArchivedBookingStatus(normalizedStatus)

        val timeMatch = when (selectedTimeFilter) {
            "Upcoming" -> bookingDate != null && !bookingDate.isBefore(today) && !isArchived
            "Past" -> isArchived || (bookingDate != null && bookingDate.isBefore(today))
            else -> true
        }

        val statusMatch = when (selectedStatusFilter) {
            "All" -> true
            "Pending" -> normalizedStatus == "pending"
            "Accepted" -> normalizedStatus == "accepted"
            "Rejected" -> normalizedStatus == "rejected"
            "Completed" -> normalizedStatus == "completed"
            else -> true
        }

        timeMatch && statusMatch
    }

    fun loadReviewForBooking(booking: Booking, force: Boolean = false) {
        val bookingId = booking.id
        val serviceId = booking.serviceId
        if (serviceId == null) {
            scope.launch {
                snackbarHostState.showSnackbar("Service not found for this booking")
            }
            return
        }

        if (!force && reviewByBookingId.containsKey(bookingId)) {
            return
        }
        if (reviewLoadingByBookingId[bookingId] == true) {
            return
        }

        reviewLoadingByBookingId[bookingId] = true
        viewModel.loadServiceReviewForBooking(
            serviceId = serviceId,
            bookingId = bookingId,
            onSuccess = { review ->
                reviewByBookingId[bookingId] = review
                reviewLoadingByBookingId[bookingId] = false
            },
            onError = { error ->
                reviewLoadingByBookingId[bookingId] = false
                scope.launch {
                    snackbarHostState.showSnackbar("Error: $error")
                }
            }
        )
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("My Bookings", color = WhiteText) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = WhiteText
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SlateBackground)
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = SlateDarker
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Time Filter Row (like web's WHEN section)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                timeFilters.forEach { filter ->
                    FilterChip(
                        selected = selectedTimeFilter == filter,
                        onClick = { selectedTimeFilter = filter },
                        label = { Text(filter) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = OrangePrimary,
                            selectedLabelColor = WhiteText,
                            containerColor = SlateCard,
                            labelColor = WhiteTextMuted
                        )
                    )
                }
            }
            
            // Status Filter Row (like web's STATUS section) - Scrollable to prevent truncation
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                statusFilters.forEach { filter ->
                    FilterChip(
                        selected = selectedStatusFilter == filter,
                        onClick = { selectedStatusFilter = filter },
                        label = { Text(filter) },
                        leadingIcon = if (selectedStatusFilter == filter) {
                            { Icon(Icons.Default.Check, null, Modifier.size(16.dp)) }
                        } else null,
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = OrangePrimary,
                            selectedLabelColor = WhiteText,
                            selectedLeadingIconColor = WhiteText,
                            containerColor = SlateCard,
                            labelColor = WhiteTextMuted
                        )
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            if (isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = ProviderBlue)
                }
            } else if (filteredBookings.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.EventBusy,
                            contentDescription = null,
                            tint = WhiteTextMuted,
                            modifier = Modifier.size(64.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "No bookings found",
                            style = MaterialTheme.typography.titleMedium,
                            color = WhiteTextMuted
                        )
                        Text(
                            text = "Pick a filter on the left.",
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteTextMuted.copy(alpha = 0.7f)
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(filteredBookings) { booking ->
                        val existingReview = reviewByBookingId[booking.id]
                        val isReviewLoading = reviewLoadingByBookingId[booking.id] == true

                        // Booking card with action buttons
                        BookingCardInline(
                            booking = booking,
                            existingReview = existingReview,
                            isReviewLoading = isReviewLoading,
                            onLoadExistingReview = { loadReviewForBooking(booking) },
                            onCancel = {
                                viewModel.cancelBooking(
                                    bookingId = booking.id,
                                    onSuccess = {
                                        scope.launch {
                                            snackbarHostState.showSnackbar("Booking cancelled successfully")
                                        }
                                    },
                                    onError = { error ->
                                        scope.launch {
                                            snackbarHostState.showSnackbar("Error: $error")
                                        }
                                    }
                                )
                            },
                            onReschedule = { newDateTime, comments ->
                                viewModel.rescheduleBooking(
                                    bookingId = booking.id,
                                    newBookingDate = newDateTime,
                                    comments = comments,
                                    onSuccess = {
                                        scope.launch {
                                            snackbarHostState.showSnackbar("Reschedule request submitted!")
                                        }
                                    },
                                    onError = { error ->
                                        scope.launch {
                                            snackbarHostState.showSnackbar("Error: $error")
                                        }
                                    }
                                )
                            },
                            onSubmitReview = { ratingValue, reviewText ->
                                booking.serviceId?.let { serviceId ->
                                    viewModel.submitReview(
                                        serviceId = serviceId,
                                        rating = ratingValue,
                                        review = reviewText.trim(),
                                        bookingId = booking.id,
                                        onSuccess = {
                                            scope.launch {
                                                snackbarHostState.showSnackbar("Review submitted successfully!")
                                            }
                                            loadReviewForBooking(booking, force = true)
                                        },
                                        onError = { error ->
                                            scope.launch {
                                                snackbarHostState.showSnackbar("Error: $error")
                                            }
                                        }
                                    )
                                }
                            },
                            onUpdateReview = { reviewId, ratingValue, reviewText ->
                                viewModel.updateServiceReview(
                                    reviewId = reviewId,
                                    rating = ratingValue,
                                    review = reviewText.trim(),
                                    onSuccess = {
                                        scope.launch {
                                            snackbarHostState.showSnackbar("Review updated successfully!")
                                        }
                                        loadReviewForBooking(booking, force = true)
                                    },
                                    onError = { error ->
                                        scope.launch {
                                            snackbarHostState.showSnackbar("Error: $error")
                                        }
                                    }
                                )
                            },
                            onSubmitPayment = { paymentReference ->
                                viewModel.submitBookingPayment(
                                    bookingId = booking.id,
                                    paymentReference = paymentReference,
                                    onSuccess = {
                                        scope.launch {
                                            snackbarHostState.showSnackbar("Payment submitted successfully")
                                        }
                                    },
                                    onError = { error ->
                                        scope.launch {
                                            snackbarHostState.showSnackbar("Error: $error")
                                        }
                                    }
                                )
                            },
                            onUpdateReference = { paymentReference ->
                                viewModel.updateBookingReference(
                                    bookingId = booking.id,
                                    paymentReference = paymentReference,
                                    onSuccess = {
                                        scope.launch {
                                            snackbarHostState.showSnackbar("Payment reference updated")
                                        }
                                    },
                                    onError = { error ->
                                        scope.launch {
                                            snackbarHostState.showSnackbar("Error: $error")
                                        }
                                    }
                                )
                            },
                            onReportDispute = { reason ->
                                viewModel.reportBookingDispute(
                                    bookingId = booking.id,
                                    reason = reason,
                                    onSuccess = {
                                        scope.launch {
                                            snackbarHostState.showSnackbar("Issue reported successfully")
                                        }
                                    },
                                    onError = { error ->
                                        scope.launch {
                                            snackbarHostState.showSnackbar("Error: $error")
                                        }
                                    }
                                )
                            },
                            onShowMessage = { message ->
                                scope.launch { snackbarHostState.showSnackbar(message) }
                            }
                        )
                    }
                }
            }
        }
    }
}

/**
 * Booking Card - Shows all booking info inline like web app
 * Includes actions for payment, reschedule, cancel, review, and dispute flows
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BookingCardInline(
    booking: Booking,
    existingReview: ServiceReview?,
    isReviewLoading: Boolean,
    onLoadExistingReview: () -> Unit,
    onCancel: () -> Unit,
    onReschedule: (String, String?) -> Unit,
    onSubmitReview: (Int, String) -> Unit,
    onUpdateReview: (Int, Int, String) -> Unit,
    onSubmitPayment: (String) -> Unit,
    onUpdateReference: (String) -> Unit,
    onReportDispute: (String) -> Unit,
    onShowMessage: (String) -> Unit
) {
    val statusColor = StatusUtils.getBookingStatusColor(booking.status)
    val statusBgColor = StatusUtils.getBookingStatusBgColor(booking.status)
    val statusLabel = StatusUtils.getBookingStatusLabel(booking.status)
    val context = LocalContext.current
    
    // Review dialog state
    var showReviewDialog by remember { mutableStateOf(false) }
    var rating by remember { mutableStateOf(5) }
    var reviewText by remember { mutableStateOf("") }

    LaunchedEffect(showReviewDialog) {
        if (showReviewDialog) {
            rating = existingReview?.rating ?: 5
            reviewText = existingReview?.review ?: ""
        }
    }

    LaunchedEffect(existingReview?.id, isReviewLoading) {
        if (showReviewDialog && existingReview != null && !isReviewLoading) {
            rating = existingReview.rating
            reviewText = existingReview.review ?: ""
        }
    }
    
    // Cancel confirmation dialog state
    var showCancelDialog by remember { mutableStateOf(false) }
    
    // Reschedule dialog state
    var showRescheduleDialog by remember { mutableStateOf(false) }
    var rescheduleComments by remember { mutableStateOf("") }
    val datePickerState = rememberDatePickerState(
        initialSelectedDateMillis = System.currentTimeMillis() + 86400000 // Tomorrow
    )
    val timePickerState = rememberTimePickerState(
        initialHour = 10,
        initialMinute = 0,
        is24Hour = false
    )

    // Payment dialog state
    var showPaymentDialog by remember { mutableStateOf(false) }
    var paymentMethod by remember { mutableStateOf("upi") }
    var paymentReference by remember(booking.id) {
        mutableStateOf(booking.paymentReference ?: "")
    }

    // Update reference dialog state
    var showUpdateReferenceDialog by remember { mutableStateOf(false) }

    // Dispute dialog state
    var showDisputeDialog by remember { mutableStateOf(false) }
    var disputeReason by remember { mutableStateOf("") }
    
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            // Header: Service name + Status badge (like web)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = booking.service?.name ?: "Service Booking",
                    style = MaterialTheme.typography.titleMedium,
                    color = WhiteText,
                    fontWeight = FontWeight.SemiBold
                )
                
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = statusBgColor
                ) {
                    Text(
                        text = statusLabel,
                        color = statusColor,
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // Date (formatted nicely like web: dd MMMM yyyy)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Event,
                    contentDescription = null,
                    tint = WhiteTextMuted,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = formatBookingDate(booking.bookingDate),
                    style = MaterialTheme.typography.bodyMedium,
                    color = WhiteTextMuted
                )
            }
            
            Spacer(modifier = Modifier.height(6.dp))
            
            // Time slot (like web: Morning (Flexible))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Schedule,
                    contentDescription = null,
                    tint = WhiteTextMuted,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = formatTimeSlot(booking.timeSlotLabel, booking.bookingDate),
                    style = MaterialTheme.typography.bodyMedium,
                    color = WhiteTextMuted
                )
            }
            
            Spacer(modifier = Modifier.height(6.dp))
            
            // Location (like web: Service at your location / Provider's location)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.LocationOn,
                    contentDescription = null,
                    tint = WhiteTextMuted,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = getLocationLabel(booking.serviceLocation),
                    style = MaterialTheme.typography.bodyMedium,
                    color = WhiteTextMuted
                )
            }
            
            // Provider info section (like web's provider section)
            booking.provider?.let { provider ->
                Spacer(modifier = Modifier.height(12.dp))
                HorizontalDivider(color = GlassWhite)
                Spacer(modifier = Modifier.height(12.dp))
                
                // Provider name (like web: Provider: Nason)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Provider: ",
                        style = MaterialTheme.typography.bodyMedium,
                        color = WhiteTextMuted,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = provider.name,
                        style = MaterialTheme.typography.bodyMedium,
                        color = WhiteText
                    )
                }
                
                // Provider phone (like web: Phone: 9488193696)
                provider.phone?.let { phone ->
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "Phone: ",
                            style = MaterialTheme.typography.bodyMedium,
                            color = WhiteTextMuted,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = phone,
                            style = MaterialTheme.typography.bodyMedium,
                            color = WhiteText
                        )
                    }
                }
                
                // Provider address (like web shows: Provider location: 7/152 Akarattur...)
                val providerAddress = buildProviderAddress(provider)
                if (providerAddress.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.LocationOn,
                            contentDescription = null,
                            tint = WhiteTextMuted,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Provider location: $providerAddress",
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteTextMuted,
                            maxLines = 2,
                            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                        )
                    }
                }
                
                // View on Map link (like web)
                val context = androidx.compose.ui.platform.LocalContext.current
                val hasLocation = provider.latitude != null && provider.longitude != null
                val hasAddress = providerAddress.isNotEmpty()
                
                if (hasLocation || hasAddress) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.clickable {
                            // Open Google Maps
                            val mapsUri = if (hasLocation) {
                                // Use lat/lng if available
                                android.net.Uri.parse("geo:${provider.latitude},${provider.longitude}?q=${provider.latitude},${provider.longitude}(Provider)")
                            } else {
                                // Use address if no coordinates
                                android.net.Uri.parse("geo:0,0?q=${android.net.Uri.encode(providerAddress)}")
                            }
                            val mapIntent = android.content.Intent(android.content.Intent.ACTION_VIEW, mapsUri)
                            mapIntent.setPackage("com.google.android.apps.maps")
                            try {
                                context.startActivity(mapIntent)
                            } catch (e: Exception) {
                                // If Google Maps not installed, open in browser
                                val browserUri = if (hasLocation) {
                                    android.net.Uri.parse("https://maps.google.com/?q=${provider.latitude},${provider.longitude}")
                                } else {
                                    android.net.Uri.parse("https://maps.google.com/?q=${android.net.Uri.encode(providerAddress)}")
                                }
                                context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, browserUri))
                            }
                        }
                    ) {
                        Text(
                            text = "(View on Map)",
                            style = MaterialTheme.typography.bodySmall,
                            color = ProviderBlue
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "🗺️",
                            style = MaterialTheme.typography.bodySmall
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Icon(
                            imageVector = Icons.Default.LocationOn,
                            contentDescription = "View on Map",
                            tint = ProviderBlue,
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
            }
            
            val status = normalizeBookingStatus(booking.status)
            val canCancel = status == "pending"
            val canReschedule = status == "pending"
            val canReview = status == "completed"
            val canCompletePayment = status == "accepted" || status == "en_route"
            val canManagePayment = status == "awaiting_payment"

            if (status == "awaiting_payment" && !booking.paymentReference.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Payment reference: ${booking.paymentReference}",
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted
                )
            }

            if (status == "disputed" && !booking.disputeReason.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Dispute: ${booking.disputeReason}",
                    style = MaterialTheme.typography.bodySmall,
                    color = ErrorRed
                )
            }

            if (canCompletePayment || canManagePayment || canCancel || canReschedule || canReview) {
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (canCompletePayment) {
                        Button(
                            onClick = {
                                paymentMethod = "upi"
                                paymentReference = ""
                                showPaymentDialog = true
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = ProviderBlue)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Payments,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Mark Complete & Pay")
                        }
                    }

                    if (canManagePayment) {
                        OutlinedButton(
                            onClick = {
                                paymentReference = booking.paymentReference ?: ""
                                showUpdateReferenceDialog = true
                            },
                            border = ButtonDefaults.outlinedButtonBorder(enabled = true).copy(
                                brush = androidx.compose.ui.graphics.SolidColor(ProviderBlue)
                            ),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = ProviderBlue)
                        ) {
                            Text("Update Reference")
                        }

                        OutlinedButton(
                            onClick = { showDisputeDialog = true },
                            border = ButtonDefaults.outlinedButtonBorder(enabled = true).copy(
                                brush = androidx.compose.ui.graphics.SolidColor(ErrorRed)
                            ),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = ErrorRed)
                        ) {
                            Text("Report Issue")
                        }
                    }

                    if (canReschedule) {
                        OutlinedButton(
                            onClick = { showRescheduleDialog = true },
                            border = ButtonDefaults.outlinedButtonBorder(enabled = true).copy(
                                brush = androidx.compose.ui.graphics.SolidColor(ProviderBlue)
                            ),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = ProviderBlue)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Schedule,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Reschedule")
                        }
                    }

                    if (canCancel) {
                        OutlinedButton(
                            onClick = { showCancelDialog = true },
                            border = ButtonDefaults.outlinedButtonBorder(enabled = true).copy(
                                brush = androidx.compose.ui.graphics.SolidColor(ErrorRed)
                            ),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = ErrorRed)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Cancel,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Cancel")
                        }
                    }

                    if (canReview) {
                        OutlinedButton(
                            onClick = {
                                if (booking.serviceId == null) {
                                    onShowMessage("Service not found for this booking")
                                    return@OutlinedButton
                                }
                                onLoadExistingReview()
                                showReviewDialog = true
                            },
                            border = ButtonDefaults.outlinedButtonBorder(enabled = true).copy(
                                brush = androidx.compose.ui.graphics.SolidColor(OrangePrimary)
                            ),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = OrangePrimary)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(if (existingReview != null) "Edit Review" else "Leave Review")
                        }
                    }
                }
            }
            
            // Rejected bookings: Show rejection reason
            if (normalizeBookingStatus(booking.status) == "rejected") {
                booking.rejectionReason?.let { reason ->
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Reason: $reason",
                        style = MaterialTheme.typography.bodySmall,
                        color = ErrorRed
                    )
                }
            }
        }
    }
    
    // Cancel confirmation dialog
    if (showCancelDialog) {
        AlertDialog(
            onDismissRequest = { showCancelDialog = false },
            containerColor = SlateCard,
            title = { Text("Cancel Booking", color = WhiteText) },
            text = { Text("Are you sure you want to cancel this booking?", color = WhiteTextMuted) },
            confirmButton = {
                TextButton(
                    onClick = {
                        showCancelDialog = false
                        onCancel()
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = ErrorRed)
                ) {
                    Text("Cancel Booking")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showCancelDialog = false },
                    colors = ButtonDefaults.textButtonColors(contentColor = WhiteTextMuted)
                ) {
                    Text("Keep Booking")
                }
            }
        )
    }
    
    // Review dialog
    if (showReviewDialog) {
        AlertDialog(
            onDismissRequest = { showReviewDialog = false },
            containerColor = SlateCard,
            title = {
                Text(
                    text = if (existingReview != null) "Update Review" else "Leave a Review",
                    color = WhiteText
                )
            },
            text = {
                Column {
                    if (isReviewLoading) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                color = OrangePrimary,
                                strokeWidth = 2.dp
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Loading review...", color = WhiteTextMuted)
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                    }
                    Text("Rating", color = WhiteTextMuted, style = MaterialTheme.typography.labelMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    Row {
                        (1..5).forEach { star ->
                            IconButton(
                                onClick = { rating = star },
                                enabled = !isReviewLoading
                            ) {
                                Icon(
                                    imageVector = if (star <= rating) Icons.Default.Star else Icons.Default.StarBorder,
                                    contentDescription = "Star $star",
                                    tint = if (star <= rating) OrangePrimary else WhiteTextMuted,
                                    modifier = Modifier.size(32.dp)
                                )
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    OutlinedTextField(
                        value = reviewText,
                        onValueChange = { reviewText = it },
                        label = { Text("Your review") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3,
                        enabled = !isReviewLoading,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = WhiteText,
                            unfocusedTextColor = WhiteTextMuted,
                            focusedBorderColor = OrangePrimary,
                            unfocusedBorderColor = GlassWhite
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val trimmedReview = reviewText.trim()
                        if (trimmedReview.isEmpty()) {
                            onShowMessage("Please enter a review")
                            return@Button
                        }
                        showReviewDialog = false
                        if (existingReview != null) {
                            onUpdateReview(existingReview.id, rating, trimmedReview)
                        } else {
                            onSubmitReview(rating, trimmedReview)
                        }
                        rating = 5
                        reviewText = ""
                    },
                    enabled = !isReviewLoading && reviewText.trim().isNotEmpty(),
                    colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary)
                ) {
                    Text(if (existingReview != null) "Update Review" else "Submit Review")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showReviewDialog = false },
                    colors = ButtonDefaults.textButtonColors(contentColor = WhiteTextMuted)
                ) {
                    Text("Cancel")
                }
            }
        )
    }

    // Payment dialog for accepted/en_route bookings
    if (showPaymentDialog) {
        AlertDialog(
            onDismissRequest = { showPaymentDialog = false },
            containerColor = SlateCard,
            title = { Text("Complete Payment", color = WhiteText) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Payment method", color = WhiteTextMuted)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(
                            selected = paymentMethod == "upi",
                            onClick = { paymentMethod = "upi" },
                            label = { Text("UPI") },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = OrangePrimary,
                                selectedLabelColor = WhiteText
                            )
                        )
                        FilterChip(
                            selected = paymentMethod == "cash",
                            onClick = { paymentMethod = "cash" },
                            label = { Text("Cash") },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = OrangePrimary,
                                selectedLabelColor = WhiteText
                            )
                        )
                    }

                    if (paymentMethod == "upi") {
                        val upiId = booking.provider?.upiId
                        if (!upiId.isNullOrBlank()) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "Pay to UPI: $upiId",
                                    color = WhiteTextMuted,
                                    modifier = Modifier.weight(1f)
                                )
                                TextButton(
                                    onClick = {
                                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                        clipboard.setPrimaryClip(ClipData.newPlainText("UPI ID", upiId))
                                        onShowMessage("UPI ID copied")
                                    }
                                ) {
                                    Text("Copy")
                                }
                            }
                        } else {
                            Text(
                                text = "UPI ID not available",
                                color = ErrorRed
                            )
                        }

                        booking.provider?.upiQrCodeUrl?.takeIf { it.isNotBlank() }?.let { qrUrl ->
                            AsyncImage(
                                model = qrUrl,
                                contentDescription = "UPI QR Code",
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(160.dp)
                                    .clip(RoundedCornerShape(8.dp))
                            )
                        }

                        OutlinedTextField(
                            value = paymentReference,
                            onValueChange = { paymentReference = it },
                            label = { Text("Transaction reference") },
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = WhiteText,
                                unfocusedTextColor = WhiteTextMuted,
                                focusedBorderColor = OrangePrimary,
                                unfocusedBorderColor = GlassWhite
                            )
                        )
                    } else {
                        Text(
                            text = "Cash payment will be confirmed by the provider.",
                            color = WhiteTextMuted
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val reference = if (paymentMethod == "cash") {
                            "CASH"
                        } else {
                            paymentReference.trim()
                        }

                        if (paymentMethod == "upi" && reference.isEmpty()) {
                            onShowMessage("Enter a transaction reference")
                            return@Button
                        }

                        showPaymentDialog = false
                        onSubmitPayment(reference)
                        paymentReference = ""
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ProviderBlue)
                ) {
                    Text("Submit Payment")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showPaymentDialog = false },
                    colors = ButtonDefaults.textButtonColors(contentColor = WhiteTextMuted)
                ) {
                    Text("Cancel")
                }
            }
        )
    }

    // Update payment reference dialog
    if (showUpdateReferenceDialog) {
        AlertDialog(
            onDismissRequest = { showUpdateReferenceDialog = false },
            containerColor = SlateCard,
            title = { Text("Update Reference", color = WhiteText) },
            text = {
                OutlinedTextField(
                    value = paymentReference,
                    onValueChange = { paymentReference = it },
                    label = { Text("Transaction reference") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = WhiteText,
                        unfocusedTextColor = WhiteTextMuted,
                        focusedBorderColor = ProviderBlue,
                        unfocusedBorderColor = GlassWhite
                    )
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val reference = paymentReference.trim()
                        if (reference.isEmpty()) {
                            onShowMessage("Enter a transaction reference")
                            return@Button
                        }
                        showUpdateReferenceDialog = false
                        onUpdateReference(reference)
                        paymentReference = ""
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ProviderBlue)
                ) {
                    Text("Save")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showUpdateReferenceDialog = false },
                    colors = ButtonDefaults.textButtonColors(contentColor = WhiteTextMuted)
                ) {
                    Text("Cancel")
                }
            }
        )
    }

    // Report dispute dialog
    if (showDisputeDialog) {
        AlertDialog(
            onDismissRequest = { showDisputeDialog = false },
            containerColor = SlateCard,
            title = { Text("Report Issue", color = WhiteText) },
            text = {
                OutlinedTextField(
                    value = disputeReason,
                    onValueChange = { disputeReason = it },
                    label = { Text("Describe the issue") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = WhiteText,
                        unfocusedTextColor = WhiteTextMuted,
                        focusedBorderColor = ErrorRed,
                        unfocusedBorderColor = GlassWhite
                    )
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val reason = disputeReason.trim()
                        if (reason.length < 5) {
                            onShowMessage("Please enter at least 5 characters")
                            return@Button
                        }
                        showDisputeDialog = false
                        onReportDispute(reason)
                        disputeReason = ""
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ErrorRed)
                ) {
                    Text("Submit")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showDisputeDialog = false },
                    colors = ButtonDefaults.textButtonColors(contentColor = WhiteTextMuted)
                ) {
                    Text("Cancel")
                }
            }
        )
    }
    
    // Reschedule dialog with DatePicker
    if (showRescheduleDialog) {
        DatePickerDialog(
            onDismissRequest = { showRescheduleDialog = false },
            confirmButton = {
                Button(
                    onClick = {
                        val selectedMillis = datePickerState.selectedDateMillis
                        if (selectedMillis == null) {
                            onShowMessage("Please select a date")
                            return@Button
                        }

                        val zoneId = ZoneId.systemDefault()
                        val selectedDate = Instant.ofEpochMilli(selectedMillis)
                            .atZone(zoneId)
                            .toLocalDate()
                        val selectedTime = LocalTime.of(
                            timePickerState.hour,
                            timePickerState.minute
                        )
                        val selectedDateTime = ZonedDateTime.of(selectedDate, selectedTime, zoneId)

                        if (selectedDateTime.toInstant().isBefore(Instant.now())) {
                            onShowMessage("Please select a future time")
                            return@Button
                        }

                        showRescheduleDialog = false
                        onReschedule(
                            selectedDateTime.toInstant().toString(),
                            rescheduleComments.takeIf { it.isNotBlank() }
                        )
                        rescheduleComments = ""
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ProviderBlue)
                ) {
                    Text("Reschedule")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showRescheduleDialog = false },
                    colors = ButtonDefaults.textButtonColors(contentColor = WhiteTextMuted)
                ) {
                    Text("Cancel")
                }
            },
            colors = DatePickerDefaults.colors(
                containerColor = SlateCard
            )
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    "Select New Date",
                    style = MaterialTheme.typography.titleMedium,
                    color = WhiteText,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
                DatePicker(
                    state = datePickerState,
                    title = null,
                    headline = null,
                    showModeToggle = false,
                    colors = DatePickerDefaults.colors(
                        containerColor = SlateCard,
                        titleContentColor = WhiteText,
                        headlineContentColor = WhiteText,
                        weekdayContentColor = WhiteTextMuted,
                        dayContentColor = WhiteText,
                        selectedDayContainerColor = ProviderBlue,
                        selectedDayContentColor = WhiteText,
                        todayContentColor = OrangePrimary,
                        todayDateBorderColor = OrangePrimary
                    )
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    "Select Time",
                    style = MaterialTheme.typography.titleSmall,
                    color = WhiteText
                )
                Spacer(modifier = Modifier.height(8.dp))
                TimePicker(state = timePickerState)
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = rescheduleComments,
                    onValueChange = { rescheduleComments = it },
                    label = { Text("Comments (optional)") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = WhiteText,
                        unfocusedTextColor = WhiteTextMuted,
                        focusedBorderColor = ProviderBlue,
                        unfocusedBorderColor = GlassWhite
                    )
                )
            }
        }
    }
}

/**
 * Format booking date like web: "07 January 2026" (in IST)
 */
private fun formatBookingDate(dateStr: String?): String {
    if (dateStr.isNullOrEmpty()) return "Date not set"
    
    return try {
        // Parse ISO format and convert to IST
        val cleanDate = dateStr.substringBefore("[").trim()
        val instant = java.time.Instant.parse(
            if (cleanDate.endsWith("Z")) cleanDate else "${cleanDate}Z"
        )
        val istZone = java.time.ZoneId.of("Asia/Kolkata")
        val localDateTime = instant.atZone(istZone).toLocalDateTime()
        localDateTime.format(DateTimeFormatter.ofPattern("dd MMMM yyyy"))
    } catch (e: Exception) {
        try {
            // Try date only format
            val date = LocalDate.parse(dateStr.take(10))
            date.format(DateTimeFormatter.ofPattern("dd MMMM yyyy"))
        } catch (e2: Exception) {
            dateStr.take(10) // Fallback: return raw date part
        }
    }
}

/**
 * Format time slot like web - shows actual time (e.g., "05:30 AM") from bookingDate
 * Server sends time in UTC (ends with Z), need to convert to local timezone
 */
private fun formatTimeSlot(timeSlot: String?, bookingDate: String?): String {
    // First try to extract time from bookingDate (like web shows "05:30 AM")
    if (!bookingDate.isNullOrEmpty()) {
        try {
            // Parse ISO format: 2026-01-07T00:00:00.000Z (UTC)
            // Convert to IST timezone
            val instant = java.time.Instant.parse(bookingDate)
            val istZone = java.time.ZoneId.of("Asia/Kolkata")
            val localDateTime = instant.atZone(istZone).toLocalDateTime()
            val timeString = localDateTime.format(DateTimeFormatter.ofPattern("hh:mm a"))
            
            // If we have a slot label, include it
            if (!timeSlot.isNullOrEmpty()) {
                val formattedSlot = timeSlot.lowercase().replaceFirstChar { it.uppercase() }
                return "$timeString ($formattedSlot)"
            }
            return timeString
        } catch (e: Exception) {
            // Fall through to slot-based logic
        }
    }
    
    // Fallback to time slot label if no time in bookingDate
    if (timeSlot.isNullOrEmpty()) return "Flexible time"
    
    // Capitalize first letter and add (Flexible) if it's a general slot
    val formattedSlot = timeSlot.lowercase().replaceFirstChar { it.uppercase() }
    
    return when {
        formattedSlot in listOf("Morning", "Afternoon", "Evening") -> "$formattedSlot (Flexible)"
        else -> formattedSlot
    }
}

/**
 * Get location label like web
 */
private fun getLocationLabel(location: String?): String {
    return when (location?.lowercase()) {
        "customer" -> "Service at your location"
        "provider" -> "Provider's location"
        else -> location ?: "Location not set"
    }
}

/**
 * Build provider address from ProviderInfo fields
 */
private fun buildProviderAddress(provider: com.doorstep.tn.customer.data.model.ProviderInfo): String {
    val parts = mutableListOf<String>()
    provider.addressStreet?.let { if (it.isNotBlank()) parts.add(it) }
    provider.addressCity?.let { if (it.isNotBlank()) parts.add(it) }
    provider.addressState?.let { if (it.isNotBlank()) parts.add(it) }
    provider.addressPostalCode?.let { if (it.isNotBlank()) parts.add(it) }
    provider.addressCountry?.let { if (it.isNotBlank()) parts.add(it) }
    return parts.joinToString(", ")
}

private fun normalizeBookingStatus(status: String?): String {
    return status?.lowercase()?.replace(" ", "_") ?: ""
}

private fun isArchivedBookingStatus(status: String): Boolean {
    return status in listOf("completed", "cancelled", "rejected", "expired")
}

private fun parseBookingLocalDate(dateStr: String?, zoneId: ZoneId): LocalDate? {
    if (dateStr.isNullOrBlank()) return null

    val trimmed = dateStr.substringBefore("[").trim()
    val timePart = trimmed.substringAfter("T", "")
    val hasZoneOffset = timePart.contains("Z") ||
        timePart.contains("z") ||
        timePart.contains("+") ||
        timePart.contains("-")
    val normalized = if (timePart.isNotEmpty() && !hasZoneOffset) "${trimmed}Z" else trimmed

    val instant = runCatching { Instant.parse(normalized) }.getOrNull()
    if (instant != null) {
        return instant.atZone(zoneId).toLocalDate()
    }

    return runCatching { LocalDate.parse(trimmed.take(10)) }.getOrNull()
}
