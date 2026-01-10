package com.doorstep.tn.customer.ui.bookings

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
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.common.util.StatusUtils
import com.doorstep.tn.customer.data.model.Booking
import com.doorstep.tn.customer.ui.CustomerViewModel
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

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
    
    LaunchedEffect(Unit) {
        viewModel.loadBookings()
    }
    
    // Filter bookings by time and status (matching web logic)
    val today = LocalDate.now()
    val filteredBookings = bookings.filter { booking ->
        val bookingDate = try {
            // Parse ISO date format
            LocalDate.parse(booking.bookingDate?.take(10) ?: "")
        } catch (e: Exception) {
            today
        }
        
        val timeMatch = when (selectedTimeFilter) {
            "Upcoming" -> !bookingDate.isBefore(today) && 
                         booking.status.lowercase() !in listOf("completed", "cancelled", "rejected")
            "Past" -> bookingDate.isBefore(today) || 
                     booking.status.lowercase() in listOf("completed", "cancelled", "rejected")
            else -> true
        }
        
        val statusMatch = when (selectedStatusFilter) {
            "All" -> true
            "Pending" -> booking.status.lowercase() == "pending"
            "Accepted" -> booking.status.lowercase() in listOf("accepted", "en_route")
            "Rejected" -> booking.status.lowercase() == "rejected"
            "Completed" -> booking.status.lowercase() == "completed"
            else -> true
        }
        
        timeMatch && statusMatch
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
                        // Booking card with action buttons
                        BookingCardInline(
                            booking = booking,
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
                            onReview = { ratingValue, reviewText ->
                                booking.serviceId?.let { serviceId ->
                                    viewModel.submitReview(
                                        serviceId = serviceId,
                                        rating = ratingValue,
                                        review = reviewText,
                                        bookingId = booking.id,
                                        onSuccess = {
                                            scope.launch {
                                                snackbarHostState.showSnackbar("Review submitted successfully!")
                                            }
                                        },
                                        onError = { error ->
                                            scope.launch {
                                                snackbarHostState.showSnackbar("Error: $error")
                                            }
                                        }
                                    )
                                }
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
 * Includes action buttons: Cancel (for pending), Reschedule (for pending/accepted), Review (for completed)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BookingCardInline(
    booking: Booking,
    onCancel: () -> Unit,
    onReschedule: (String, String?) -> Unit,
    onReview: (Int, String) -> Unit
) {
    val statusColor = StatusUtils.getBookingStatusColor(booking.status)
    val statusBgColor = StatusUtils.getBookingStatusBgColor(booking.status)
    val statusLabel = StatusUtils.getBookingStatusLabel(booking.status)
    
    // Review dialog state
    var showReviewDialog by remember { mutableStateOf(false) }
    var rating by remember { mutableStateOf(5) }
    var reviewText by remember { mutableStateOf("") }
    
    // Cancel confirmation dialog state
    var showCancelDialog by remember { mutableStateOf(false) }
    
    // Reschedule dialog state
    var showRescheduleDialog by remember { mutableStateOf(false) }
    var rescheduleDate by remember { mutableStateOf(LocalDate.now().plusDays(1)) }
    var rescheduleComments by remember { mutableStateOf("") }
    val datePickerState = rememberDatePickerState(
        initialSelectedDateMillis = System.currentTimeMillis() + 86400000 // Tomorrow
    )
    
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
            
            // Action buttons row
            val canCancel = booking.status.lowercase() in listOf("pending", "accepted")
            val canReschedule = booking.status.lowercase() in listOf("pending", "accepted")
            val canReview = booking.status.lowercase() == "completed"
            
            if (canCancel || canReschedule || canReview) {
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Cancel button (for pending/accepted bookings)
                    if (canCancel) {
                        OutlinedButton(
                            onClick = { showCancelDialog = true },
                            border = ButtonDefaults.outlinedButtonBorder.copy(
                                brush = androidx.compose.ui.graphics.SolidColor(ErrorRed)
                            ),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = ErrorRed
                            )
                        ) {
                            Icon(
                                imageVector = Icons.Default.Cancel,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Cancel")
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    
                    // Reschedule button (for pending/accepted bookings)
                    if (canReschedule) {
                        OutlinedButton(
                            onClick = { showRescheduleDialog = true },
                            border = ButtonDefaults.outlinedButtonBorder.copy(
                                brush = androidx.compose.ui.graphics.SolidColor(ProviderBlue)
                            ),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = ProviderBlue
                            )
                        ) {
                            Icon(
                                imageVector = Icons.Default.Schedule,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Reschedule")
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    
                    // Review button (for completed bookings)
                    if (canReview) {
                        OutlinedButton(
                            onClick = { showReviewDialog = true },
                            border = ButtonDefaults.outlinedButtonBorder.copy(
                                brush = androidx.compose.ui.graphics.SolidColor(OrangePrimary)
                            ),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = OrangePrimary
                            )
                        ) {
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Leave Review")
                        }
                    }
                }
            }
            
            // Rejected bookings: Show rejection reason
            if (booking.status.lowercase() == "rejected") {
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
            title = { Text("Leave a Review", color = WhiteText) },
            text = {
                Column {
                    Text("Rating", color = WhiteTextMuted, style = MaterialTheme.typography.labelMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    Row {
                        (1..5).forEach { star ->
                            IconButton(onClick = { rating = star }) {
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
                        label = { Text("Your review (optional)") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3,
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
                        showReviewDialog = false
                        onReview(rating, reviewText)
                        rating = 5
                        reviewText = ""
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary)
                ) {
                    Text("Submit Review")
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
    
    // Reschedule dialog with DatePicker
    if (showRescheduleDialog) {
        DatePickerDialog(
            onDismissRequest = { showRescheduleDialog = false },
            confirmButton = {
                Button(
                    onClick = {
                        showRescheduleDialog = false
                        // Convert selected date millis to ISO format
                        datePickerState.selectedDateMillis?.let { millis ->
                            val selectedDate = java.time.Instant.ofEpochMilli(millis)
                                .atZone(java.time.ZoneId.systemDefault())
                                .toLocalDate()
                            val isoDate = selectedDate.format(DateTimeFormatter.ISO_DATE)
                            onReschedule(isoDate, rescheduleComments.takeIf { it.isNotBlank() })
                        }
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
    return parts.joinToString(", ")
}
