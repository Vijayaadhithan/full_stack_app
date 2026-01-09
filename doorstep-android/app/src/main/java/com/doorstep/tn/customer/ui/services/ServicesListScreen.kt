package com.doorstep.tn.customer.ui.services

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.common.ui.BookingTypeSelector
import com.doorstep.tn.common.ui.LocationFilterDropdown
import com.doorstep.tn.customer.data.model.Service
import com.doorstep.tn.customer.ui.CustomerViewModel

/**
 * Services List Screen - Matches web UI with location filter and booking type options
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServicesListScreen(
    viewModel: CustomerViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToService: (Int) -> Unit
) {
    val services by viewModel.services.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val selectedCategory by viewModel.selectedCategory.collectAsState()
    
    // Location filter state
    var locationRadius by remember { mutableIntStateOf(45) }
    var locationLat by remember { mutableStateOf<Double?>(null) }
    var locationLng by remember { mutableStateOf<Double?>(null) }
    
    // Booking type state
    var bookingType by remember { mutableStateOf("scheduled") }
    
    val categories = listOf(
        "All Services" to Icons.Default.Apps,
        "Carpentry" to Icons.Default.Handyman,
        "Beauty" to Icons.Default.Face,
        "Vehicle" to Icons.Default.TwoWheeler,
        "AC Repair" to Icons.Default.AcUnit,
        "Plumbing" to Icons.Default.Plumbing,
        "Electrical" to Icons.Default.ElectricalServices
    )
    
    LaunchedEffect(selectedCategory, locationLat, locationLng, locationRadius) {
        viewModel.loadServices(
            category = selectedCategory,
            latitude = locationLat,
            longitude = locationLng,
            radius = if (locationLat != null) locationRadius else null
        )
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Browse Services", color = WhiteText) },
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // ==================== Filter Row ====================
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Row 1: Booking Type + Location Filter
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    BookingTypeSelector(
                        selectedType = bookingType,
                        onTypeChange = { bookingType = it }
                    )
                    
                    LocationFilterDropdown(
                        currentRadius = locationRadius,
                        currentLat = locationLat,
                        currentLng = locationLng,
                        onRadiusChange = { locationRadius = it },
                        onUseDeviceLocation = {
                            locationLat = 10.557
                            locationLng = 77.235
                        },
                        onUseSavedLocation = {
                            locationLat = 10.557
                            locationLng = 77.235
                        },
                        onClear = {
                            locationLat = null
                            locationLng = null
                        }
                    )
                }
                
                // Subtitle
                Text(
                    text = "Tap an icon to choose the vibe you need.",
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted
                )
            }
            
            // ==================== Category Icons ====================
            LazyRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(horizontal = 16.dp)
            ) {
                items(categories) { (category, icon) ->
                    val categoryKey = if (category == "All Services") null else category
                    val isSelected = selectedCategory == categoryKey
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .width(72.dp)
                            .clickable { viewModel.updateCategory(categoryKey) }
                    ) {
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(if (isSelected) OrangePrimary else SlateCard),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = icon,
                                contentDescription = category,
                                tint = WhiteText,
                                modifier = Modifier.size(24.dp)
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = category.replace(" ", "\n"),
                            style = MaterialTheme.typography.labelSmall,
                            color = if (isSelected) OrangePrimary else WhiteTextMuted,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // Location info
            if (locationLat != null && locationLng != null) {
                Text(
                    text = "Showing providers within $locationRadius km",
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                )
            }
            
            HorizontalDivider(color = GlassBorder, thickness = 1.dp)
            
            // ==================== Services List ====================
            when {
                isLoading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = OrangePrimary)
                    }
                }
                services.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Default.Build,
                                contentDescription = null,
                                tint = WhiteTextMuted,
                                modifier = Modifier.size(64.dp)
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text("No services found", color = WhiteTextMuted)
                        }
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(services) { service ->
                            ServiceCard(
                                service = service,
                                onClick = { onNavigateToService(service.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ServiceCard(
    service: Service,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Top
            ) {
                // Service Image
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(GlassWhite),
                    contentAlignment = Alignment.Center
                ) {
                    if (!service.images.isNullOrEmpty()) {
                        AsyncImage(
                            model = service.images.first(),
                            contentDescription = service.name,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Default.Build,
                            contentDescription = null,
                            tint = OrangePrimary,
                            modifier = Modifier.size(28.dp)
                        )
                    }
                }
                
                Spacer(modifier = Modifier.width(12.dp))
                
                // Service Info
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = service.name,
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    
                    service.description?.let { desc ->
                        Text(
                            text = desc,
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteTextMuted,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    // Rating & Duration Row
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Rating
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = null,
                                tint = AmberSecondary,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(2.dp))
                            Text(
                                text = "${service.rating ?: 0.0} (${service.reviewCount})",
                                style = MaterialTheme.typography.labelSmall,
                                color = WhiteTextMuted
                            )
                        }
                        
                        // Duration
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Schedule,
                                contentDescription = null,
                                tint = WhiteTextMuted,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(2.dp))
                            Text(
                                text = "${service.duration ?: 30} mins",
                                style = MaterialTheme.typography.labelSmall,
                                color = WhiteTextMuted
                            )
                        }
                    }
                }
                
                // Price & Status Column
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "₹${service.price}",
                        style = MaterialTheme.typography.titleMedium,
                        color = OrangePrimary,
                        fontWeight = FontWeight.Bold
                    )
                    
                    Spacer(modifier = Modifier.height(4.dp))
                    
                    // Availability Badge
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = if (service.isAvailableNow) SuccessGreen.copy(alpha = 0.2f) 
                               else ErrorRed.copy(alpha = 0.2f)
                    ) {
                        Text(
                            text = if (service.isAvailableNow) "Available" else "Busy",
                            color = if (service.isAvailableNow) SuccessGreen else ErrorRed,
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    Button(
                        onClick = onClick,
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp)
                    ) {
                        Text("Book", style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
        }
    }
}
