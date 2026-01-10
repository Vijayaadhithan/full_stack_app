package com.doorstep.tn.customer.ui.bookings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.customer.ui.CustomerViewModel
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * Book Service Screen - Matches web app's /customer/book-service/[id] page exactly
 * 
 * Web design has:
 * 1. Service info (name, rating, description, duration, location, price)
 * 2. Service Provider info
 * 3. "Request visit" section with:
 *    - Pick time: Now (Emergency), Today (Any time), Tomorrow (Any time)
 *    - Pick location: Provider's location / My location
 *    - Summary: When, Where, Price
 *    - Send request button
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookServiceScreen(
    serviceId: Int,
    viewModel: CustomerViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onBookingComplete: () -> Unit
) {
    val service by viewModel.selectedService.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    
    // Urgency selection: "now", "today", "tomorrow" - matches web
    var selectedUrgency by remember { mutableStateOf<String?>(null) }
    // Location selection: "provider" or "customer" - matches web
    var serviceLocation by remember { mutableStateOf("provider") }
    // Is booking in progress
    var isBooking by remember { mutableStateOf(false) }
    
    LaunchedEffect(serviceId) {
        viewModel.loadServiceDetails(serviceId)
    }
    
    // Get formatted dates for urgency options
    val today = LocalDate.now()
    val dateFormatter = DateTimeFormatter.ofPattern("MMMM d, yyyy")
    
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
        containerColor = SlateDarker
    ) { paddingValues ->
        if (isLoading || service == null) {
            Box(
                modifier = Modifier.fillMaxSize().padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = OrangePrimary)
            }
        } else {
            val s = service!!
            
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
                        // Service Name
                        Text(
                            text = s.name,
                            style = MaterialTheme.typography.titleLarge,
                            color = WhiteText,
                            fontWeight = FontWeight.Bold
                        )
                        
                        // Rating (like web: ★ 0.0 (0 reviews))
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
                                text = "0.0 (0 reviews)",
                                style = MaterialTheme.typography.bodySmall,
                                color = WhiteTextMuted
                            )
                        }
                        
                        // Description
                        s.description?.let { desc ->
                            Text(
                                text = desc,
                                style = MaterialTheme.typography.bodyMedium,
                                color = WhiteTextMuted,
                                modifier = Modifier.padding(vertical = 8.dp)
                            )
                        }
                        
                        // Duration (like web: ⏱ 300 min)
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
                        
                        // Price (like web: Est. price: ₹1500)
                        Text(
                            text = "Est. price: ₹${s.price}",
                            style = MaterialTheme.typography.titleMedium,
                            color = OrangePrimary,
                            fontWeight = FontWeight.Bold
                        )
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
                                text = "Time is Flexible. Provider confirms.",
                                style = MaterialTheme.typography.bodySmall,
                                color = WhiteTextMuted
                            )
                            
                            Spacer(modifier = Modifier.height(16.dp))
                            
                            // Urgency Options - matches web exactly
                            UrgencyOption(
                                icon = Icons.Default.AccessTime,
                                title = "Now",
                                subtitle = "Emergency · " + today.format(dateFormatter),
                                isSelected = selectedUrgency == "now",
                                onClick = { selectedUrgency = "now" }
                            )
                            
                            Spacer(modifier = Modifier.height(8.dp))
                            
                            UrgencyOption(
                                icon = Icons.Default.WbSunny,
                                title = "Today",
                                subtitle = "Any time · " + today.format(dateFormatter),
                                isSelected = selectedUrgency == "today",
                                onClick = { selectedUrgency = "today" }
                            )
                            
                            Spacer(modifier = Modifier.height(8.dp))
                            
                            UrgencyOption(
                                icon = Icons.Default.Event,
                                title = "Tomorrow",
                                subtitle = "Any time · " + today.plusDays(1).format(dateFormatter),
                                isSelected = selectedUrgency == "tomorrow",
                                onClick = { selectedUrgency = "tomorrow" }
                            )
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
                            
                            // Location radio options - matches web
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
                            
                            Spacer(modifier = Modifier.height(24.dp))
                            
                            // Summary section - matches web
                            Text(
                                text = "Summary",
                                style = MaterialTheme.typography.labelMedium,
                                color = WhiteTextMuted,
                                fontWeight = FontWeight.Bold
                            )
                            
                            Spacer(modifier = Modifier.height(8.dp))
                            HorizontalDivider(color = GlassWhite)
                            Spacer(modifier = Modifier.height(8.dp))
                            
                            SummaryRow("When", selectedUrgency?.let { 
                                when(it) {
                                    "now" -> "Now (Emergency)"
                                    "today" -> "Today"
                                    "tomorrow" -> "Tomorrow"
                                    else -> "Not set"
                                }
                            } ?: "Not set")
                            
                            SummaryRow("Where", if (serviceLocation == "provider") 
                                "Provider's location" else "My location")
                            
                            SummaryRow("Price", "₹${s.price}")
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(24.dp))
                
                // ==================== Send Request Button ====================
                Button(
                    onClick = {
                        if (selectedUrgency != null) {
                            isBooking = true
                            // Calculate booking date based on urgency
                            val bookingDate = when (selectedUrgency) {
                                "now", "today" -> today.toString()
                                "tomorrow" -> today.plusDays(1).toString()
                                else -> today.toString()
                            }
                            // For emergency "now" bookings, send null as timeSlotLabel (server accepts nullable)
                            // For "today"/"tomorrow", use current time of day to pick appropriate slot
                            val timeSlotLabel: String? = when (selectedUrgency) {
                                "now" -> null  // Emergency: no specific slot, provider responds ASAP
                                else -> {
                                    // Pick slot based on current hour
                                    val hour = java.time.LocalTime.now().hour
                                    when {
                                        hour < 12 -> "morning"
                                        hour < 17 -> "afternoon"
                                        else -> "evening"
                                    }
                                }
                            }
                            viewModel.createBooking(
                                serviceId = serviceId,
                                bookingDate = bookingDate,
                                timeSlotLabel = timeSlotLabel,
                                serviceLocation = serviceLocation,
                                onSuccess = {
                                    isBooking = false
                                    onBookingComplete()
                                },
                                onError = {
                                    isBooking = false
                                }
                            )
                        }
                    },
                    enabled = selectedUrgency != null && !isBooking,
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
