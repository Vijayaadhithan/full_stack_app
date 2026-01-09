package com.doorstep.tn.customer.ui.services

import androidx.compose.foundation.background
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.customer.ui.CustomerViewModel

/**
 * Service Detail Screen - Matches web UI with provider info and ratings
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServiceDetailScreen(
    serviceId: Int,
    viewModel: CustomerViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onBookService: (Int) -> Unit
) {
    val service by viewModel.selectedService.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    
    LaunchedEffect(serviceId) {
        viewModel.loadServiceDetails(serviceId)
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Service Details", color = WhiteText) },
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
        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = ProviderBlue)
            }
        } else if (service != null) {
            val s = service!!
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .verticalScroll(rememberScrollState())
            ) {
                // Service Image
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(SlateCard, SlateDarker)
                            )
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    if (!s.images.isNullOrEmpty()) {
                        AsyncImage(
                            model = s.images.first(),
                            contentDescription = s.name,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                    } else {
                        Box(
                            modifier = Modifier
                                .size(80.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(ProviderBlue.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Handshake,
                                contentDescription = null,
                                tint = ProviderBlue,
                                modifier = Modifier.size(40.dp)
                            )
                        }
                    }
                }
                
                // Service Info Card
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    // Category Badge
                    s.category?.let { category ->
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = ProviderBlue.copy(alpha = 0.15f)
                        ) {
                            Text(
                                text = category.uppercase(),
                                color = ProviderBlue,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                    
                    // Service Name
                    Text(
                        text = s.name,
                        style = MaterialTheme.typography.headlineSmall,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    
                    // Description
                    s.description?.let { desc ->
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = desc,
                            style = MaterialTheme.typography.bodyMedium,
                            color = WhiteTextMuted,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Duration and Location Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Duration
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Schedule,
                                contentDescription = null,
                                tint = WhiteTextMuted,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "${s.duration ?: 30} min",
                                style = MaterialTheme.typography.bodyMedium,
                                color = WhiteTextMuted
                            )
                        }
                        
                        // Location (provider based)
                        s.provider?.let { provider ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.LocationOn,
                                    contentDescription = null,
                                    tint = WhiteTextMuted,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = listOfNotNull(
                                        provider.addressCity,
                                        provider.addressStreet
                                    ).joinToString(", ").ifEmpty { "Tamil Nadu, India" },
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = WhiteTextMuted,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Price and Book Button Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "From ₹${s.price}",
                                style = MaterialTheme.typography.titleLarge,
                                color = OrangePrimary,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        
                        Button(
                            onClick = { onBookService(serviceId) },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary),
                            enabled = s.isAvailableNow,
                            contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp)
                        ) {
                            Text("Book Now", fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
                
                HorizontalDivider(color = SlateCard, thickness = 8.dp)
                
                // ==================== Service Provider Section ====================
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Text(
                        text = "Service Provider",
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Local help you trust.",
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Provider Card
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = SlateCard)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Provider Avatar
                            Box(
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(CircleShape)
                                    .background(ProviderBlue.copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = (s.provider?.name?.firstOrNull() ?: 'P').uppercase(),
                                    style = MaterialTheme.typography.titleMedium,
                                    color = ProviderBlue,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            
                            Spacer(modifier = Modifier.width(12.dp))
                            
                            // Provider Info
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = s.provider?.name ?: "Service Provider",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = WhiteText,
                                    fontWeight = FontWeight.SemiBold
                                )
                                
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.Star,
                                        contentDescription = null,
                                        tint = AmberSecondary,
                                        modifier = Modifier.size(14.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "${s.rating ?: 0.0} • ${s.reviewCount} reviews",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = WhiteTextMuted
                                    )
                                }
                            }
                            
                            // Service location info
                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = "Service at your",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = WhiteTextMuted
                                )
                                Text(
                                    text = "place or theirs.",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = WhiteTextMuted
                                )
                            }
                        }
                    }
                }
                
                HorizontalDivider(color = SlateCard, thickness = 8.dp)
                
                // ==================== Ratings Section ====================
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = null,
                            tint = AmberSecondary,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Ratings",
                            style = MaterialTheme.typography.titleMedium,
                            color = WhiteText,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(4.dp))
                    
                    Text(
                        text = "${s.rating ?: 0.0}/5 • ${s.reviewCount}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = WhiteTextMuted
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Rating Stars Display
                    Row {
                        repeat(5) { index ->
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = null,
                                tint = if (index < (s.rating?.toInt() ?: 0)) AmberSecondary else SlateCard,
                                modifier = Modifier.size(28.dp)
                            )
                        }
                    }
                    
                    if (s.reviewCount == 0) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "No reviews yet. Be the first to review!",
                            style = MaterialTheme.typography.bodyMedium,
                            color = WhiteTextMuted
                        )
                    }
                }
                
                // Bottom Spacer
                Spacer(modifier = Modifier.height(32.dp))
            }
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Default.ErrorOutline,
                        contentDescription = null,
                        tint = WhiteTextMuted,
                        modifier = Modifier.size(64.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Service not found", color = WhiteTextMuted)
                }
            }
        }
    }
}
