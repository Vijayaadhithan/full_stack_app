package com.doorstep.tn.shop.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.horizontalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Reply
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.shop.data.model.ShopReview
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Shop Reviews Management Screen
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShopReviewsScreen(
    viewModel: ShopViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val reviews by viewModel.shopReviews.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()
    
    var replyingTo by remember { mutableStateOf<ShopReview?>(null) }
    var filterRating by remember { mutableStateOf<Int?>(null) }
    
    val snackbarHostState = remember { SnackbarHostState() }
    
    LaunchedEffect(Unit) {
        viewModel.loadReviews()
    }
    
    LaunchedEffect(error) {
        error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }
    
    LaunchedEffect(successMessage) {
        successMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearSuccessMessage()
        }
    }
    
    val filteredReviews = if (filterRating != null) {
        reviews.filter { it.rating == filterRating }
    } else {
        reviews
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Reviews",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = WhiteText
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = WhiteText
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadReviews() }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Refresh",
                            tint = WhiteText
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = SlateBackground
                )
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
            // Rating Filter
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = filterRating == null,
                    onClick = { filterRating = null },
                    label = { Text("All") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = ShopGreen
                    )
                )
                (5 downTo 1).forEach { rating ->
                    FilterChip(
                        selected = filterRating == rating,
                        onClick = { filterRating = if (filterRating == rating) null else rating },
                        label = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("$rating")
                                Icon(
                                    imageVector = Icons.Default.Star,
                                    contentDescription = null,
                                    modifier = Modifier.size(14.dp),
                                    tint = WarningYellow
                                )
                            }
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = WarningYellow.copy(alpha = 0.2f)
                        )
                    )
                }
            }
            
            // Stats Summary
            if (reviews.isNotEmpty()) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceAround
                    ) {
                        val avgRating = reviews.map { it.rating }.average()
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "%.1f".format(avgRating),
                                    style = MaterialTheme.typography.headlineMedium,
                                    color = WhiteText,
                                    fontWeight = FontWeight.Bold
                                )
                                Icon(
                                    imageVector = Icons.Default.Star,
                                    contentDescription = null,
                                    tint = WarningYellow,
                                    modifier = Modifier.size(24.dp)
                                )
                            }
                            Text("Average", style = MaterialTheme.typography.labelSmall, color = WhiteTextMuted)
                        }
                        
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "${reviews.size}",
                                style = MaterialTheme.typography.headlineMedium,
                                color = WhiteText,
                                fontWeight = FontWeight.Bold
                            )
                            Text("Total", style = MaterialTheme.typography.labelSmall, color = WhiteTextMuted)
                        }
                        
                        val unreplied = reviews.count { !it.hasReply }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "$unreplied",
                                style = MaterialTheme.typography.headlineMedium,
                                color = if (unreplied > 0) OrangePrimary else WhiteText,
                                fontWeight = FontWeight.Bold
                            )
                            Text("Unreplied", style = MaterialTheme.typography.labelSmall, color = WhiteTextMuted)
                        }
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
            }
            
            if (isLoading && reviews.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = ShopGreen)
                }
            } else if (filteredReviews.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = null,
                            tint = WhiteTextMuted,
                            modifier = Modifier.size(64.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = if (filterRating != null) "No $filterRating star reviews" else "No reviews yet",
                            color = WhiteTextMuted
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(filteredReviews) { review ->
                        ReviewCard(
                            review = review,
                            onReply = { replyingTo = review }
                        )
                    }
                }
            }
        }
    }
    
    replyingTo?.let { review ->
        ReplyDialog(
            review = review,
            onDismiss = { replyingTo = null },
            onSubmit = { reply ->
                viewModel.replyToReview(review.id, reply) {
                    replyingTo = null
                }
            }
        )
    }
}

@Composable
private fun ReviewCard(
    review: ShopReview,
    onReply: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    review.productId?.let { productId ->
                        Text(
                            text = "Product #$productId",
                            style = MaterialTheme.typography.titleSmall,
                            color = WhiteText,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    review.orderId?.let { orderId ->
                        Text(
                            text = "Order #$orderId",
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteTextMuted
                        )
                    }
                }
                
                Row {
                    repeat(review.rating) {
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = null,
                            tint = WarningYellow,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    repeat(5 - review.rating) {
                        Icon(
                            imageVector = Icons.Default.StarBorder,
                            contentDescription = null,
                            tint = WhiteTextMuted,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }

            val formattedDate = review.createdAt?.let { formatReviewDate(it) } ?: "N/A"
            Text(
                text = formattedDate,
                style = MaterialTheme.typography.bodySmall,
                color = WhiteTextMuted
            )
            
            if (review.review != null) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = review.review,
                    style = MaterialTheme.typography.bodyMedium,
                    color = WhiteText
                )
            }

            if (!review.images.isNullOrEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    review.images?.forEach { imageUrl ->
                        AsyncImage(
                            model = ImageRequest.Builder(LocalContext.current)
                                .data(imageUrl)
                                .crossfade(true)
                                .build(),
                            contentDescription = "Review image",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .size(72.dp)
                                .clip(RoundedCornerShape(8.dp))
                        )
                    }
                }
            }
            
            if (review.hasReply && review.shopReply != null) {
                Spacer(modifier = Modifier.height(12.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = CardDefaults.cardColors(containerColor = ShopGreen.copy(alpha = 0.1f))
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.Reply,
                                contentDescription = null,
                                tint = ShopGreen,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "Your reply",
                                style = MaterialTheme.typography.labelSmall,
                                color = ShopGreen,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = review.shopReply,
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteText
                        )
                    }
                }
            } else {
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedButton(
                    onClick = onReply,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = ShopGreen)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Reply,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Reply")
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReplyDialog(
    review: ShopReview,
    onDismiss: () -> Unit,
    onSubmit: (String) -> Unit
) {
    var replyText by remember { mutableStateOf("") }
    
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Reply to Review") },
        text = {
            Column {
                Row {
                    repeat(review.rating) {
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = null,
                            tint = WarningYellow,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
                if (review.review != null) {
                    Text(
                        text = "\"${review.review}\"",
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                }
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = replyText,
                    onValueChange = { replyText = it },
                    label = { Text("Your reply") },
                    minLines = 3,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { if (replyText.isNotBlank()) onSubmit(replyText.trim()) },
                enabled = replyText.isNotBlank()
            ) {
                Text("Send Reply")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

private fun formatReviewDate(isoDate: String): String {
    return try {
        val instant = Instant.parse(isoDate)
        val formatter = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH)
        instant.atZone(ZoneId.of("Asia/Kolkata")).format(formatter)
    } catch (e: Exception) {
        isoDate
    }
}
