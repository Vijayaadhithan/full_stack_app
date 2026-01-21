package com.doorstep.tn.provider.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.core.network.ServiceReview

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProviderReviewsScreen(
    viewModel: ProviderViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val reviews by viewModel.reviews.collectAsState()
    val services by viewModel.services.collectAsState()
    val isLoading by viewModel.isLoadingReviews.collectAsState()
    val actionLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }

    val replyTexts = remember { mutableStateMapOf<Int, String>() }

    LaunchedEffect(Unit) {
        viewModel.loadProviderServices()
        viewModel.loadProviderReviews()
    }

    LaunchedEffect(successMessage) {
        successMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearSuccessMessage()
            replyTexts.clear()
        }
    }

    LaunchedEffect(error) {
        error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    val serviceNameById = remember(services) {
        services.associateBy({ it.id }, { it.name })
    }

    val reviewStats = remember(reviews) {
        val total = reviews.size
        val average = if (total == 0) 0.0 else reviews.sumOf { it.rating.toDouble() } / total
        val fiveStar = reviews.count { it.rating == 5 }
        val pendingReplies = reviews.count { it.providerReply.isNullOrBlank() }
        ProviderReviewStats(total, average, fiveStar, pendingReplies)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Reviews & Ratings", color = WhiteText, fontWeight = FontWeight.Bold) },
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
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            ReviewMetricsGrid(stats = reviewStats)

            when {
                isLoading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = ProviderBlue)
                    }
                }
                reviews.isEmpty() -> {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = SlateCard)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("No reviews yet", color = WhiteTextMuted)
                        }
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(reviews) { review ->
                            val serviceLabel = review.serviceId?.let { serviceNameById[it] }
                            ReviewCard(
                                review = review,
                                serviceLabel = serviceLabel,
                                replyText = replyTexts[review.id] ?: "",
                                onReplyTextChange = { replyTexts[review.id] = it },
                                onReply = {
                                    val text = replyTexts[review.id]?.trim().orEmpty()
                                    if (text.isNotBlank()) {
                                        viewModel.replyToReview(review.id, text)
                                    }
                                },
                                isReplying = actionLoading
                            )
                        }
                    }
                }
            }
        }
    }
}

private data class ProviderReviewStats(
    val total: Int,
    val average: Double,
    val fiveStar: Int,
    val pendingReplies: Int
)

@Composable
private fun ReviewMetricsGrid(stats: ProviderReviewStats) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            ReviewMetricCard(
                title = "Average rating",
                value = if (stats.average == 0.0) "0.0" else String.format("%.1f", stats.average),
                modifier = Modifier.weight(1f)
            )
            ReviewMetricCard(
                title = "Total reviews",
                value = stats.total.toString(),
                modifier = Modifier.weight(1f)
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            ReviewMetricCard(
                title = "5-star reviews",
                value = stats.fiveStar.toString(),
                modifier = Modifier.weight(1f)
            )
            ReviewMetricCard(
                title = "Pending replies",
                value = stats.pendingReplies.toString(),
                modifier = Modifier.weight(1f),
                highlightColor = WarningYellow
            )
        }
    }
}

@Composable
private fun ReviewMetricCard(
    title: String,
    value: String,
    modifier: Modifier = Modifier,
    highlightColor: androidx.compose.ui.graphics.Color = WhiteText
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
            Text(text = title, style = MaterialTheme.typography.bodySmall, color = WhiteTextMuted)
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                color = highlightColor,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun ReviewCard(
    review: ServiceReview,
    serviceLabel: String?,
    replyText: String,
    onReplyTextChange: (String) -> Unit,
    onReply: () -> Unit,
    isReplying: Boolean
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
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
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
                }
                Text(
                    text = review.createdAt?.take(10) ?: "",
                    style = MaterialTheme.typography.labelSmall,
                    color = WhiteTextMuted
                )
            }

            if (!serviceLabel.isNullOrBlank()) {
                Text(
                    text = serviceLabel,
                    style = MaterialTheme.typography.labelSmall,
                    color = ProviderBlue
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
                        text = "Your reply",
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
            } else {
                OutlinedTextField(
                    value = replyText,
                    onValueChange = onReplyTextChange,
                    label = { Text("Write your reply") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = ProviderBlue,
                        unfocusedBorderColor = GlassBorder,
                        focusedTextColor = WhiteText,
                        unfocusedTextColor = WhiteText
                    )
                )
                Button(
                    onClick = onReply,
                    enabled = replyText.trim().isNotEmpty() && !isReplying,
                    colors = ButtonDefaults.buttonColors(containerColor = ProviderBlue)
                ) {
                    Text("Reply")
                }
            }
        }
    }
}
