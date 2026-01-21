package com.doorstep.tn.customer.ui.bookings

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.auth.ui.AuthViewModel
import com.doorstep.tn.common.config.PlatformConfig
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.core.network.UpdateProfileRequest
import com.doorstep.tn.customer.ui.CustomerViewModel
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.launch
import java.net.URLEncoder
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.ceil
import kotlin.math.max

private data class SlotOption(
    val label: String,
    val title: String,
    val window: String,
    val startHour: Int,
    val endHour: Int
)

private val SLOT_OPTIONS = listOf(
    SlotOption("morning", "Morning", "9 AM - 12 PM", 9, 12),
    SlotOption("afternoon", "Afternoon", "12 PM - 4 PM", 12, 16),
    SlotOption("evening", "Evening", "4 PM - 8 PM", 16, 20)
)

private const val GPS_WEAK_ACCURACY_METERS = 150.0

/**
 * Book Service Screen - Matches web app's /customer/book-service/[id] page exactly
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookServiceScreen(
    serviceId: Int,
    authViewModel: AuthViewModel = hiltViewModel(),
    viewModel: CustomerViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onBookingComplete: () -> Unit
) {
    val service by viewModel.selectedService.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val bookingSlots by viewModel.bookingSlots.collectAsState()
    val bookingSlotsLoading by viewModel.bookingSlotsLoading.collectAsState()
    val user by authViewModel.user.collectAsState()

    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    // Urgency selection: "now", "today", "tomorrow" - matches web
    var selectedUrgency by remember { mutableStateOf<String?>(null) }
    var selectedDate by remember { mutableStateOf(LocalDate.now()) }
    // Location selection: "provider" or "customer" - matches web
    var serviceLocation by remember { mutableStateOf("provider") }
    // Is booking in progress
    var isBooking by remember { mutableStateOf(false) }

    var bookingLandmark by remember(user) { mutableStateOf(user?.addressLandmark ?: "") }
    var capturedLatitude by remember(user) { mutableStateOf(user?.latitude?.toDoubleOrNull()) }
    var capturedLongitude by remember(user) { mutableStateOf(user?.longitude?.toDoubleOrNull()) }
    var lastGpsAccuracyMeters by remember { mutableStateOf<Double?>(null) }
    var isCapturingLocation by remember { mutableStateOf(false) }

    var dialogOpen by remember { mutableStateOf(false) }
    var dialogStep by remember { mutableStateOf("confirm") }
    var lastBookingId by remember { mutableStateOf<Int?>(null) }

    val dateFormatter = remember { DateTimeFormatter.ofPattern("MMMM d, yyyy") }
    val zoneId = remember { ZoneId.of("Asia/Kolkata") }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarseGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true

        if (fineGranted || coarseGranted) {
            isCapturingLocation = true
            val client = LocationServices.getFusedLocationProviderClient(context)
            val cancellationTokenSource = CancellationTokenSource()

            client.getCurrentLocation(
                Priority.PRIORITY_HIGH_ACCURACY,
                cancellationTokenSource.token
            ).addOnSuccessListener { location ->
                if (location != null) {
                    capturedLatitude = location.latitude
                    capturedLongitude = location.longitude
                    lastGpsAccuracyMeters = location.accuracy.toDouble()

                    if (user == null) {
                        isCapturingLocation = false
                        scope.launch {
                            snackbarHostState.showSnackbar("Unable to save location. Please try again.")
                        }
                        return@addOnSuccessListener
                    }

                    viewModel.updateProfileLocation(
                        latitude = String.format(Locale.US, "%.7f", location.latitude),
                        longitude = String.format(Locale.US, "%.7f", location.longitude),
                        onSuccess = {
                            isCapturingLocation = false
                            scope.launch {
                                snackbarHostState.showSnackbar("Location saved successfully")
                            }
                        },
                        onError = { error ->
                            isCapturingLocation = false
                            scope.launch {
                                snackbarHostState.showSnackbar("Error: $error")
                            }
                        }
                    )
                } else {
                    isCapturingLocation = false
                    scope.launch {
                        snackbarHostState.showSnackbar("Unable to get your location")
                    }
                }
            }.addOnFailureListener { error ->
                isCapturingLocation = false
                scope.launch {
                    snackbarHostState.showSnackbar(error.message ?: "Failed to get location")
                }
            }
        } else {
            scope.launch {
                snackbarHostState.showSnackbar("Location permission denied")
            }
        }
    }

    fun requestLocation() {
        val hasFineLocation = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val hasCoarseLocation = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (hasFineLocation || hasCoarseLocation) {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        } else {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }

    LaunchedEffect(serviceId) {
        viewModel.loadServiceDetails(serviceId)
    }

    LaunchedEffect(serviceId, selectedDate) {
        if (serviceId > 0) {
            viewModel.loadServiceBookingSlots(
                serviceId = serviceId,
                date = selectedDate.format(DateTimeFormatter.ISO_DATE)
            )
        }
    }

    val isServiceLoading = service == null && isLoading

    val s = service
    val priceAmount = s?.price?.toDoubleOrNull() ?: 0.0
    val platformFee = if (PlatformConfig.PLATFORM_FEES_ENABLED) PlatformConfig.SERVICE_BOOKING_FEE else 0.0
    val providerOnline = (s?.isAvailableNow ?: true) && (s?.isAvailable ?: true)
    val effectiveMaxDailyBookings = remember(s?.maxDailyBookings) {
        val raw = s?.maxDailyBookings
        if (raw != null && raw > 0) raw else 5
    }

    val allowedSlots = remember(s?.allowedSlots) {
        val allowed = s?.allowedSlots?.filter { option ->
            SLOT_OPTIONS.any { it.label == option }
        } ?: emptyList()

        if (allowed.isEmpty()) {
            SLOT_OPTIONS.map { it.label }
        } else {
            allowed
        }
    }

    val perSlotCapacity = remember(allowedSlots, effectiveMaxDailyBookings) {
        val allowedCount = if (allowedSlots.isEmpty()) SLOT_OPTIONS.size else allowedSlots.size
        max(1, ceil(effectiveMaxDailyBookings.toDouble() / allowedCount.toDouble()).toInt())
    }

    val bookedSlotCounts = remember(bookingSlots, allowedSlots) {
        val base = mutableMapOf<String, Int>()
        val slotLabels = if (allowedSlots.isEmpty()) SLOT_OPTIONS.map { it.label } else allowedSlots
        slotLabels.forEach { base[it] = 0 }

        val unlabeledCount = bookingSlots.count { it.timeSlotLabel.isNullOrBlank() }
        bookingSlots.forEach { slot ->
            val label = slot.timeSlotLabel
            if (!label.isNullOrBlank()) {
                base[label] = (base[label] ?: 0) + 1
            }
        }

        if (unlabeledCount > 0) {
            slotLabels.forEach { label ->
                base[label] = (base[label] ?: 0) + unlabeledCount
            }
        }

        base
    }

    val dailyLimitReached = bookingSlots.size >= effectiveMaxDailyBookings
    val allowedSlotSet = remember(allowedSlots) { allowedSlots.toSet() }

    val resolvedSlotLabel = remember(
        selectedUrgency,
        providerOnline,
        dailyLimitReached,
        allowedSlotSet,
        bookedSlotCounts
    ) {
        if (selectedUrgency == null || !providerOnline || dailyLimitReached) {
            return@remember null
        }

        val labels = SLOT_OPTIONS.map { it.label }
        val now = ZonedDateTime.now(zoneId)
        val startIndex = when {
            now.hour >= 16 -> 2
            now.hour >= 12 -> 1
            else -> 0
        }

        val candidateLabels = when (selectedUrgency) {
            "tomorrow" -> labels
            "now" -> labels.drop(startIndex)
            else -> labels.drop(startIndex) + labels.take(startIndex)
        }

        candidateLabels.firstOrNull { label ->
            allowedSlotSet.contains(label) && (bookedSlotCounts[label] ?: 0) < perSlotCapacity
        }
    }

    val resolvedSlotStart = remember(selectedDate, resolvedSlotLabel) {
        resolvedSlotLabel?.let { label ->
            val slot = SLOT_OPTIONS.firstOrNull { it.label == label } ?: return@let null
            ZonedDateTime.of(selectedDate, LocalTime.of(slot.startHour, 0), zoneId).toInstant()
        }
    }

    fun openUrl(url: String) {
        try {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (_: Exception) {
            scope.launch {
                snackbarHostState.showSnackbar("Unable to open link")
            }
        }
    }

    fun confirmBooking() {
        val selectedLabel = resolvedSlotLabel
        if (selectedUrgency == null || selectedLabel == null) {
            scope.launch {
                snackbarHostState.showSnackbar("Please select a time option")
            }
            return
        }

        if (serviceLocation == "customer" && bookingLandmark.trim().isEmpty()) {
            scope.launch {
                snackbarHostState.showSnackbar("Landmark is required for home service")
            }
            return
        }

        val bookingInstant = run {
            val nowInstant = Instant.now()
            val slotInstant = resolvedSlotStart
            var desired = when (selectedUrgency) {
                "now" -> nowInstant
                "today" -> slotInstant ?: nowInstant
                "tomorrow" -> slotInstant ?: nowInstant
                else -> nowInstant
            }
            if (selectedUrgency == "today" && desired.isBefore(nowInstant)) {
                desired = nowInstant
            }
            desired
        }

        val trimmedLandmark = bookingLandmark.trim()
        val existingLandmark = (user?.addressLandmark ?: "").trim()

        val submitBooking = {
            isBooking = true
            viewModel.createBooking(
                serviceId = serviceId,
                bookingDate = bookingInstant.toString(),
                timeSlotLabel = selectedLabel,
                serviceLocation = serviceLocation,
                onSuccess = { response ->
                    isBooking = false
                    lastBookingId = response.booking?.id
                    dialogStep = "sent"
                },
                onError = { error ->
                    isBooking = false
                    scope.launch {
                        snackbarHostState.showSnackbar("Error: $error")
                    }
                }
            )
        }

        if (serviceLocation == "customer" && trimmedLandmark.isNotEmpty() && trimmedLandmark != existingLandmark) {
            val userId = user?.id
            if (userId == null) {
                scope.launch {
                    snackbarHostState.showSnackbar("Unable to save landmark. Please try again.")
                }
                return
            }

            isBooking = true
            viewModel.updateProfile(
                userId = userId,
                request = UpdateProfileRequest(addressLandmark = trimmedLandmark),
                onSuccess = { submitBooking() },
                onError = { error ->
                    isBooking = false
                    scope.launch {
                        snackbarHostState.showSnackbar("Error: $error")
                    }
                }
            )
        } else {
            submitBooking()
        }
    }

    val provider = s?.provider
    val providerAddress = listOfNotNull(
        provider?.addressStreet,
        provider?.addressCity,
        provider?.addressState,
        provider?.addressPostalCode,
        provider?.addressCountry
    ).joinToString(", ")

    val providerMapUrl = when {
        provider?.latitude != null && provider?.longitude != null ->
            "https://www.google.com/maps?q=${provider.latitude},${provider.longitude}"
        providerAddress.isNotBlank() -> buildGoogleMapsSearchUrl(providerAddress)
        else -> null
    }

    val customerMapUrl = if (capturedLatitude != null && capturedLongitude != null) {
        "https://www.google.com/maps?q=$capturedLatitude,$capturedLongitude"
    } else {
        null
    }

    val whatsappMessage = remember(
        s?.name,
        selectedUrgency,
        selectedDate,
        serviceLocation,
        bookingLandmark,
        providerAddress,
        providerMapUrl,
        customerMapUrl
    ) {
        if (s == null) return@remember null

        val urgencyLabel = when (selectedUrgency) {
            "now" -> "Urgent (now)"
            "today" -> "Today"
            "tomorrow" -> "Tomorrow"
            else -> null
        }

        buildString {
            append("Booking request: ${s.name}")
            if (urgencyLabel != null) append("\nWhen: $urgencyLabel")
            append("\nPreferred day: ${selectedDate.format(dateFormatter)}")
            append("\nLocation: ${if (serviceLocation == "customer") "My location" else "Provider location"}")
            if (serviceLocation == "customer" && bookingLandmark.trim().isNotEmpty()) {
                append("\nLandmark: ${bookingLandmark.trim()}")
            }
            if (serviceLocation == "customer" && customerMapUrl != null) {
                append("\nMy location: $customerMapUrl")
            }
            if (serviceLocation == "provider" && providerAddress.isNotBlank()) {
                append("\nProvider address: $providerAddress")
            }
            if (serviceLocation == "provider" && providerMapUrl != null) {
                append("\nProvider map: $providerMapUrl")
            }
            append("\nPlease confirm availability.")
        }
    }

    val whatsappUrl = if (whatsappMessage != null) {
        buildWhatsAppUrl(provider?.phone, whatsappMessage)
    } else {
        null
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Book Service", color = WhiteText) },
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
        if (isServiceLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = OrangePrimary)
            }
        } else if (s != null) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp)
            ) {
                // ==================== Service Info Card ====================
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = s.name,
                            style = MaterialTheme.typography.titleLarge,
                            color = WhiteText,
                            fontWeight = FontWeight.Bold
                        )

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(vertical = 4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = null,
                                tint = AmberSecondary,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "${String.format("%.1f", s.rating ?: 0.0)} (${s.reviewCount} reviews)",
                                style = MaterialTheme.typography.bodySmall,
                                color = WhiteTextMuted
                            )
                        }

                        s.description?.let { desc ->
                            Text(
                                text = desc,
                                style = MaterialTheme.typography.bodyMedium,
                                color = WhiteTextMuted,
                                modifier = Modifier.padding(vertical = 8.dp)
                            )
                        }

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Schedule,
                                contentDescription = null,
                                tint = WhiteTextMuted,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "${s.duration ?: 60} min",
                                style = MaterialTheme.typography.bodyMedium,
                                color = WhiteTextMuted
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Text(
                            text = "Est. price: ₹${s.price}",
                            style = MaterialTheme.typography.titleMedium,
                            color = OrangePrimary,
                            fontWeight = FontWeight.Bold
                        )

                        provider?.let { providerInfo ->
                            Spacer(modifier = Modifier.height(16.dp))
                            HorizontalDivider(color = GlassWhite)
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = "Service Provider",
                                style = MaterialTheme.typography.labelMedium,
                                color = WhiteTextMuted,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = providerInfo.name,
                                style = MaterialTheme.typography.bodyMedium,
                                color = WhiteText
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // ==================== Request Visit Section ====================
                Text(
                    text = "Request visit",
                    style = MaterialTheme.typography.titleLarge,
                    color = WhiteText,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Pick time and place.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = WhiteTextMuted
                )

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // ==================== Pick Time Card ====================
                    Card(
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = SlateCard)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(24.dp)
                                        .clip(CircleShape)
                                        .background(OrangePrimary),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("1", color = WhiteText, fontWeight = FontWeight.Bold)
                                }
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Pick time",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = WhiteText,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Time is flexible. Provider confirms.",
                                style = MaterialTheme.typography.bodySmall,
                                color = WhiteTextMuted
                            )

                            Spacer(modifier = Modifier.height(16.dp))

                            UrgencyOption(
                                icon = Icons.Default.AccessTime,
                                title = "Now",
                                subtitle = "Emergency - ${LocalDate.now().format(dateFormatter)}",
                                isSelected = selectedUrgency == "now",
                                onClick = {
                                    selectedUrgency = "now"
                                    selectedDate = LocalDate.now()
                                }
                            )

                            Spacer(modifier = Modifier.height(8.dp))

                            UrgencyOption(
                                icon = Icons.Default.WbSunny,
                                title = "Today",
                                subtitle = "Any time - ${LocalDate.now().format(dateFormatter)}",
                                isSelected = selectedUrgency == "today",
                                onClick = {
                                    selectedUrgency = "today"
                                    selectedDate = LocalDate.now()
                                }
                            )

                            Spacer(modifier = Modifier.height(8.dp))

                            UrgencyOption(
                                icon = Icons.Default.Event,
                                title = "Tomorrow",
                                subtitle = "Any time - ${LocalDate.now().plusDays(1).format(dateFormatter)}",
                                isSelected = selectedUrgency == "tomorrow",
                                onClick = {
                                    selectedUrgency = "tomorrow"
                                    selectedDate = LocalDate.now().plusDays(1)
                                }
                            )

                            Spacer(modifier = Modifier.height(12.dp))

                            when {
                                bookingSlotsLoading -> {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(16.dp),
                                            color = WhiteTextMuted,
                                            strokeWidth = 2.dp
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            text = "Checking availability...",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = WhiteTextMuted
                                        )
                                    }
                                }
                                !providerOnline -> {
                                    Text(
                                        text = "Provider is offline right now.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = ErrorRed
                                    )
                                    s.availabilityNote?.let { note ->
                                        Text(
                                            text = note,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = WhiteTextMuted
                                        )
                                    }
                                }
                                dailyLimitReached -> {
                                    Text(
                                        text = "Provider is fully booked for this day.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = WhiteTextMuted
                                    )
                                }
                                selectedUrgency != null && resolvedSlotLabel == null -> {
                                    Text(
                                        text = "No availability for the selected day.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = WhiteTextMuted
                                    )
                                }
                            }
                        }
                    }

                    // ==================== Pick Location Card ====================
                    Card(
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = SlateCard)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(24.dp)
                                        .clip(CircleShape)
                                        .background(ProviderBlue),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("2", color = WhiteText, fontWeight = FontWeight.Bold)
                                }
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Pick location",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = WhiteText,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            Text(
                                text = "Location",
                                style = MaterialTheme.typography.labelMedium,
                                color = WhiteTextMuted,
                                fontWeight = FontWeight.Bold
                            )

                            Spacer(modifier = Modifier.height(8.dp))

                            Row(
                                horizontalArrangement = Arrangement.spacedBy(16.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.clickable { serviceLocation = "provider" }
                                ) {
                                    RadioButton(
                                        selected = serviceLocation == "provider",
                                        onClick = { serviceLocation = "provider" },
                                        colors = RadioButtonDefaults.colors(
                                            selectedColor = OrangePrimary,
                                            unselectedColor = WhiteTextMuted
                                        )
                                    )
                                    Text("Provider's location", color = WhiteText)
                                }
                            }

                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.clickable { serviceLocation = "customer" }
                            ) {
                                RadioButton(
                                    selected = serviceLocation == "customer",
                                    onClick = { serviceLocation = "customer" },
                                    colors = RadioButtonDefaults.colors(
                                        selectedColor = OrangePrimary,
                                        unselectedColor = WhiteTextMuted
                                    )
                                )
                                Text("My location", color = WhiteText)
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            if (serviceLocation == "provider") {
                                if (providerAddress.isNotBlank()) {
                                    Text(
                                        text = "Service at: $providerAddress",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = WhiteTextMuted
                                    )
                                }
                                providerMapUrl?.let { url ->
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(
                                        text = "View on map",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = ProviderBlue,
                                        modifier = Modifier.clickable { openUrl(url) }
                                    )
                                }
                            } else {
                                Text(
                                    text = "Add a nearby landmark for the provider.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = WhiteTextMuted
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = bookingLandmark,
                                    onValueChange = { bookingLandmark = it },
                                    label = { Text("Landmark (required)") },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = OrangePrimary,
                                        unfocusedBorderColor = GlassWhite,
                                        focusedTextColor = WhiteText,
                                        unfocusedTextColor = WhiteTextMuted,
                                        focusedLabelColor = WhiteTextMuted,
                                        unfocusedLabelColor = WhiteTextMuted
                                    )
                                )
                                if (bookingLandmark.trim().isEmpty()) {
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = "Please enter a landmark to continue.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = ErrorRed
                                    )
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                if (lastGpsAccuracyMeters != null && lastGpsAccuracyMeters!! > GPS_WEAK_ACCURACY_METERS) {
                                    Text(
                                        text = "GPS accuracy is weak (${lastGpsAccuracyMeters?.toInt()} m).",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = ErrorRed
                                    )
                                }
                                Button(
                                    onClick = { requestLocation() },
                                    enabled = !isCapturingLocation,
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = ProviderBlue)
                                ) {
                                    if (isCapturingLocation) {
                                        CircularProgressIndicator(
                                            color = WhiteText,
                                            modifier = Modifier.size(18.dp),
                                            strokeWidth = 2.dp
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text("Saving location...")
                                    } else {
                                        Icon(
                                            imageVector = Icons.Default.MyLocation,
                                            contentDescription = null,
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text("Use my location")
                                    }
                                }
                                customerMapUrl?.let {
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(
                                        text = "View saved location",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = ProviderBlue,
                                        modifier = Modifier.clickable { openUrl(it) }
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(24.dp))

                            Text(
                                text = "Summary",
                                style = MaterialTheme.typography.labelMedium,
                                color = WhiteTextMuted,
                                fontWeight = FontWeight.Bold
                            )

                            Spacer(modifier = Modifier.height(8.dp))
                            HorizontalDivider(color = GlassWhite)
                            Spacer(modifier = Modifier.height(8.dp))

                            val whenLabel = selectedUrgency?.let {
                                when (it) {
                                    "now" -> "Now (Emergency)"
                                    "today" -> "Today"
                                    "tomorrow" -> "Tomorrow"
                                    else -> "Not set"
                                }
                            } ?: "Not set"

                            val whenSummary = if (selectedUrgency == null) {
                                "Not set"
                            } else {
                                "${whenLabel} - ${selectedDate.format(dateFormatter)}"
                            }
                            SummaryRow("When", whenSummary)
                            SummaryRow(
                                "Where",
                                if (serviceLocation == "provider") "Provider's location" else "My location"
                            )
                            SummaryRow("Price", "₹${s.price}")
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                val canRequest = selectedUrgency != null &&
                    providerOnline &&
                    !bookingSlotsLoading &&
                    !dailyLimitReached &&
                    resolvedSlotLabel != null &&
                    (serviceLocation != "customer" || bookingLandmark.trim().isNotEmpty()) &&
                    !isBooking

                Button(
                    onClick = {
                        dialogStep = "confirm"
                        lastBookingId = null
                        dialogOpen = true
                    },
                    enabled = canRequest,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = OrangePrimary,
                        disabledContainerColor = OrangePrimary.copy(alpha = 0.5f)
                    )
                ) {
                    if (isBooking) {
                        CircularProgressIndicator(
                            color = WhiteText,
                            modifier = Modifier.size(24.dp)
                        )
                    } else {
                        Text(
                            text = "Send request",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }

    if (dialogOpen && s != null) {
        AlertDialog(
            onDismissRequest = {
                dialogOpen = false
                dialogStep = "confirm"
                lastBookingId = null
            },
            containerColor = SlateCard,
            title = {
                Text(
                    text = if (dialogStep == "sent") "Booking requested" else "Confirm booking",
                    color = WhiteText
                )
            },
            text = {
                if (dialogStep == "sent") {
                    Column {
                        if (lastBookingId != null) {
                            Text(
                                text = "Booking #$lastBookingId",
                                color = WhiteTextMuted
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                        Text(
                            text = if (serviceLocation == "customer") {
                                "Send your location details to the provider."
                            } else {
                                "Message the provider to confirm the visit."
                            },
                            color = WhiteTextMuted
                        )
                    }
                } else {
                    Column {
                        Text(
                            text = "Service: ${s.name}",
                            color = WhiteText
                        )
                        Text(
                            text = "When: ${selectedUrgency ?: "Not set"}",
                            color = WhiteTextMuted
                        )
                        Text(
                            text = "Preferred day: ${selectedDate.format(dateFormatter)}",
                            color = WhiteTextMuted
                        )
                        Text(
                            text = "Location: ${if (serviceLocation == "provider") "Provider" else "Customer"}",
                            color = WhiteTextMuted
                        )
                        if (serviceLocation == "customer" && bookingLandmark.trim().isNotEmpty()) {
                            Text(
                                text = "Landmark: ${bookingLandmark.trim()}",
                                color = WhiteTextMuted
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Estimated price: ₹${s.price}",
                            color = OrangePrimary,
                            fontWeight = FontWeight.Bold
                        )
                        if (PlatformConfig.PLATFORM_FEES_ENABLED &&
                            PlatformConfig.PLATFORM_FEE_BREAKDOWN_ENABLED &&
                            priceAmount > 0.0
                        ) {
                            Text(
                                text = "Platform Service Fee: ₹${String.format("%.2f", platformFee)}",
                                color = WhiteTextMuted
                            )
                        }
                    }
                }
            },
            confirmButton = {
                if (dialogStep == "sent") {
                    Button(
                        onClick = {
                            if (whatsappUrl != null) {
                                openUrl(whatsappUrl)
                            }
                        },
                        enabled = whatsappUrl != null,
                        colors = ButtonDefaults.buttonColors(containerColor = ProviderBlue)
                    ) {
                        Text("Message provider")
                    }
                } else {
                    Button(
                        onClick = { confirmBooking() },
                        enabled = !isBooking,
                        colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary)
                    ) {
                        Text("Confirm request")
                    }
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        dialogOpen = false
                        if (dialogStep == "sent") {
                            onBookingComplete()
                        }
                        dialogStep = "confirm"
                        lastBookingId = null
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = WhiteTextMuted)
                ) {
                    Text(if (dialogStep == "sent") "Done" else "Cancel")
                }
            }
        )
    }
}

@Composable
private fun UrgencyOption(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = if (isSelected) OrangePrimary.copy(alpha = 0.2f) else GlassWhite,
        border = if (isSelected) androidx.compose.foundation.BorderStroke(2.dp, OrangePrimary) else null
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (isSelected) OrangePrimary else WhiteTextMuted,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyMedium,
                    color = WhiteText,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted
                )
            }
        }
    }
}

@Composable
private fun SummaryRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = WhiteTextMuted
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = WhiteText,
            fontWeight = FontWeight.Medium
        )
    }
}

private fun buildGoogleMapsSearchUrl(query: String): String {
    val encoded = URLEncoder.encode(query, "UTF-8")
    return "https://www.google.com/maps/search/?api=1&query=$encoded"
}

private fun buildWhatsAppUrl(phone: String?, message: String): String {
    val digits = phone?.filter { it.isDigit() } ?: ""
    val target = when {
        digits.length == 10 -> "91$digits"
        digits.length >= 11 -> digits
        else -> null
    }
    val encoded = URLEncoder.encode(message, "UTF-8")
    return if (target != null) {
        "https://wa.me/$target?text=$encoded"
    } else {
        "https://api.whatsapp.com/send?text=$encoded"
    }
}
