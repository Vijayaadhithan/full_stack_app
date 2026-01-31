package com.doorstep.tn.shop.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.shop.data.model.ActiveBoardOrder
import com.doorstep.tn.shop.data.model.ShopOrder

/**
 * Order Detail Screen - Displays detailed order information with status management
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShopOrderDetailScreen(
    viewModel: ShopViewModel = hiltViewModel(),
    orderId: Int,
    onNavigateBack: () -> Unit
) {
    val activeBoard by viewModel.activeBoard.collectAsState()
    val orders by viewModel.orders.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()
    
    var showStatusDialog by remember { mutableStateOf(false) }
    var quoteTotal by remember { mutableStateOf("") }
    

    
    val snackbarHostState = remember { SnackbarHostState() }
    
    // Find the order in either activeBoard or orders list
    val boardOrder = remember(activeBoard, orderId) {
        activeBoard?.let { board ->
            board.newOrders.find { it.id == orderId }
                ?: board.packingOrders.find { it.id == orderId }
                ?: board.readyOrders.find { it.id == orderId }
        }
    }
    
    val fullOrder = remember(orders, orderId) {
        orders.find { it.id == orderId }
    }

    // Initialize quoteTotal if order has total
    LaunchedEffect(boardOrder, fullOrder) {
        val currentTotal = boardOrder?.total?.toString() ?: fullOrder?.total
        if (!currentTotal.isNullOrBlank()) {
            quoteTotal = currentTotal.replace("₹", "")
        }
    }
    
    LaunchedEffect(orderId) {
        if (activeBoard == null) {
            viewModel.loadActiveOrdersBoard()
        }
        if (orders.isEmpty()) {
            viewModel.loadOrders()
        }
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
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Order #$orderId",
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
                    IconButton(onClick = { 
                        viewModel.loadActiveOrdersBoard()
                        viewModel.loadOrders()
                    }) {
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
        containerColor = SlateDarker,
        floatingActionButton = {
            val statusForFab = boardOrder?.status ?: fullOrder?.status
            if (statusForFab != null &&
                statusForFab != "delivered" &&
                statusForFab != "returned" &&
                statusForFab != "cancelled"
            ) {
                ExtendedFloatingActionButton(
                    onClick = { showStatusDialog = true },
                    containerColor = ShopGreen,
                    contentColor = WhiteText,
                    icon = { Icon(Icons.Default.Update, contentDescription = null) },
                    text = { Text("Update Status") }
                )
            }
        }
    ) { paddingValues ->
        if (isLoading && boardOrder == null && fullOrder == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = ShopGreen)
            }
        } else if (boardOrder == null && fullOrder == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Default.ShoppingCart,
                        contentDescription = null,
                        tint = WhiteTextMuted,
                        modifier = Modifier.size(64.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Order not found",
                        color = WhiteTextMuted
                    )
                }
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Order Status Card
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Status",
                                style = MaterialTheme.typography.titleMedium,
                                color = WhiteText,
                                fontWeight = FontWeight.Bold
                            )
                            StatusBadge(status = boardOrder?.status ?: fullOrder?.status ?: "unknown")
                        }
                        
                        Spacer(modifier = Modifier.height(12.dp))
                        
                        // Status Timeline
                        StatusTimeline(
                            currentStatus = boardOrder?.status ?: fullOrder?.status ?: "pending"
                        )
                    }
                }
                
                // ─── Actions Section ─────────────────────────────────────────
                
                val statusStr = boardOrder?.status ?: fullOrder?.status
                
                if (statusStr != null) {
                    val status = statusStr.lowercase()
                    val paymentMethod = fullOrder?.paymentMethod?.lowercase() 
                    val rawPaymentStatus =
                        (fullOrder?.paymentStatus ?: boardOrder?.paymentStatus)?.lowercase()

                    // 1. Send/Update Bill (for Pending/Awaiting Agreement)
                    if (status == "pending" || status == "awaiting_customer_agreement") {
                         Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = SlateCard)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = if(status == "awaiting_customer_agreement") "Update Bill" else "Send Bill",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = WhiteText,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                
                                OutlinedTextField(
                                    value = quoteTotal,
                                    onValueChange = { quoteTotal = it },
                                    label = { Text("Total Amount (₹)") },
                                    modifier = Modifier.fillMaxWidth(),
                                    keyboardOptions = KeyboardOptions(
                                        keyboardType = KeyboardType.Number,
                                        imeAction = ImeAction.Done
                                    ),
                                    singleLine = true,
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedTextColor = WhiteText,
                                        unfocusedTextColor = WhiteText,
                                        focusedBorderColor = ShopGreen,
                                        unfocusedBorderColor = WhiteTextMuted,
                                        focusedLabelColor = ShopGreen,
                                        unfocusedLabelColor = WhiteTextMuted
                                    )
                                )
                                
                                Spacer(modifier = Modifier.height(12.dp))
                                
                                Button(
                                    onClick = { 
                                        viewModel.quoteTextOrder(orderId, quoteTotal)
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = ShopGreen),
                                    enabled = quoteTotal.isNotBlank() && !isLoading
                                ) {
                                    Text(if(status == "awaiting_customer_agreement") "Update Bill" else "Send Bill")
                                }
                                
                                if (status == "awaiting_customer_agreement") {
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = "Waiting for customer to accept the bill.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = WarningYellow
                                    )
                                }
                            }
                        }
                    }

                    // 2. Payment Actions (for Confirmed orders)
                    if (status == "confirmed") {
                         // Pay Later Approval
                         if (paymentMethod == "pay_later" && rawPaymentStatus == "pending") {
                             Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = ProviderBlue.copy(alpha = 0.2f)) // Blue tint
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text(
                                        text = "Pay Later (Khata)",
                                        style = MaterialTheme.typography.titleMedium,
                                        color = ProviderBlue,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "Approve credit for this order.",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = WhiteText
                                    )
                                    Spacer(modifier = Modifier.height(12.dp))
                                    Button(
                                        onClick = { viewModel.approvePayLater(orderId) },
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = ButtonDefaults.buttonColors(containerColor = ProviderBlue),
                                        enabled = !isLoading
                                    ) {
                                        Text("Approve Credit")
                                    }
                                }
                            }
                         }
                         
                         // Confirm Payment
                         if (rawPaymentStatus == "verifying" ||
                             (paymentMethod == "cash" && rawPaymentStatus == "pending")
                         ) {
                              Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = WarningYellow.copy(alpha = 0.2f)) // Yellow tint
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text(
                                        text = "Payment Action",
                                        style = MaterialTheme.typography.titleMedium,
                                        color = WarningYellow,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = if (paymentMethod == "cash") "Confirm cash receipt." else "Verify payment.",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = WhiteText
                                    )
                                    Spacer(modifier = Modifier.height(12.dp))
                                    Button(
                                        onClick = { viewModel.confirmPayment(orderId) },
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = ButtonDefaults.buttonColors(containerColor = WarningYellow),
                                         enabled = !isLoading
                                    ) {
                                        Text("Confirm Payment", color = SlateDarker)
                                    }
                                }
                            }
                         }
                    }
                }

                // Customer Info
                val customerName = boardOrder?.customerName ?: fullOrder?.customerName ?: "Unknown"
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Person,
                                contentDescription = null,
                                tint = ShopGreen
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Customer",
                                style = MaterialTheme.typography.titleMedium,
                                color = WhiteText,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        
                        Spacer(modifier = Modifier.height(12.dp))
                        
                        Text(
                            text = customerName,
                            style = MaterialTheme.typography.bodyLarge,
                            color = WhiteText
                        )
                        
                        fullOrder?.customer?.phone?.let { phone ->
                            Text(
                                text = phone,
                                style = MaterialTheme.typography.bodyMedium,
                                color = WhiteTextMuted
                            )
                        }
                        
                        fullOrder?.shippingAddress?.let { address ->
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Delivery: $address",
                                style = MaterialTheme.typography.bodySmall,
                                color = WhiteTextMuted
                            )
                        }
                    }
                }
                
                // Order Items
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.ShoppingBag,
                                contentDescription = null,
                                tint = ShopGreen
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Order Items",
                                style = MaterialTheme.typography.titleMedium,
                                color = WhiteText,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        
                        Spacer(modifier = Modifier.height(12.dp))
                        
                        // Prefer fullOrder items if available (has price info)
                        val boardItems = boardOrder?.items ?: emptyList()
                        val fullItems = fullOrder?.items ?: emptyList()
                        
                        when {
                            fullItems.isNotEmpty() -> {
                                fullItems.forEachIndexed { index, item ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 8.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                text = item.name,
                                                style = MaterialTheme.typography.bodyMedium,
                                                color = WhiteText
                                            )
                                            Text(
                                                text = "Qty: ${item.quantity}",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = WhiteTextMuted
                                            )
                                        }
                                        val itemTotal = item.total?.toDoubleOrNull() ?: 0.0
                                        Text(
                                            text = "₹%.2f".format(itemTotal),
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = ShopGreen,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                    if (index < fullItems.lastIndex) {
                                        HorizontalDivider(color = GlassWhite)
                                    }
                                }
                            }
                            boardItems.isNotEmpty() -> {
                                boardItems.forEachIndexed { index, item ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 8.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                text = item.name,
                                                style = MaterialTheme.typography.bodyMedium,
                                                color = WhiteText
                                            )
                                            Text(
                                                text = "Qty: ${item.quantity}",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = WhiteTextMuted
                                            )
                                        }
                                    }
                                    if (index < boardItems.lastIndex) {
                                        HorizontalDivider(color = GlassWhite)
                                    }
                                }
                            }
                            else -> {
                                val orderText = fullOrder?.orderText
                                if (!orderText.isNullOrBlank()) {
                                    Text(
                                        text = "Order Notes: $orderText",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = WhiteText
                                    )
                                } else {
                                    Text(
                                        text = "No items to display",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = WhiteTextMuted
                                    )
                                }
                            }
                        }
                    }
                }
                
                // Payment & Total
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Payment,
                                contentDescription = null,
                                tint = ShopGreen
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Payment Details",
                                style = MaterialTheme.typography.titleMedium,
                                color = WhiteText,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        
                        Spacer(modifier = Modifier.height(12.dp))
                        
                        // Payment Status
                        val paymentStatus =
                            fullOrder?.displayPaymentStatus
                                ?: boardOrder?.paymentStatus
                                ?: "pending"
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Payment Status", color = WhiteTextMuted)
                            PaymentStatusBadge(status = paymentStatus)
                        }
                        
                        Spacer(modifier = Modifier.height(8.dp))
                        
                        // Payment Method
                        val paymentMethod = fullOrder?.paymentMethod ?: "N/A"
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Method", color = WhiteTextMuted)
                            Text(paymentMethod.uppercase(), color = WhiteText)
                        }
                        
                        Spacer(modifier = Modifier.height(8.dp))

                        fullOrder?.paymentReference?.let { reference ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Reference", color = WhiteTextMuted)
                                Text(reference, color = WhiteText)
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                        
                        // Delivery Method
                        val deliveryMethod = boardOrder?.deliveryMethod ?: fullOrder?.deliveryMethod ?: "N/A"
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Delivery", color = WhiteTextMuted)
                            Text(deliveryMethod.replaceFirstChar { it.uppercase() }, color = WhiteText)
                        }
                        
                        HorizontalDivider(
                            modifier = Modifier.padding(vertical = 12.dp),
                            color = GlassWhite
                        )
                        
                        // Total
                        val totalAmount = boardOrder?.displayTotal ?: fullOrder?.displayTotal ?: "₹0.00"
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Total",
                                style = MaterialTheme.typography.titleMedium,
                                color = WhiteText,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = totalAmount,
                                style = MaterialTheme.typography.titleLarge,
                                color = ShopGreen,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
                
                // Spacer for FAB
                Spacer(modifier = Modifier.height(80.dp))
            }
        }
    }
    
    // Status Update Dialog
    if (showStatusDialog) {
        val currentStatus = boardOrder?.status ?: fullOrder?.status ?: "pending"
        UpdateStatusDialog(
            currentStatus = currentStatus,
            onDismiss = { showStatusDialog = false },
            onUpdate = { newStatus, comments, trackingInfo ->
                viewModel.updateOrderStatus(orderId, newStatus, comments, trackingInfo) {
                    showStatusDialog = false
                }
            }
        )
    }
}

@Composable
private fun StatusBadge(status: String) {
    val (color, text) = when (status.lowercase()) {
        "new", "pending" -> Pair(OrangePrimary, "Pending")
        "awaiting_customer_agreement" -> Pair(WarningYellow, "Awaiting Agreement")
        "confirmed", "processing", "packing" -> Pair(ProviderBlue, "Processing")
        "packed" -> Pair(WarningYellow, "Packed")
        "ready" -> Pair(WarningYellow, "Ready")
        "dispatched", "shipped" -> Pair(ProviderBlue, "Dispatched")
        "delivered" -> Pair(ShopGreen, "Delivered")
        "returned" -> Pair(ErrorRed, "Returned")
        "cancelled" -> Pair(ErrorRed, "Cancelled")
        else -> Pair(WhiteTextMuted, status.replaceFirstChar { it.uppercase() })
    }
    
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = color.copy(alpha = 0.2f)
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelMedium,
            color = color,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun PaymentStatusBadge(status: String) {
    val (color, text) = when (status.lowercase()) {
        "paid" -> Pair(ShopGreen, "Paid")
        "pending" -> Pair(OrangePrimary, "Pending")
        "verifying" -> Pair(WarningYellow, "Verifying")
        "failed" -> Pair(ErrorRed, "Failed")
        "refunded" -> Pair(WarningYellow, "Refunded")
        else -> Pair(WhiteTextMuted, status.replaceFirstChar { it.uppercase() })
    }
    
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = color.copy(alpha = 0.2f)
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
            style = MaterialTheme.typography.labelSmall,
            color = color
        )
    }
}

@Composable
private fun StatusTimeline(currentStatus: String) {
    val steps = listOf(
        "New" to listOf("new", "pending", "awaiting_customer_agreement"),
        "Packing" to listOf("confirmed", "processing", "packing", "packed"),
        "Ready" to listOf("ready"),
        "Dispatched" to listOf("dispatched", "shipped"),
        "Delivered" to listOf("delivered", "returned")
    )
    val normalized = currentStatus.lowercase()
    val currentIndex = steps.indexOfFirst { (_, statuses) -> statuses.contains(normalized) }
    
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        steps.forEachIndexed { index, (label, _) ->
            val isActive = index <= currentIndex
            val isCompleted = index < currentIndex
            
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.weight(1f)
            ) {
                Box(
                    modifier = Modifier
                        .size(24.dp)
                        .clip(CircleShape)
                        .background(
                            when {
                                isCompleted -> ShopGreen
                                isActive -> OrangePrimary
                                else -> SlateBackground
                            }
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    if (isCompleted) {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = null,
                            tint = WhiteText,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelSmall,
                    color = if (isActive) WhiteText else WhiteTextMuted
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun UpdateStatusDialog(
    currentStatus: String,
    onDismiss: () -> Unit,
    onUpdate: (String, String?, String?) -> Unit
) {
    var selectedStatus by remember { mutableStateOf(currentStatus) }
    var comments by remember { mutableStateOf("") }
    var trackingInfo by remember { mutableStateOf("") }
    val statuses = listOf(
        "pending",
        "awaiting_customer_agreement",
        "confirmed",
        "processing",
        "packed",
        "dispatched",
        "shipped",
        "delivered",
        "cancelled"
    )
    
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Update Order Status") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = "Current: ${currentStatus.replaceFirstChar { it.uppercase() }}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = WhiteTextMuted
                )
                statuses.forEach { status ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = selectedStatus == status,
                            onClick = { selectedStatus = status }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = status.replaceFirstChar { it.uppercase() },
                            color = if (status == "cancelled") ErrorRed else WhiteText
                        )
                    }
                }
                OutlinedTextField(
                    value = comments,
                    onValueChange = { comments = it },
                    label = { Text("Comments (optional)") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = trackingInfo,
                    onValueChange = { trackingInfo = it },
                    label = { Text("Tracking Info (optional)") },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onUpdate(selectedStatus, comments.ifBlank { null }, trackingInfo.ifBlank { null }) },
                enabled = selectedStatus != currentStatus
            ) {
                Text("Update")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
