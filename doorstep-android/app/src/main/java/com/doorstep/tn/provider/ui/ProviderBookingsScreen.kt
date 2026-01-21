package com.doorstep.tn.provider.ui

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.provider.data.model.ProviderBooking
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Calendar
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProviderBookingsScreen(
    viewModel: ProviderViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val bookings by viewModel.bookings.collectAsState()
    val isLoading by viewModel.isLoadingBookings.collectAsState()
    val error by viewModel.error.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    var selectedStatus by remember { mutableStateOf("all") }
    var dateFilter by remember { mutableStateOf<LocalDate?>(null) }
    var showStatusMenu by remember { mutableStateOf(false) }

    var actionBooking by remember { mutableStateOf<ProviderBooking?>(null) }
    var actionType by remember { mutableStateOf<BookingAction?>(null) }
    var actionComments by remember { mutableStateOf("") }
    var rescheduleDateTime by remember { mutableStateOf<LocalDateTime?>(null) }
    var showActionDialog by remember { mutableStateOf(false) }

    var disputeBooking by remember { mutableStateOf<ProviderBooking?>(null) }
    var disputeReason by remember { mutableStateOf("") }
    var showDisputeDialog by remember { mutableStateOf(false) }

    val statusOptions = listOf(
        "all" to "All",
        "pending" to "Pending",
        "accepted" to "Accepted",
        "en_route" to "En Route",
        "awaiting_payment" to "Awaiting Payment",
        "rescheduled" to "Rescheduled",
        "rescheduled_by_provider" to "Rescheduled by Provider",
        "rescheduled_pending_provider_approval" to "Reschedule Requested",
        "rejected" to "Rejected",
        "completed" to "Completed"
    )

    val statusCounts = remember(bookings) {
        val counts = mutableMapOf<String, Int>()
        bookings.forEach { booking ->
            counts[booking.status] = (counts[booking.status] ?: 0) + 1
        }
        counts
    }

    val filteredBookings = remember(bookings, selectedStatus, dateFilter) {
        bookings.filter { booking ->
            val statusMatches = selectedStatus == "all" || booking.status == selectedStatus
            val dateMatches = dateFilter?.let { filterDate ->
                val bookingDate = parseBookingLocalDate(booking.bookingDate)
                bookingDate == filterDate
            } ?: true
            statusMatches && dateMatches
        }
    }

    LaunchedEffect(Unit) {
        viewModel.loadAllBookings()
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

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Bookings",
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
        ) {
            FilterBar(
                selectedStatus = selectedStatus,
                dateFilter = dateFilter,
                statusOptions = statusOptions,
                statusCounts = statusCounts,
                showStatusMenu = showStatusMenu,
                onToggleStatusMenu = { showStatusMenu = it },
                onStatusSelected = { selectedStatus = it },
                onDateSelected = { dateFilter = it },
                onClearFilters = {
                    selectedStatus = "all"
                    dateFilter = null
                }
            )

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
                    Text(
                        text = "No bookings found",
                        color = WhiteTextMuted
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(filteredBookings) { booking ->
                        BookingCard(
                            booking = booking,
                            onAccept = {
                                actionBooking = booking
                                actionType = BookingAction.ACCEPT
                                actionComments = ""
                                rescheduleDateTime = null
                                showActionDialog = true
                            },
                            onReject = {
                                actionBooking = booking
                                actionType = BookingAction.REJECT
                                actionComments = ""
                                rescheduleDateTime = null
                                showActionDialog = true
                            },
                            onReschedule = {
                                actionBooking = booking
                                actionType = BookingAction.RESCHEDULE
                                actionComments = ""
                                rescheduleDateTime = null
                                showActionDialog = true
                            },
                            onComplete = {
                                actionBooking = booking
                                actionType = BookingAction.COMPLETE
                                actionComments = ""
                                rescheduleDateTime = null
                                showActionDialog = true
                            },
                            onStartJob = { viewModel.markEnRoute(booking.id) },
                            onConfirmPayment = { viewModel.confirmPayment(booking.id) },
                            onReportIssue = {
                                disputeBooking = booking
                                disputeReason = ""
                                showDisputeDialog = true
                            },
                            onCallCustomer = {
                                booking.customer?.phone?.let { phone ->
                                    val digits = normalizePhoneNumber(phone)
                                    if (digits.isNotBlank()) {
                                        val intent = Intent(Intent.ACTION_DIAL).apply {
                                            data = Uri.parse("tel:$digits")
                                        }
                                        context.startActivity(intent)
                                    }
                                }
                            },
                            onWhatsAppCustomer = {
                                val message = buildWhatsAppMessage(booking)
                                val uri = buildWhatsAppUri(booking.customer?.phone, message)
                                if (uri != null) {
                                    val intent = Intent(Intent.ACTION_VIEW, uri)
                                    context.startActivity(intent)
                                }
                            },
                            onOpenMap = {
                                val lat = booking.customer?.latitude
                                val lng = booking.customer?.longitude
                                val address = if (booking.serviceLocation == "provider") {
                                    booking.providerAddress
                                } else {
                                    booking.formattedAddress
                                }
                                val uri = buildMapsUri(lat, lng, address)
                                if (uri != null) {
                                    val intent = Intent(Intent.ACTION_VIEW, uri)
                                    context.startActivity(intent)
                                }
                            }
                        )
                    }
                }
            }
        }
    }

    if (showActionDialog && actionBooking != null && actionType != null) {
        BookingActionDialog(
            booking = actionBooking!!,
            actionType = actionType!!,
            comments = actionComments,
            onCommentsChange = { actionComments = it },
            rescheduleDateTime = rescheduleDateTime,
            onRescheduleDateTimeChange = { rescheduleDateTime = it },
            onDismiss = { showActionDialog = false },
            onConfirm = {
                val bookingId = actionBooking!!.id
                when (actionType) {
                    BookingAction.ACCEPT -> viewModel.acceptBooking(bookingId, actionComments.ifBlank { null })
                    BookingAction.REJECT -> viewModel.rejectBooking(bookingId, actionComments.ifBlank { null })
                    BookingAction.RESCHEDULE -> {
                        val dateTime = rescheduleDateTime
                        if (dateTime != null) {
                            val iso = dateTime.atZone(ZoneId.systemDefault()).toInstant().toString()
                            viewModel.rescheduleBooking(bookingId, iso, actionComments.ifBlank { null })
                        }
                    }
                    BookingAction.COMPLETE -> viewModel.completeBooking(bookingId, actionComments.ifBlank { null })
                    null -> { /* no action */ }
                }
                showActionDialog = false
            }
        )
    }

    if (showDisputeDialog && disputeBooking != null) {
        AlertDialog(
            onDismissRequest = { showDisputeDialog = false },
            title = { Text("Report Issue", color = WhiteText) },
            text = {
                Column {
                    Text(
                        text = "Describe the issue for booking #${disputeBooking!!.id}",
                        color = WhiteTextMuted
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = disputeReason,
                        onValueChange = { disputeReason = it },
                        label = { Text("Issue details") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = ErrorRed,
                            unfocusedBorderColor = GlassBorder,
                            focusedTextColor = WhiteText,
                            unfocusedTextColor = WhiteText
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.reportDispute(disputeBooking!!.id, disputeReason.trim())
                        showDisputeDialog = false
                    },
                    enabled = disputeReason.trim().isNotEmpty(),
                    colors = ButtonDefaults.buttonColors(containerColor = ErrorRed)
                ) {
                    Text("Submit")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDisputeDialog = false }) {
                    Text("Cancel", color = WhiteTextMuted)
                }
            },
            containerColor = SlateCard
        )
    }
}

private enum class BookingAction {
    ACCEPT,
    REJECT,
    RESCHEDULE,
    COMPLETE
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FilterBar(
    selectedStatus: String,
    dateFilter: LocalDate?,
    statusOptions: List<Pair<String, String>>,
    statusCounts: Map<String, Int>,
    showStatusMenu: Boolean,
    onToggleStatusMenu: (Boolean) -> Unit,
    onStatusSelected: (String) -> Unit,
    onDateSelected: (LocalDate?) -> Unit,
    onClearFilters: () -> Unit
) {
    val context = LocalContext.current
    val dateLabel = dateFilter?.format(DateTimeFormatter.ofPattern("dd MMM yyyy")) ?: "Select date"

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        ExposedDropdownMenuBox(
            expanded = showStatusMenu,
            onExpandedChange = onToggleStatusMenu
        ) {
            OutlinedTextField(
                value = statusOptions.firstOrNull { it.first == selectedStatus }?.second ?: "All",
                onValueChange = {},
                readOnly = true,
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = showStatusMenu) },
                label = { Text("Status", color = WhiteTextMuted) },
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = ProviderBlue,
                    unfocusedBorderColor = GlassBorder,
                    focusedTextColor = WhiteText,
                    unfocusedTextColor = WhiteText
                )
            )
            ExposedDropdownMenu(
                expanded = showStatusMenu,
                onDismissRequest = { onToggleStatusMenu(false) }
            ) {
                statusOptions.forEach { (value, label) ->
                    val count = if (value == "all") {
                        statusCounts.values.sum()
                    } else {
                        statusCounts[value] ?: 0
                    }
                    DropdownMenuItem(
                        text = { Text("$label ($count)") },
                        onClick = {
                            onStatusSelected(value)
                            onToggleStatusMenu(false)
                        }
                    )
                }
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedButton(
                onClick = {
                    val calendar = Calendar.getInstance()
                    val initialDate = dateFilter ?: LocalDate.now()
                    DatePickerDialog(
                        context,
                        { _, year, month, day ->
                            onDateSelected(LocalDate.of(year, month + 1, day))
                        },
                        initialDate.year,
                        initialDate.monthValue - 1,
                        initialDate.dayOfMonth
                    ).show()
                },
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = WhiteText)
            ) {
                Icon(Icons.Default.CalendarMonth, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(dateLabel)
            }

            OutlinedButton(
                onClick = onClearFilters,
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = WhiteTextMuted)
            ) {
                Text("Clear filters")
            }
        }
    }
}

@Composable
private fun BookingCard(
    booking: ProviderBooking,
    onAccept: () -> Unit,
    onReject: () -> Unit,
    onReschedule: () -> Unit,
    onComplete: () -> Unit,
    onStartJob: () -> Unit,
    onConfirmPayment: () -> Unit,
    onReportIssue: () -> Unit,
    onCallCustomer: () -> Unit,
    onWhatsAppCustomer: () -> Unit,
    onOpenMap: () -> Unit
) {
    val phoneDigits = booking.customer?.phone?.let { normalizePhoneNumber(it) }.orEmpty()
    val canContact = phoneDigits.isNotBlank()
    val durationLabel = booking.service?.duration?.let { "$it mins" }
    val serviceMeta = listOfNotNull(
        booking.service?.price?.takeIf { it.isNotBlank() }?.let { "₹$it" } ?: "Price TBD",
        durationLabel
    ).joinToString(" • ")

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = booking.serviceName,
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = booking.customerName,
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                }
                StatusBadge(status = booking.status)
            }

            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.CalendarMonth,
                    contentDescription = null,
                    tint = OrangePrimary,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = formatBookingDate(booking.bookingDate),
                    style = MaterialTheme.typography.bodySmall,
                    color = OrangePrimary
                )
                Spacer(modifier = Modifier.width(12.dp))
                Icon(
                    imageVector = Icons.Default.Schedule,
                    contentDescription = null,
                    tint = WhiteTextMuted,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = formatTimeSlot(booking.timeSlotLabel, booking.bookingDate),
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted
                )
            }

            Text(
                text = serviceMeta,
                style = MaterialTheme.typography.bodySmall,
                color = WhiteTextMuted
            )

            Text(
                text = if (booking.serviceLocation == "provider") "Service at provider location" else "Service at customer location",
                style = MaterialTheme.typography.bodySmall,
                color = WhiteTextSubtle
            )

            if (booking.serviceLocation == "provider") {
                Text(
                    text = booking.providerAddress?.takeIf { it.isNotBlank() } ?: "Provider address not shared",
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextSubtle
                )
            } else {
                val landmark = booking.customer?.addressLandmark?.takeIf { it.isNotBlank() }
                    ?: booking.relevantAddress?.addressLandmark?.takeIf { it.isNotBlank() }
                if (landmark != null) {
                    Text(
                        text = "Landmark: $landmark",
                        style = MaterialTheme.typography.bodySmall,
                        color = WarningYellow
                    )
                }
                Text(
                    text = booking.formattedAddress,
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextSubtle
                )
            }

            if (booking.customer?.phone != null) {
                Text(
                    text = "${booking.customer.phone}",
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextSubtle
                )
            }

            if (booking.status == "rescheduled" && !booking.rescheduleDate.isNullOrBlank()) {
                Text(
                    text = "Rescheduled: ${formatBookingDate(booking.rescheduleDate)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = WarningYellow
                )
            }

            if (booking.status == "rejected" && !booking.rejectionReason.isNullOrBlank()) {
                Text(
                    text = "Reason: ${booking.rejectionReason}",
                    style = MaterialTheme.typography.bodySmall,
                    color = ErrorRed
                )
            }

            booking.proximityInfo?.message?.takeIf { it.isNotBlank() }?.let { message ->
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodySmall,
                    color = ProviderBlue
                )
            }

            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = onCallCustomer,
                        enabled = canContact,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = WhiteText)
                    ) {
                        Icon(Icons.Default.Phone, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Call")
                    }
                    OutlinedButton(
                        onClick = onWhatsAppCustomer,
                        enabled = canContact,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = WhiteText)
                    ) {
                        Icon(Icons.Default.Message, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("WhatsApp")
                    }
                }
                OutlinedButton(
                    onClick = onOpenMap,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = WhiteText)
                ) {
                    Icon(Icons.Default.LocationOn, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Map")
                }
            }

            when {
                booking.status == "pending" || booking.status == "rescheduled_pending_provider_approval" -> {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = onAccept,
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = SuccessGreen)
                        ) {
                            Text("Accept")
                        }
                        OutlinedButton(
                            onClick = onReject,
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = ErrorRed)
                        ) {
                            Text("Reject")
                        }
                        OutlinedButton(
                            onClick = onReschedule,
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = WarningYellow)
                        ) {
                            Text("Reschedule")
                        }
                    }
                }

                booking.status == "accepted" ||
                    booking.status == "rescheduled" ||
                    booking.status == "rescheduled_by_provider" -> {
                    OutlinedButton(
                        onClick = onStartJob,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = ProviderBlue)
                    ) {
                        Icon(Icons.Default.Navigation, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Start Job")
                    }
                }

                booking.status == "en_route" -> {
                    Text(
                        text = "On the way to customer",
                        style = MaterialTheme.typography.bodySmall,
                        color = ProviderBlue
                    )
                }
            }

            if (booking.status == "accepted" || booking.status == "en_route") {
                Button(
                    onClick = onComplete,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen)
                ) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Complete Service")
                }
            }

            if (booking.status == "awaiting_payment") {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "Payment reference: ${booking.paymentReference ?: "Pending"}",
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = onConfirmPayment,
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = ProviderBlue)
                        ) {
                            Text("Confirm Payment")
                        }
                        OutlinedButton(
                            onClick = onReportIssue,
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = ErrorRed)
                        ) {
                            Text("Report Issue")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatusBadge(status: String) {
    val normalized = status.replace("_", " ")
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
        shape = RoundedCornerShape(8.dp),
        color = color.copy(alpha = 0.2f)
    ) {
        Text(
            text = normalized.replaceFirstChar { it.uppercase() },
            style = MaterialTheme.typography.labelSmall,
            color = color,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

@Composable
private fun BookingActionDialog(
    booking: ProviderBooking,
    actionType: BookingAction,
    comments: String,
    onCommentsChange: (String) -> Unit,
    rescheduleDateTime: LocalDateTime?,
    onRescheduleDateTimeChange: (LocalDateTime?) -> Unit,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    val context = LocalContext.current
    val actionLabel = when (actionType) {
        BookingAction.ACCEPT -> "Accept"
        BookingAction.REJECT -> "Reject"
        BookingAction.RESCHEDULE -> "Reschedule"
        BookingAction.COMPLETE -> "Complete"
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("$actionLabel Booking", color = WhiteText) },
        text = {
            Column {
                Text(
                    text = booking.serviceName,
                    color = WhiteTextMuted
                )
                Spacer(modifier = Modifier.height(12.dp))

                if (actionType == BookingAction.RESCHEDULE) {
                    OutlinedButton(
                        onClick = {
                            val now = Calendar.getInstance()
                            DatePickerDialog(
                                context,
                                { _, year, month, day ->
                                    TimePickerDialog(
                                        context,
                                        { _, hour, minute ->
                                            onRescheduleDateTimeChange(
                                                LocalDateTime.of(year, month + 1, day, hour, minute)
                                            )
                                        },
                                        now.get(Calendar.HOUR_OF_DAY),
                                        now.get(Calendar.MINUTE),
                                        false
                                    ).show()
                                },
                                now.get(Calendar.YEAR),
                                now.get(Calendar.MONTH),
                                now.get(Calendar.DAY_OF_MONTH)
                            ).show()
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = ProviderBlue)
                    ) {
                        Icon(Icons.Default.CalendarMonth, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            rescheduleDateTime?.format(
                                DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a")
                            ) ?: "Select date & time"
                        )
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                }

                OutlinedTextField(
                    value = comments,
                    onValueChange = onCommentsChange,
                    label = {
                        Text(
                            when (actionType) {
                                BookingAction.ACCEPT -> "Instructions (optional)"
                                BookingAction.REJECT -> "Reason"
                                BookingAction.RESCHEDULE -> "Reason"
                                BookingAction.COMPLETE -> "Service notes"
                            }
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = ProviderBlue,
                        unfocusedBorderColor = GlassBorder,
                        focusedTextColor = WhiteText,
                        unfocusedTextColor = WhiteText
                    )
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                enabled = actionType != BookingAction.RESCHEDULE || rescheduleDateTime != null,
                colors = ButtonDefaults.buttonColors(
                    containerColor = when (actionType) {
                        BookingAction.REJECT -> ErrorRed
                        BookingAction.COMPLETE -> SuccessGreen
                        BookingAction.RESCHEDULE -> ProviderBlue
                        BookingAction.ACCEPT -> SuccessGreen
                    }
                )
            ) {
                Text(actionLabel)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = WhiteTextMuted)
            }
        },
        containerColor = SlateCard
    )
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

private fun formatBookingDate(dateStr: String?): String {
    if (dateStr.isNullOrBlank()) return "Date not set"
    return try {
        val cleanDate = dateStr.substringBefore("[").trim()
        val instant = Instant.parse(if (cleanDate.endsWith("Z")) cleanDate else "${cleanDate}Z")
        val localDateTime = instant.atZone(ZoneId.of("Asia/Kolkata")).toLocalDateTime()
        localDateTime.format(DateTimeFormatter.ofPattern("dd MMMM yyyy", Locale.ENGLISH))
    } catch (_: Exception) {
        dateStr.take(10)
    }
}

private fun formatTimeSlot(timeSlot: String?, bookingDate: String?): String {
    if (!bookingDate.isNullOrBlank()) {
        try {
            val instant = Instant.parse(bookingDate)
            val localDateTime = instant.atZone(ZoneId.of("Asia/Kolkata")).toLocalDateTime()
            val timeString = localDateTime.format(DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH))
            if (!timeSlot.isNullOrBlank()) {
                val formattedSlot = timeSlot.lowercase().replaceFirstChar { it.uppercase() }
                return "$timeString ($formattedSlot)"
            }
            return timeString
        } catch (_: Exception) {
        }
    }
    if (timeSlot.isNullOrBlank()) return "Flexible time"
    val formattedSlot = timeSlot.lowercase().replaceFirstChar { it.uppercase() }
    return if (formattedSlot in listOf("Morning", "Afternoon", "Evening")) {
        "$formattedSlot (Flexible)"
    } else {
        formattedSlot
    }
}

private fun parseBookingLocalDate(dateStr: String?): LocalDate? {
    if (dateStr.isNullOrBlank()) return null
    return try {
        val cleanDate = dateStr.substringBefore("[").trim()
        val instant = Instant.parse(if (cleanDate.endsWith("Z")) cleanDate else "${cleanDate}Z")
        instant.atZone(ZoneId.of("Asia/Kolkata")).toLocalDate()
    } catch (_: Exception) {
        try {
            LocalDate.parse(dateStr.take(10))
        } catch (_: Exception) {
            null
        }
    }
}

private fun buildMapsUri(latitude: Double?, longitude: Double?, address: String?): Uri? {
    return when {
        latitude != null && longitude != null -> Uri.parse("https://maps.google.com/?q=$latitude,$longitude")
        !address.isNullOrBlank() -> Uri.parse(
            "https://www.google.com/maps/search/?api=1&query=${Uri.encode(address)}"
        )
        else -> null
    }
}
