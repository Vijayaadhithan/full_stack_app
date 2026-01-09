package com.doorstep.tn.customer.ui.orders

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.customer.data.model.Order
import com.doorstep.tn.customer.ui.CustomerViewModel
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Orders List Screen - Matches web app's /customer/orders page exactly
 * 
 * Features (from web orders.tsx):
 * 1. Status filter sidebar (All, Sent to Shop, Awaiting approval, Confirmed, etc.)
 * 2. Order cards with: Package icon, Order #, Order ID, Date, Status, Total
 * 3. Pickup address with (View on Map) link for pickup orders
 * 4. View Details button navigating to order detail
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrdersListScreen(
    viewModel: CustomerViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToOrder: (Int) -> Unit,
    onNavigateToShops: () -> Unit
) {
    val orders by viewModel.orders.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    
    // Status filter - matches web exactly
    var selectedStatus by remember { mutableStateOf("all") }
    
    // Status options matching web orderStatusOptions
    val statusOptions = listOf(
        "all" to "All",
        "pending" to "Sent to Shop",
        "awaiting_customer_agreement" to "Awaiting your approval",
        "confirmed" to "Confirmed",
        "processing" to "Processing",
        "packed" to "Packed",
        "dispatched" to "Dispatched",
        "shipped" to "Shipped",
        "delivered" to "Delivered",
        "cancelled" to "Cancelled",
        "returned" to "Returned"
    )
    
    // Status labels matching web orderStatusLabels
    val statusLabels = mapOf(
        "pending" to "Sent to Shop",
        "awaiting_customer_agreement" to "Awaiting your approval",
        "cancelled" to "Cancelled",
        "confirmed" to "Confirmed",
        "processing" to "Processing",
        "packed" to "Packed",
        "dispatched" to "Dispatched",
        "shipped" to "Shipped",
        "delivered" to "Delivered",
        "returned" to "Returned"
    )
    
    LaunchedEffect(selectedStatus) {
        viewModel.loadOrders(status = if (selectedStatus == "all") null else selectedStatus)
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("My Orders", color = WhiteText) },
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
        if (isLoading && orders.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize().padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = OrangePrimary)
            }
        } else {
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                // ==================== Status Sidebar ====================
                // Scrollable status filter matching web sidebar
                LazyColumn(
                    modifier = Modifier
                        .width(140.dp)
                        .fillMaxHeight()
                        .background(SlateCard)
                        .padding(8.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    item {
                        Text(
                            text = "STATUS",
                            style = MaterialTheme.typography.labelSmall,
                            color = WhiteTextMuted,
                            modifier = Modifier.padding(8.dp)
                        )
                    }
                    items(statusOptions) { (value, label) ->
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedStatus = value },
                            shape = RoundedCornerShape(8.dp),
                            color = if (selectedStatus == value) OrangePrimary.copy(alpha = 0.15f) else androidx.compose.ui.graphics.Color.Transparent
                        ) {
                            Text(
                                text = label,
                                style = MaterialTheme.typography.bodySmall,
                                color = if (selectedStatus == value) OrangePrimary else WhiteText,
                                fontWeight = if (selectedStatus == value) FontWeight.Medium else FontWeight.Normal,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)
                            )
                        }
                    }
                }
                
                // ==================== Orders List ====================
                if (orders.isEmpty()) {
                    // Empty state
                    Box(
                        modifier = Modifier.weight(1f).fillMaxHeight(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Default.Receipt,
                                contentDescription = null,
                                tint = WhiteTextMuted,
                                modifier = Modifier.size(64.dp)
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "No orders yet",
                                style = MaterialTheme.typography.titleLarge,
                                color = WhiteText
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Start shopping to see your orders here",
                                style = MaterialTheme.typography.bodyMedium,
                                color = WhiteTextMuted
                            )
                            Spacer(modifier = Modifier.height(24.dp))
                            Button(
                                onClick = onNavigateToShops,
                                colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text("Browse Shops")
                            }
                        }
                    }
                } else {
                    // Order cards list
                    LazyColumn(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(orders) { order ->
                            OrderCard(
                                order = order,
                                statusLabel = statusLabels[order.status] ?: order.status,
                                onViewDetails = { onNavigateToOrder(order.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun OrderCard(
    order: Order,
    statusLabel: String,
    onViewDetails: () -> Unit
) {
    // Format date like web: "07 January 2026, 10:40 AM"
    val formattedDate = order.orderDate?.let {
        try {
            val inputFormatter = DateTimeFormatter.ISO_DATE_TIME
            val outputFormatter = DateTimeFormatter.ofPattern("dd MMMM yyyy, hh:mm a")
            LocalDateTime.parse(it.substringBefore("["), inputFormatter).format(outputFormatter)
        } catch (e: Exception) {
            it
        }
    } ?: "Recently"
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onViewDetails() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header row: Order # with icon, Price + Status
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                // Left side: Order # and details
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Inventory2,
                            contentDescription = null,
                            tint = OrangePrimary,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Order #${order.id}",
                            style = MaterialTheme.typography.titleMedium,
                            color = WhiteText,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(4.dp))
                    
                    Text(
                        text = "Order ID: ${order.id} • Date: $formattedDate",
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                }
                
                // Right side: Price, Status, View Details
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "₹${order.total}",
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    
                    Text(
                        text = statusLabel,
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    // View Details button - matches web
                    OutlinedButton(
                        onClick = onViewDetails,
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = WhiteText)
                    ) {
                        Text("View Details", style = MaterialTheme.typography.labelSmall)
                        Spacer(modifier = Modifier.width(4.dp))
                        Icon(
                            imageVector = Icons.Default.OpenInNew,
                            contentDescription = null,
                            modifier = Modifier.size(12.dp)
                        )
                    }
                }
            }
            
            // Pickup address (if pickup order and shop has address)
            if (order.deliveryMethod == "pickup" && order.shop != null) {
                val address = order.shop.address
                if (address != null) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Pickup: $address",
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteTextMuted,
                            modifier = Modifier.weight(1f)
                        )
                        // Map link - matches web (View on Map)
                        if (order.shop.latitude != null && order.shop.longitude != null) {
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "(View on Map)",
                                style = MaterialTheme.typography.bodySmall,
                                color = OrangePrimary,
                                modifier = Modifier.clickable {
                                    // TODO: Open map with coordinates
                                }
                            )
                            Icon(
                                imageVector = Icons.Default.LocationOn,
                                contentDescription = null,
                                tint = OrangePrimary,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}
