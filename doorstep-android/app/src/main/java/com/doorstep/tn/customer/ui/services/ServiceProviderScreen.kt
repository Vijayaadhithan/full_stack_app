package com.doorstep.tn.customer.ui.services

import android.content.Intent
import android.net.Uri
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.customer.data.model.ProviderInfo
import com.doorstep.tn.customer.ui.CustomerViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServiceProviderScreen(
    serviceId: Int,
    viewModel: CustomerViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onBookService: (Int) -> Unit
) {
    val service by viewModel.selectedService.collectAsState()
    val reviews by viewModel.serviceReviews.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    val context = LocalContext.current

    LaunchedEffect(serviceId) {
        viewModel.loadServiceDetails(serviceId)
        viewModel.loadServiceReviews(serviceId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Service Provider", color = WhiteText) },
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
        when {
            isLoading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = ProviderBlue)
                }
            }
            service == null -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    Text("Service not found", color = WhiteTextMuted)
                }
            }
            else -> {
                val s = service!!
                val provider = s.provider

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    ProviderInfoCard(
                        provider = provider,
                        rating = s.rating ?: 0.0,
                        reviewCount = s.reviewCount,
                        onCall = { phone ->
                            val digits = phone.filter { it.isDigit() }
                            if (digits.isNotBlank()) {
                                val intent = Intent(Intent.ACTION_DIAL).apply {
                                    data = Uri.parse("tel:$digits")
                                }
                                context.startActivity(intent)
                            }
                        },
                        onOpenMap = { latitude, longitude, address ->
                            val uri = buildMapsUri(latitude, longitude, address)
                            if (uri != null) {
                                context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                            }
                        }
                    )

                    ServiceDetailCard(
                        name = s.name,
                        description = s.description,
                        duration = s.duration,
                        price = s.price,
                        isAvailable = s.isAvailable && s.isAvailableNow,
                        onBookService = { onBookService(serviceId) }
                    )

                    ReviewsSection(reviews = reviews)
                }
            }
        }
    }
}

@Composable
private fun ProviderInfoCard(
    provider: ProviderInfo?,
    rating: Double,
    reviewCount: Int,
    onCall: (String) -> Unit,
    onOpenMap: (Double?, Double?, String?) -> Unit
) {
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
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(ProviderBlue.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = (provider?.name?.firstOrNull() ?: 'P').uppercase(),
                        style = MaterialTheme.typography.titleLarge,
                        color = ProviderBlue,
                        fontWeight = FontWeight.Bold
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = provider?.name ?: "Service Provider",
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = null,
                            tint = AmberSecondary,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = String.format(java.util.Locale.US, "%.1f", rating) + " (${reviewCount} reviews)",
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteTextMuted
                        )
                    }
                }
            }

            Text(
                text = buildProviderAddress(provider),
                style = MaterialTheme.typography.bodySmall,
                color = WhiteTextMuted
            )

            val hasPhone = provider?.phone?.isNotBlank() == true
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (hasPhone) {
                    OutlinedButton(
                        onClick = { onCall(provider?.phone ?: "") },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = ProviderBlue)
                    ) {
                        Icon(Icons.Default.Phone, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Call")
                    }
                }
                OutlinedButton(
                    onClick = { onOpenMap(provider?.latitude, provider?.longitude, buildProviderAddress(provider)) },
                    modifier = if (hasPhone) Modifier.weight(1f) else Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = ProviderBlue)
                ) {
                    Icon(Icons.Default.Map, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Map")
                }
            }
        }
    }
}

@Composable
private fun ServiceDetailCard(
    name: String,
    description: String?,
    duration: Int?,
    price: String,
    isAvailable: Boolean,
    onBookService: () -> Unit
) {
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
            Text(text = name, style = MaterialTheme.typography.titleMedium, color = WhiteText)
            description?.takeIf { it.isNotBlank() }?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "${duration ?: 30} min",
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted
                )
                Text(
                    text = "₹$price",
                    style = MaterialTheme.typography.titleMedium,
                    color = OrangePrimary,
                    fontWeight = FontWeight.Bold
                )
            }
            Button(
                onClick = onBookService,
                modifier = Modifier.fillMaxWidth(),
                enabled = isAvailable,
                colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary)
            ) {
                Text(if (isAvailable) "Book Now" else "Unavailable")
            }
        }
    }
}

@Composable
private fun ReviewsSection(reviews: List<com.doorstep.tn.core.network.ServiceReview>) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text = "Reviews",
            style = MaterialTheme.typography.titleMedium,
            color = WhiteText,
            fontWeight = FontWeight.Bold
        )

        if (reviews.isEmpty()) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = SlateCard)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("No reviews yet", color = WhiteTextMuted)
                }
            }
        } else {
            reviews.forEach { review ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            repeat(5) { index ->
                                Icon(
                                    imageVector = Icons.Default.Star,
                                    contentDescription = null,
                                    tint = if (index < review.rating) AmberSecondary else WhiteTextMuted.copy(alpha = 0.3f),
                                    modifier = Modifier.size(16.dp)
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
                        if (!review.providerReply.isNullOrBlank()) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(SlateBackground, RoundedCornerShape(8.dp))
                                    .padding(12.dp)
                            ) {
                                Text(
                                    text = "Provider reply",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = ProviderBlue,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = review.providerReply,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = WhiteTextMuted
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun buildProviderAddress(provider: ProviderInfo?): String {
    if (provider == null) return "Address not available"
    val parts = listOfNotNull(
        provider.addressStreet,
        provider.addressCity,
        provider.addressState,
        provider.addressPostalCode,
        provider.addressCountry
    ).filter { it.isNotBlank() }
    return if (parts.isEmpty()) "Address not available" else parts.joinToString(", ")
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
