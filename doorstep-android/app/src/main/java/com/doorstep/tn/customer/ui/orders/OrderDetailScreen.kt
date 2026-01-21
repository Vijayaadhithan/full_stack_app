package com.doorstep.tn.customer.ui.orders

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.core.network.OrderTimelineEntry
import com.doorstep.tn.customer.data.model.Order
import com.doorstep.tn.customer.data.model.OrderItem
import com.doorstep.tn.customer.ui.CustomerViewModel
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Order Detail Screen - matches web app's /customer/order/{id} page
 * 
 * Features:
 * 1. Order header with status badge
 * 2. Shop/Customer contact info with WhatsApp sharing
 * 3. Order items list with Leave Review button
 * 4. Order summary (subtotal, total)
 * 5. Order Timeline section
 * 6. Map link for pickup orders
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderDetailScreen(
    orderId: Int,
    viewModel: CustomerViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToCart: () -> Unit
) {
    val context = LocalContext.current
    val selectedOrder by viewModel.selectedOrder.collectAsState()
    val orderTimeline by viewModel.orderTimeline.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    
    // Dialog states
    var showReviewDialog by remember { mutableStateOf(false) }
    var selectedProductForReview by remember { mutableStateOf<OrderItem?>(null) }
    
    // Return Request State
    var showReturnDialog by remember { mutableStateOf(false) }
    var showCancelDialog by remember { mutableStateOf(false) }
    
    // Load order details and timeline on first composition
    LaunchedEffect(orderId) {
        viewModel.loadOrderDetails(orderId)
        viewModel.loadOrderTimeline(orderId)
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Text(
                        "Order #$orderId", 
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
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SlateBackground)
            )
        },
        containerColor = SlateDarker
    ) { paddingValues ->
        if (isLoading && selectedOrder == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = OrangePrimary)
            }
        } else if (selectedOrder == null) {
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
                    Text(
                        "Order not found",
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText
                    )
                }
            }
        } else {
            val order = selectedOrder!!
            OrderDetailContent(
                order = order,
                orderId = orderId,
                timeline = orderTimeline,
                paddingValues = paddingValues,
                viewModel = viewModel,
                onOpenMap = { lat, lng ->
                    val gmmIntentUri = Uri.parse("geo:$lat,$lng?q=$lat,$lng")
                    val mapIntent = Intent(Intent.ACTION_VIEW, gmmIntentUri)
                    mapIntent.setPackage("com.google.android.apps.maps")
                    context.startActivity(mapIntent)
                },
                onSendWhatsApp = { phone, lat, lng ->
                    val message = "Here is the shop location: https://www.google.com/maps?q=$lat,$lng"
                    val uri = Uri.parse("https://wa.me/$phone?text=${Uri.encode(message)}")
                    val intent = Intent(Intent.ACTION_VIEW, uri)
                    context.startActivity(intent)
                },
                onLeaveReview = { item ->
                    selectedProductForReview = item
                    showReviewDialog = true
                },
                onShowReturnDialog = {
                    showReturnDialog = true
                },
                onShowCancelDialog = {
                    showCancelDialog = true
                },
                onShowToast = { message ->
                    Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
                },
                onNavigateToCart = onNavigateToCart
            )
        }
    }
    
    // Review Dialog
    if (showReviewDialog && selectedProductForReview != null) {
        ProductReviewDialog(
            productName = selectedProductForReview?.product?.name ?: "Product",
            onDismiss = { 
                showReviewDialog = false
                selectedProductForReview = null
            },
            onSubmit = { rating, review ->
                selectedProductForReview?.productId?.let { productId ->
                    viewModel.submitProductReview(
                        productId = productId,
                        orderId = orderId,
                        rating = rating,
                        review = review,
                        onSuccess = {
                            Toast.makeText(context, "Review submitted!", Toast.LENGTH_SHORT).show()
                            showReviewDialog = false
                            selectedProductForReview = null
                        },
                        onError = { message ->
                            Toast.makeText(context, message, Toast.LENGTH_LONG).show()
                        }
                    )
                }
            }
        )
    }
    
    // Return Request Dialog
    if (showReturnDialog) {
        ReturnRequestDialog(
            onDismiss = { showReturnDialog = false },
            onSubmit = { reason, description ->
                viewModel.createReturnRequest(
                    orderId = orderId,
                    reason = reason,
                    description = description,
                    onSuccess = {
                        Toast.makeText(context, "Return request submitted", Toast.LENGTH_LONG).show()
                        viewModel.loadOrderDetails(orderId)
                        showReturnDialog = false
                    },
                    onError = { message ->
                        Toast.makeText(context, message, Toast.LENGTH_LONG).show()
                    }
                )
            }
        )
    }

    if (showCancelDialog && selectedOrder != null) {
        AlertDialog(
            onDismissRequest = { showCancelDialog = false },
            title = { Text("Cancel order?") },
            text = { Text("You can cancel this order before payment. This action cannot be undone.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showCancelDialog = false
                        viewModel.cancelOrder(
                            orderId = orderId,
                            onSuccess = {
                                Toast.makeText(context, "Order cancelled", Toast.LENGTH_LONG).show()
                            },
                            onError = { message ->
                                Toast.makeText(context, message, Toast.LENGTH_LONG).show()
                            }
                        )
                    }
                ) {
                    Text("Cancel Order")
                }
            },
            dismissButton = {
                TextButton(onClick = { showCancelDialog = false }) {
                    Text("Keep Order")
                }
            }
        )
    }
}

@Composable
private fun OrderDetailContent(
    order: Order,
    orderId: Int,
    timeline: List<OrderTimelineEntry>,
    paddingValues: PaddingValues,
    viewModel: CustomerViewModel,
    onOpenMap: (Double, Double) -> Unit,
    onSendWhatsApp: (String, Double, Double) -> Unit,
    onLeaveReview: (OrderItem) -> Unit,
    onShowReturnDialog: () -> Unit,
    onShowCancelDialog: () -> Unit,
    onShowToast: (String) -> Unit,
    onNavigateToCart: () -> Unit
) {
    val context = LocalContext.current
    
    // Payment action states
    var transactionId by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var isReordering by remember { mutableStateOf(false) }
    var isUpdatingPaymentMethod by remember { mutableStateOf(false) }
    val normalizedPaymentMethod = order.paymentMethod?.lowercase()
    val isTextOrder = order.orderType == "text_order"
    var resolvedUpiId by remember(order.shop?.upiId, order.shopId) {
        mutableStateOf(order.shop?.upiId)
    }

    LaunchedEffect(order.shopId, order.shop?.upiId) {
        val currentUpiId = order.shop?.upiId
        resolvedUpiId = currentUpiId
        if (currentUpiId.isNullOrBlank()) {
            order.shopId?.let { shopId ->
                viewModel.getShopUpiId(shopId) { fetchedUpiId ->
                    if (!fetchedUpiId.isNullOrBlank()) {
                        resolvedUpiId = fetchedUpiId
                    }
                }
            }
        }
    }
    val upiIdToUse = resolvedUpiId?.takeIf { it.isNotBlank() }
    
    // Helper to copy UPI ID to clipboard
    val copyUpiToClipboard: () -> Unit = {
        upiIdToUse?.let { upiId ->
            val clipboard = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
            val clip = android.content.ClipData.newPlainText("UPI ID", upiId)
            clipboard.setPrimaryClip(clip)
            onShowToast("UPI ID copied!")
        }
    }
    val updatePaymentMethod: (String) -> Unit = { method ->
        if (!isUpdatingPaymentMethod && normalizedPaymentMethod != method) {
            isUpdatingPaymentMethod = true
            viewModel.updatePaymentMethod(
                orderId = orderId,
                paymentMethod = method,
                onSuccess = {
                    isUpdatingPaymentMethod = false
                    onShowToast("Payment method updated")
                },
                onError = { error ->
                    isUpdatingPaymentMethod = false
                    onShowToast(error)
                }
            )
        }
    }
    // ... existing implementation remains same until LazyColumn ...
    // Note: I'm not re-pasting the inner content as it was updated in previous step
    // The main change here is adding onShowReturnDialog to the signature and passing it down
    
    // Status labels matching web
    val statusLabel = when (order.status.lowercase()) {
        "pending" -> "Sent to Shop"
        "awaiting_customer_agreement" -> "Awaiting your approval"
        "confirmed" -> "Confirmed"
        "processing" -> "Processing"
        "packed" -> "Packed"
        "dispatched" -> if (order.deliveryMethod == "pickup") "Ready to Collect" else "Dispatched"
        "shipped" -> if (order.deliveryMethod == "pickup") "Ready to Collect" else "Shipped"
        "delivered" -> if (order.deliveryMethod == "pickup") "Collected" else "Delivered"
        "cancelled" -> "Cancelled"
        "returned" -> "Returned"
        else -> order.status.replaceFirstChar { it.uppercase() }
    }
    
    val statusColor = when (order.status.lowercase()) {
        "delivered" -> SuccessGreen
        "dispatched", "shipped", "confirmed", "processing", "packed" -> ProviderBlue
        "cancelled", "returned" -> ErrorRed
        "awaiting_customer_agreement" -> WarningYellow
        else -> OrangePrimary
    }
    val paymentMethodLabel = when (normalizedPaymentMethod) {
        "upi" -> "UPI"
        "cash" -> "Cash"
        "pay_later" -> "Pay Later"
        else -> order.paymentMethod ?: "Not specified"
    }

    val reorderItems = order.items
        ?.filter { it.productId != null && it.quantity > 0 }
        ?: emptyList()
    val canReorder = order.orderType != "text_order" && reorderItems.isNotEmpty()
    val canCancel = order.paymentStatus == "pending" &&
        order.status.lowercase() !in listOf("cancelled", "dispatched", "shipped", "delivered", "returned")
    
    // Format date with IST timezone conversion
    val formattedDate = order.orderDate?.let {
        try {
            val cleanDate = it.substringBefore("[").trim()
            val instant = java.time.Instant.parse(
                if (cleanDate.endsWith("Z")) cleanDate else "${cleanDate}Z"
            )
            val istZone = java.time.ZoneId.of("Asia/Kolkata")
            val localDateTime = instant.atZone(istZone).toLocalDateTime()
            val outputFormatter = DateTimeFormatter.ofPattern("dd MMMM yyyy, hh:mm a")
            localDateTime.format(outputFormatter)
        } catch (e: Exception) {
            it
        }
    } ?: "Recently"
    
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // ==================== Order Header ====================
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = SlateCard)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    // Order ID and Status
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "Order #${order.id}",
                                style = MaterialTheme.typography.titleLarge,
                                color = WhiteText,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = formattedDate,
                                style = MaterialTheme.typography.bodySmall,
                                color = WhiteTextMuted
                            )
                        }
                        
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = statusColor.copy(alpha = 0.15f)
                        ) {
                            Text(
                                text = statusLabel,
                                color = statusColor,
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    HorizontalDivider(color = GlassWhite)
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Delivery Method and Payment
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text("Delivery Method", color = WhiteTextMuted, style = MaterialTheme.typography.bodySmall)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = if (order.deliveryMethod == "pickup") Icons.Default.Store else Icons.Default.LocalShipping,
                                    contentDescription = null,
                                    tint = OrangePrimary,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = when (order.deliveryMethod) {
                                        "pickup" -> "I will come take it"
                                        "delivery" -> "Home Delivery"
                                        else -> order.deliveryMethod ?: "Not specified"
                                    },
                                    color = WhiteText,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("Payment", color = WhiteTextMuted, style = MaterialTheme.typography.bodySmall)
                            Text(
                                text = paymentMethodLabel,
                                color = WhiteText,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
        }
        
        // ==================== Payment Action Section ====================
        // Show when: awaiting_customer_agreement (Agree), confirmed + payment pending (Complete Payment)
        val isAwaitingAgreement = order.status.lowercase() == "awaiting_customer_agreement"
        val canCompletePayment = order.status.lowercase() == "confirmed" && order.paymentStatus == "pending"
        val isPaymentVerifying = order.paymentStatus == "verifying"
        
        if (isAwaitingAgreement || canCompletePayment || isPaymentVerifying) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        when {
                            isAwaitingAgreement -> {
                                // Agree to Final Bill Section
                                Text(
                                    text = "Agree to Final Bill",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = WhiteText,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Final bill shared. Agree to continue.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = WhiteTextMuted
                                )
                                Spacer(modifier = Modifier.height(16.dp))
                                
                                // Final Bill Amount
                                Surface(
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(12.dp),
                                    color = GlassWhite
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(16.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column {
                                            Text(
                                                text = "FINAL BILL",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = WhiteTextMuted
                                            )
                                            Text(
                                                text = "₹${order.total}",
                                                style = MaterialTheme.typography.headlineMedium,
                                                color = WhiteText,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                        Button(
                                            onClick = {
                                                isSubmitting = true
                                                viewModel.agreeFinalBill(
                                                    orderId = orderId,
                                                    onSuccess = {
                                                        isSubmitting = false
                                                        onShowToast("Final bill confirmed. Now choose a payment method.")
                                                    },
                                                    onError = { error ->
                                                        isSubmitting = false
                                                        onShowToast(error)
                                                    }
                                                )
                                            },
                                            enabled = !isSubmitting,
                                            colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary),
                                            shape = RoundedCornerShape(8.dp)
                                        ) {
                                            if (isSubmitting) {
                                                CircularProgressIndicator(
                                                    modifier = Modifier.size(20.dp),
                                                    color = WhiteText,
                                                    strokeWidth = 2.dp
                                                )
                                            } else {
                                                Text("Agree", fontWeight = FontWeight.Bold)
                                            }
                                        }
                                    }
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "After agreeing, choose a payment method.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = WhiteTextMuted
                                )
                            }
                            
                            canCompletePayment -> {
                                // Complete Payment Section
                                Text(
                                    text = "Complete Payment",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = WhiteText,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                
                                if (isTextOrder) {
                                    Text(
                                        text = "Choose Payment Method",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = WhiteText,
                                        fontWeight = FontWeight.Medium
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    OrderPaymentMethodOption(
                                        label = "UPI",
                                        isSelected = normalizedPaymentMethod == "upi",
                                        enabled = !isUpdatingPaymentMethod,
                                        onClick = { updatePaymentMethod("upi") }
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    OrderPaymentMethodOption(
                                        label = "Cash",
                                        isSelected = normalizedPaymentMethod == "cash",
                                        enabled = !isUpdatingPaymentMethod,
                                        onClick = { updatePaymentMethod("cash") }
                                    )
                                    if (normalizedPaymentMethod == "pay_later") {
                                        Spacer(modifier = Modifier.height(8.dp))
                                        OrderPaymentMethodOption(
                                            label = "Pay Later",
                                            isSelected = true,
                                            enabled = !isUpdatingPaymentMethod,
                                            onClick = { updatePaymentMethod("pay_later") }
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(16.dp))
                                }
                                
                                when (normalizedPaymentMethod) {
                                    "upi" -> {
                                        if (!upiIdToUse.isNullOrBlank()) {
                                            // UPI Payment Flow
                                            Text(
                                                text = "Step 1: Pay ₹${order.total} to $upiIdToUse",
                                                style = MaterialTheme.typography.bodyMedium,
                                                color = WhiteText,
                                                fontWeight = FontWeight.Medium
                                            )
                                            Spacer(modifier = Modifier.height(8.dp))
                                            
                                            OutlinedButton(
                                                onClick = copyUpiToClipboard,
                                                colors = ButtonDefaults.outlinedButtonColors(contentColor = OrangePrimary)
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.ContentCopy,
                                                    contentDescription = null,
                                                    modifier = Modifier.size(16.dp)
                                                )
                                                Spacer(modifier = Modifier.width(4.dp))
                                                Text("Copy UPI ID")
                                            }
                                            
                                            Spacer(modifier = Modifier.height(16.dp))
                                            
                                            // Transaction ID Input
                                            OutlinedTextField(
                                                value = transactionId,
                                                onValueChange = { transactionId = it },
                                                placeholder = { Text("Transaction ID") },
                                                modifier = Modifier.fillMaxWidth(),
                                                singleLine = true,
                                                colors = OutlinedTextFieldDefaults.colors(
                                                    focusedTextColor = WhiteText,
                                                    unfocusedTextColor = WhiteText,
                                                    cursorColor = OrangePrimary,
                                                    focusedBorderColor = OrangePrimary,
                                                    unfocusedBorderColor = WhiteTextMuted,
                                                    focusedPlaceholderColor = WhiteTextMuted,
                                                    unfocusedPlaceholderColor = WhiteTextMuted
                                                )
                                            )
                                            
                                            Spacer(modifier = Modifier.height(12.dp))
                                            
                                            Button(
                                                onClick = {
                                                    if (transactionId.isNotBlank()) {
                                                        isSubmitting = true
                                                        viewModel.submitPaymentReference(
                                                            orderId = orderId,
                                                            reference = transactionId,
                                                            onSuccess = {
                                                                isSubmitting = false
                                                                transactionId = ""
                                                                onShowToast("Payment reference submitted")
                                                            },
                                                            onError = { error ->
                                                                isSubmitting = false
                                                                onShowToast(error)
                                                            }
                                                        )
                                                    }
                                                },
                                                enabled = transactionId.isNotBlank() && !isSubmitting,
                                                colors = ButtonDefaults.buttonColors(
                                                    containerColor = OrangePrimary,
                                                    disabledContainerColor = OrangePrimary.copy(alpha = 0.5f)
                                                ),
                                                shape = RoundedCornerShape(8.dp)
                                            ) {
                                                if (isSubmitting) {
                                                    CircularProgressIndicator(
                                                        modifier = Modifier.size(20.dp),
                                                        color = WhiteText,
                                                        strokeWidth = 2.dp
                                                    )
                                                } else {
                                                    Text("Submit Confirmation", fontWeight = FontWeight.Bold)
                                                }
                                            }
                                        } else {
                                            Text(
                                                text = "UPI is not configured for this shop.",
                                                style = MaterialTheme.typography.bodyMedium,
                                                color = WhiteTextMuted
                                            )
                                        }
                                    }
                                    "cash" -> {
                                        // Cash Payment
                                        Text(
                                            text = "Pay ₹${order.total} in cash " +
                                                if (order.deliveryMethod == "delivery") "on delivery" else "on pickup",
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = WhiteText,
                                            fontWeight = FontWeight.Medium
                                        )
                                    }
                                    "pay_later" -> {
                                        // Pay Later
                                        Text(
                                            text = "Pay Later order is pending shop approval.",
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = WhiteTextMuted
                                        )
                                    }
                                    else -> {
                                        Text(
                                            text = "Payment pending. Contact shop for details.",
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = WhiteTextMuted
                                        )
                                    }
                                }
                            }
                            
                            isPaymentVerifying -> {
                                // Payment Verification in Progress
                                Text(
                                    text = "Payment verification in progress. Shop will confirm soon.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = WhiteTextMuted
                                )
                            }
                        }
                    }
                }
            }
        }
        
        if (canReorder || canCancel) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Order Actions",
                            style = MaterialTheme.typography.titleMedium,
                            color = WhiteText,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            if (canReorder) {
                                OutlinedButton(
                                    onClick = {
                                        isReordering = true
                                        viewModel.reorderItems(
                                            order = order,
                                            onSuccess = {
                                                isReordering = false
                                                onShowToast("Items added to cart")
                                                onNavigateToCart()
                                            },
                                            onError = { message ->
                                                isReordering = false
                                                onShowToast(message)
                                            }
                                        )
                                    },
                                    enabled = !isReordering,
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = OrangePrimary),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    if (isReordering) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(18.dp),
                                            color = OrangePrimary,
                                            strokeWidth = 2.dp
                                        )
                                    } else {
                                        Text("Reorder", fontWeight = FontWeight.SemiBold)
                                    }
                                }
                            }

                            if (canCancel) {
                                Button(
                                    onClick = onShowCancelDialog,
                                    colors = ButtonDefaults.buttonColors(containerColor = ErrorRed),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Cancel Order", fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }
                    }
                }
            }
        }
        
        
        // ==================== Shop Contact Info ====================
        if (order.shop != null) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Shop Contact",
                            style = MaterialTheme.typography.titleMedium,
                            color = WhiteText,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        
                        // Shop Name
                        ContactRow(
                            label = "Name",
                            value = order.shop.name ?: "Shop",
                            icon = Icons.Default.Store
                        )
                        
                        // Shop Phone
                        order.shop.phone?.let { phone ->
                            Spacer(modifier = Modifier.height(8.dp))
                            ContactRow(
                                label = "Mobile",
                                value = phone,
                                icon = Icons.Default.Phone
                            )
                        }
                        
                        // Shop Address
                        order.shop.address?.let { address ->
                            Spacer(modifier = Modifier.height(8.dp))
                            ContactRow(
                                label = "Address",
                                value = address,
                                icon = Icons.Default.LocationOn
                            )
                        }
                        
                        // Action Buttons Row
                        if (order.shop.latitude != null && order.shop.longitude != null) {
                            Spacer(modifier = Modifier.height(16.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                // Send Location on WhatsApp
                                order.shop.phone?.let { phone ->
                                    OutlinedButton(
                                        onClick = { 
                                            onSendWhatsApp(
                                                phone.replace("+", "").replace(" ", ""),
                                                order.shop.latitude,
                                                order.shop.longitude
                                            )
                                        },
                                        modifier = Modifier.weight(1f),
                                        colors = ButtonDefaults.outlinedButtonColors(
                                            contentColor = SuccessGreen
                                        )
                                    ) {
                                        Icon(
                                            imageVector = Icons.AutoMirrored.Filled.Chat,
                                            contentDescription = null,
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("WhatsApp", style = MaterialTheme.typography.labelSmall)
                                    }
                                }
                                
                                // View on Map
                                OutlinedButton(
                                    onClick = { 
                                        onOpenMap(order.shop.latitude, order.shop.longitude)
                                    },
                                    modifier = Modifier.weight(1f),
                                    colors = ButtonDefaults.outlinedButtonColors(
                                        contentColor = OrangePrimary
                                    )
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Map,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("View Map", style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // ==================== Order Items ====================
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = SlateCard)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Order Items",
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    // Text order display
                    if (!order.orderText.isNullOrBlank()) {
                        Text(
                            text = order.orderText,
                            color = WhiteTextMuted,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    } else if (order.items.isNullOrEmpty()) {
                        Text(
                            text = "No items in this order",
                            color = WhiteTextMuted,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }
        }
        
        // Order items list with Leave Review
        order.items?.let { items ->
            items(items) { item ->
                OrderItemCard(
                    item = item,
                    showReview = order.status.lowercase() == "delivered",
                    onLeaveReview = { onLeaveReview(item) }
                )
            }
        }
        
        // ==================== Order Summary ====================
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = SlateCard)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Order Summary",
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    // Subtotal
                    order.subtotal?.let { subtotal ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Subtotal", color = WhiteTextMuted)
                            Text("₹$subtotal", color = WhiteText)
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                    
                    HorizontalDivider(color = GlassWhite)
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    // Total
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            "Total Amount",
                            color = WhiteText,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            "₹${order.total}",
                            color = OrangePrimary,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.titleMedium
                        )
                    }
                }
            }
        }
        
        // ==================== Order Timeline ====================
        if (timeline.isNotEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Order Timeline",
                            style = MaterialTheme.typography.titleMedium,
                            color = WhiteText,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        timeline.forEachIndexed { index, entry ->
                            TimelineItem(
                                entry = entry,
                                isLast = index == timeline.lastIndex
                            )
                        }
                    }
                }
            }
        }
        
        // ==================== Return Request (For Delivered Orders) ====================
        val canRequestReturn = order.status.lowercase() == "delivered" &&
            order.shop?.returnsEnabled == true &&
            order.returnRequested != true

        if (canRequestReturn) {
             item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Return Request",
                            style = MaterialTheme.typography.titleMedium,
                            color = WhiteText,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        
                        Text(
                            text = "Reason for Return",
                            style = MaterialTheme.typography.labelMedium,
                            color = WhiteText,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        
                        OutlinedTextField(
                            value = "",
                            onValueChange = {},
                            enabled = false, 
                            placeholder = { Text("Please explain why you want to return this order...") },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(100.dp)
                                .clickable { onShowReturnDialog() }, // Click to open dialog
                            colors = OutlinedTextFieldDefaults.colors(
                                disabledTextColor = WhiteTextMuted,
                                disabledBorderColor = WhiteTextMuted,
                                disabledPlaceholderColor = WhiteTextMuted,
                                disabledContainerColor = Color.Transparent
                            )
                        )
                         
                        Spacer(modifier = Modifier.height(16.dp))
                         
                        Button(
                            onClick = onShowReturnDialog,
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                             Text("Submit Return Request", color = WhiteText)
                        }
                    }
                }
            }
        }
        
        // Bottom spacing
        item { Spacer(modifier = Modifier.height(24.dp)) }
    }
}

// ... helper composables like ContactRow, TimelineItem, OrderItemCard stay same ...

@Composable
private fun ReturnRequestDialog(
    onDismiss: () -> Unit,
    onSubmit: (String, String?) -> Unit
) {
    var reason by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    
    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = SlateCard)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Return Request",
                    style = MaterialTheme.typography.titleMedium,
                    color = WhiteText,
                    fontWeight = FontWeight.Bold
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                // Reason Input
                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    label = { Text("Reason for Return") },
                    modifier = Modifier.fillMaxWidth(),
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
                
                Spacer(modifier = Modifier.height(12.dp))
                
                // Comments Input
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Additional Details (Optional)") },
                    modifier = Modifier.fillMaxWidth().height(100.dp),
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
                
                Spacer(modifier = Modifier.height(24.dp))
                
                // Action Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancel", color = WhiteTextMuted)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { 
                            if (reason.isNotBlank()) {
                                onSubmit(reason, description.takeIf { it.isNotBlank() })
                            }
                        },
                        enabled = reason.isNotBlank(),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = OrangePrimary,
                            disabledContainerColor = OrangePrimary.copy(alpha = 0.5f)
                        )
                    ) {
                        Text("Submit Request")
                    }
                }
            }
        }
    }
}

@Composable
private fun ContactRow(
    label: String,
    value: String,
    icon: ImageVector
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Top
    ) {
        Text(
            text = label,
            color = WhiteTextMuted,
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.width(80.dp)
        )
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = WhiteTextMuted,
            modifier = Modifier.size(16.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = value,
            color = WhiteText,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun TimelineItem(
    entry: OrderTimelineEntry,
    isLast: Boolean
) {
    val statusLabel = when (entry.status.lowercase()) {
        "pending" -> "Sent to Shop"
        "awaiting_customer_agreement" -> "Awaiting your approval"
        "confirmed" -> "Confirmed"
        "processing" -> "Processing"
        "packed" -> "Packed"
        "dispatched" -> "Dispatched"
        "shipped" -> "Shipped"
        "delivered" -> "Delivered"
        "cancelled" -> "Cancelled"
        else -> entry.status.replaceFirstChar { it.uppercase() }
    }
    
    val statusColor = when (entry.status.lowercase()) {
        "delivered" -> SuccessGreen
        "confirmed", "processing", "packed", "dispatched", "shipped" -> ProviderBlue
        "cancelled" -> ErrorRed
        "awaiting_customer_agreement" -> WarningYellow
        else -> OrangePrimary
    }
    
    val formattedTime = try {
        // Handle various ISO formats and convert to IST
        val cleanTimestamp = entry.timestamp.substringBefore("[").trim()
        val instant = java.time.Instant.parse(
            if (cleanTimestamp.endsWith("Z")) cleanTimestamp else "${cleanTimestamp}Z"
        )
        val istZone = java.time.ZoneId.of("Asia/Kolkata")
        val localDateTime = instant.atZone(istZone).toLocalDateTime()
        val outputFormatter = DateTimeFormatter.ofPattern("dd MMMM yyyy, hh:mm a")
        localDateTime.format(outputFormatter)
    } catch (e: Exception) {
        // If all parsing fails, try primitive string cleanup or return access
        entry.timestamp.replace("T", " ").substringBefore(".")
    }
    
    Row(
        modifier = Modifier.fillMaxWidth()
    ) {
        // Timeline indicator
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.width(24.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(12.dp)
                    .background(statusColor, CircleShape)
            )
            if (!isLast) {
                Box(
                    modifier = Modifier
                        .width(2.dp)
                        .height(48.dp)
                        .background(GlassWhite)
                )
            }
        }
        
        Spacer(modifier = Modifier.width(12.dp))
        
        // Content
        Column(
            modifier = Modifier.padding(bottom = if (isLast) 0.dp else 16.dp)
        ) {
            Text(
                text = statusLabel,
                color = WhiteText,
                fontWeight = FontWeight.Medium,
                style = MaterialTheme.typography.bodyMedium
            )
            entry.trackingInfo?.let { info ->
                Text(
                    text = info,
                    color = WhiteTextMuted,
                    style = MaterialTheme.typography.bodySmall
                )
            }
            Text(
                text = formattedTime,
                color = WhiteTextMuted,
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}

@Composable
private fun OrderItemCard(
    item: OrderItem,
    showReview: Boolean,
    onLeaveReview: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SlateBackground)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Product Image
            Box(
                modifier = Modifier
                    .size(60.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(GlassWhite),
                contentAlignment = Alignment.Center
            ) {
                val images = item.product?.images
                if (!images.isNullOrEmpty()) {
                    AsyncImage(
                        model = images.first(),
                        contentDescription = item.product?.name,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.ShoppingBag,
                        contentDescription = null,
                        tint = WhiteTextMuted,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
            
            Spacer(modifier = Modifier.width(12.dp))
            
            // Product Info
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.product?.name ?: "Product #${item.productId}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = WhiteText,
                    fontWeight = FontWeight.Medium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "₹${item.price} × ${item.quantity}",
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted
                )
            }
            
            // Leave Review or Total
            if (showReview && item.productId != null) {
                OutlinedButton(
                    onClick = onLeaveReview,
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = OrangePrimary
                    )
                ) {
                    Text("Leave Review", style = MaterialTheme.typography.labelSmall)
                }
            } else {
                Text(
                    text = "₹${item.total}",
                    color = OrangePrimary,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun OrderPaymentMethodOption(
    label: String,
    isSelected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = enabled, onClick = onClick),
        verticalAlignment = Alignment.CenterVertically
    ) {
        RadioButton(
            selected = isSelected,
            onClick = onClick,
            enabled = enabled,
            colors = RadioButtonDefaults.colors(
                selectedColor = OrangePrimary,
                unselectedColor = WhiteTextMuted
            )
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = if (enabled) WhiteText else WhiteTextMuted
        )
    }
}

@Composable
private fun ProductReviewDialog(
    productName: String,
    onDismiss: () -> Unit,
    onSubmit: (Int, String) -> Unit
) {
    var rating by remember { mutableIntStateOf(5) }
    var reviewText by remember { mutableStateOf("") }
    
    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = SlateCard)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Review $productName",
                    style = MaterialTheme.typography.titleMedium,
                    color = WhiteText,
                    fontWeight = FontWeight.Bold
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                // Star Rating
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    (1..5).forEach { star ->
                        IconButton(
                            onClick = { rating = star },
                            modifier = Modifier.size(40.dp)
                        ) {
                            Icon(
                                imageVector = if (star <= rating) Icons.Default.Star else Icons.Default.StarBorder,
                                contentDescription = "Star $star",
                                tint = if (star <= rating) AmberSecondary else WhiteTextMuted,
                                modifier = Modifier.size(32.dp)
                            )
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                // Review Text
                OutlinedTextField(
                    value = reviewText,
                    onValueChange = { reviewText = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp),
                    placeholder = { Text("Write your review...", color = WhiteTextMuted) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = WhiteText,
                        unfocusedTextColor = WhiteText,
                        focusedBorderColor = OrangePrimary,
                        unfocusedBorderColor = GlassBorder,
                        cursorColor = OrangePrimary
                    ),
                    shape = RoundedCornerShape(8.dp)
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                // Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Cancel")
                    }
                    Button(
                        onClick = { onSubmit(rating, reviewText) },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary)
                    ) {
                        Text("Submit")
                    }
                }
            }
        }
    }
}
