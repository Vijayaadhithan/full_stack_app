package com.doorstep.tn.customer.ui.reviews

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.core.network.CustomerReview
import com.doorstep.tn.core.network.CustomerProductReview
import com.doorstep.tn.customer.ui.CustomerViewModel
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

/**
 * My Reviews Screen - matches web app's MyReviews.tsx
 * Shows customer's service and product reviews with edit functionality
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MyReviewsScreen(
    viewModel: CustomerViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val serviceReviews by viewModel.customerReviews.collectAsState()
    val productReviews by viewModel.customerProductReviews.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    
    // Tab selection: 0=Services, 1=Products
    var selectedTab by remember { mutableStateOf(0) }
    
    // Edit Review State
    var showEditDialog by remember { mutableStateOf(false) }
    var reviewToEdit by remember { mutableStateOf<Any?>(null) } // Can be CustomerReview or CustomerProductReview
    
    LaunchedEffect(Unit) {
        viewModel.loadCustomerReviews()
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("My Reviews", color = WhiteText) },
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
            // Tabs for Service Reviews vs Product Reviews
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = SlateCard,
                contentColor = OrangePrimary
            ) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    text = { Text("Service Reviews", color = if (selectedTab == 0) OrangePrimary else WhiteTextMuted) },
                    icon = { Icon(Icons.Default.Star, null, tint = if (selectedTab == 0) OrangePrimary else WhiteTextMuted) }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    text = { Text("Product Reviews", color = if (selectedTab == 1) OrangePrimary else WhiteTextMuted) },
                    icon = { Icon(Icons.Default.ShoppingBag, null, tint = if (selectedTab == 1) OrangePrimary else WhiteTextMuted) }
                )
            }
            
            if (isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = OrangePrimary)
                }
            } else if (error != null) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.Error,
                            contentDescription = null,
                            tint = ErrorRed,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(error ?: "Error loading reviews", color = ErrorRed)
                    }
                }
            } else {
                when (selectedTab) {
                    0 -> ServiceReviewsList(
                        reviews = serviceReviews,
                        onEditReview = { review ->
                            reviewToEdit = review
                            showEditDialog = true
                        }
                    )
                    1 -> ProductReviewsList(
                        reviews = productReviews,
                        onEditReview = { review ->
                            reviewToEdit = review
                            showEditDialog = true
                        }
                    )
                }
            }
        }
        
        if (showEditDialog && reviewToEdit != null) {
            EditReviewDialog(
                reviewItem = reviewToEdit!!,
                onDismiss = {
                    showEditDialog = false
                    reviewToEdit = null
                },
                onSubmit = { rating, text ->
                    if (reviewToEdit is CustomerReview) {
                        viewModel.updateServiceReview(
                            reviewId = (reviewToEdit as CustomerReview).id,
                            rating = rating,
                            review = text,
                            onSuccess = {
                                showEditDialog = false
                                reviewToEdit = null
                            },
                            onError = { /* ViewModel handles error state */ }
                        )
                    } else if (reviewToEdit is CustomerProductReview) {
                        viewModel.updateProductReview(
                            reviewId = (reviewToEdit as CustomerProductReview).id,
                            rating = rating,
                            review = text,
                            onSuccess = {
                                showEditDialog = false
                                reviewToEdit = null
                            },
                            onError = { /* ViewModel handles error state */ }
                        )
                    }
                }
            )
        }
    }
}

@Composable
private fun ServiceReviewsList(
    reviews: List<CustomerReview>,
    onEditReview: (CustomerReview) -> Unit
) {
    if (reviews.isEmpty()) {
        EmptyReviewsMessage("You haven't submitted any service reviews yet.")
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(reviews) { review ->
                ServiceReviewCard(review = review, onEdit = { onEditReview(review) })
            }
        }
    }
}

@Composable
private fun ProductReviewsList(
    reviews: List<CustomerProductReview>,
    onEditReview: (CustomerProductReview) -> Unit
) {
    if (reviews.isEmpty()) {
        EmptyReviewsMessage("You haven't submitted any product reviews yet.")
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(reviews) { review ->
                ProductReviewCard(review = review, onEdit = { onEditReview(review) })
            }
        }
    }
}

@Composable
private fun EmptyReviewsMessage(message: String) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                imageVector = Icons.Default.RateReview,
                contentDescription = null,
                tint = WhiteTextMuted,
                modifier = Modifier.size(64.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = message,
                color = WhiteTextMuted,
                style = MaterialTheme.typography.bodyLarge
            )
        }
    }
}

@Composable
private fun ServiceReviewCard(
    review: CustomerReview,
    onEdit: () -> Unit
) {
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
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Service name
                Text(
                    text = review.serviceName ?: "Service ID: ${review.serviceId}",
                    style = MaterialTheme.typography.titleMedium,
                    color = WhiteText,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f)
                )
                
                // Edit Button
                OutlinedButton(
                    onClick = onEdit,
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                    modifier = Modifier.height(32.dp)
                ) {
                    Text("Edit Review", style = MaterialTheme.typography.labelSmall, color = WhiteText)
                }
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // Star rating
            StarRatingDisplay(rating = review.rating)
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // Review text
            Text(
                text = review.review ?: "No comment provided.",
                style = MaterialTheme.typography.bodyMedium,
                color = WhiteTextMuted
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // Date
            Text(
                text = "Reviewed on: ${formatReviewDate(review.createdAt)}",
                style = MaterialTheme.typography.bodySmall,
                color = WhiteTextMuted.copy(alpha = 0.7f)
            )
        }
    }
}

@Composable
private fun ProductReviewCard(
    review: CustomerProductReview,
    onEdit: () -> Unit
) {
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
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Product name
                Text(
                    text = review.productName ?: "Product ID: ${review.productId}",
                    style = MaterialTheme.typography.titleMedium,
                    color = WhiteText,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f)
                )
                
                // Edit Button
                OutlinedButton(
                    onClick = onEdit,
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                    modifier = Modifier.height(32.dp)
                ) {
                    Text("Edit Review", style = MaterialTheme.typography.labelSmall, color = WhiteText)
                }
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // Star rating
            StarRatingDisplay(rating = review.rating)
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // Review text
            Text(
                text = review.review ?: "No comment provided.",
                style = MaterialTheme.typography.bodyMedium,
                color = WhiteTextMuted
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // Date
            Text(
                text = "Reviewed on: ${formatReviewDate(review.createdAt)}",
                style = MaterialTheme.typography.bodySmall,
                color = WhiteTextMuted.copy(alpha = 0.7f)
            )
        }
    }
}

@Composable
private fun StarRatingDisplay(rating: Int) {
    Row {
        (1..5).forEach { star ->
            Icon(
                imageVector = if (star <= rating) Icons.Default.Star else Icons.Default.StarBorder,
                contentDescription = "Star $star",
                tint = if (star <= rating) OrangePrimary else WhiteTextMuted,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

@Composable
private fun EditReviewDialog(
    reviewItem: Any,
    onDismiss: () -> Unit,
    onSubmit: (Int, String) -> Unit
) {
    val initialRating = when (reviewItem) {
        is CustomerReview -> reviewItem.rating
        is CustomerProductReview -> reviewItem.rating
        else -> 5
    }
    
    val initialReview = when (reviewItem) {
        is CustomerReview -> reviewItem.review ?: ""
        is CustomerProductReview -> reviewItem.review ?: ""
        else -> ""
    }
    
    var rating by remember { mutableIntStateOf(initialRating) }
    var reviewText by remember { mutableStateOf(initialReview) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SlateCard,
        title = {
            Text(
                "Edit Review",
                style = MaterialTheme.typography.titleLarge,
                color = WhiteText
            )
        },
        text = {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center
                ) {
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
                    label = { Text("Your Review") },
                    modifier = Modifier.fillMaxWidth().height(120.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = WhiteText,
                        unfocusedTextColor = WhiteText,
                        cursorColor = OrangePrimary,
                        focusedBorderColor = OrangePrimary,
                        unfocusedBorderColor = WhiteTextMuted,
                        focusedLabelColor = OrangePrimary,
                        unfocusedLabelColor = WhiteTextMuted
                    )
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onSubmit(rating, reviewText) },
                colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary)
            ) {
                Text("Update Review")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = WhiteTextMuted)
            }
        }
    )
}

private fun formatReviewDate(dateStr: String?): String {
    if (dateStr.isNullOrEmpty()) return "Date unavailable"
    
    return try {
        val formatter = DateTimeFormatter.ISO_DATE_TIME
        val dateTime = LocalDateTime.parse(dateStr.replace("Z", ""))
        dateTime.format(DateTimeFormatter.ofPattern("dd MMM yyyy"))
    } catch (e: DateTimeParseException) {
        dateStr.take(10)
    }
}
