package com.doorstep.tn.customer.ui.orders

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.customer.data.model.Order
import com.doorstep.tn.customer.ui.CustomerViewModel
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Orders List Screen - Redesigned with mobile-first approach
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
    
    var selectedStatus by remember { mutableStateOf("all") }
    
    // Status options with icons and colors
    val statusOptions = listOf(
        StatusOption("all", "All", Icons.Default.ViewList, OrangePrimary),
        StatusOption("pending", "Pending", Icons.Default.Schedule, WarningYellow),
        StatusOption("confirmed", "Confirmed", Icons.Default.CheckCircle, SuccessGreen),
        StatusOption("processing", "Processing", Icons.Default.Settings, ProviderBlue),
        StatusOption("shipped", "Shipped", Icons.Default.LocalShipping, ProviderBlue),
        StatusOption("delivered", "Delivered", Icons.Default.Done, SuccessGreen),
        StatusOption("cancelled", "Cancelled", Icons.Default.Cancel, ErrorRed)
    )
    
    LaunchedEffect(selectedStatus) {
        viewModel.loadOrders(status = if (selectedStatus == "all") null else selectedStatus)
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("My Orders", color = WhiteText, fontWeight = FontWeight.Bold) },
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
            // ==================== Horizontal Status Chips ====================
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                statusOptions.forEach { option ->
                    StatusChip(
                        option = option,
                        isSelected = selectedStatus == option.value,
                        onClick = { selectedStatus = option.value }
                    )
                }
            }
            
            // ==================== Orders List ====================
            if (isLoading && orders.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = OrangePrimary)
                }
            } else if (orders.isEmpty()) {
                EmptyOrdersState(onBrowseShops = onNavigateToShops)
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(orders) { order ->
                        OrderCard(
                            order = order,
                            onClick = { onNavigateToOrder(order.id) }
                        )
                    }
                }
            }
        }
    }
}

private data class StatusOption(
    val value: String,
    val label: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val color: Color
)

@Composable
private fun StatusChip(
    option: StatusOption,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(20.dp),
        color = if (isSelected) option.color else SlateCard
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = option.icon,
                contentDescription = null,
                tint = if (isSelected) WhiteText else WhiteTextMuted,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = option.label,
                style = MaterialTheme.typography.labelMedium,
                color = if (isSelected) WhiteText else WhiteTextMuted,
                fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal
            )
        }
    }
}

@Composable
private fun EmptyOrdersState(onBrowseShops: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(100.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        brush = Brush.linearGradient(
                            colors = listOf(OrangePrimary.copy(alpha = 0.1f), AmberSecondary.copy(alpha = 0.1f))
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.ShoppingBag,
                    contentDescription = null,
                    tint = OrangePrimary,
                    modifier = Modifier.size(48.dp)
                )
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            Text(
                text = "No orders yet",
                style = MaterialTheme.typography.titleLarge,
                color = WhiteText,
                fontWeight = FontWeight.Bold
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = "Your order history will appear here",
                style = MaterialTheme.typography.bodyMedium,
                color = WhiteTextMuted
            )
            
            Spacer(modifier = Modifier.height(24.dp))
            
            Button(
                onClick = onBrowseShops,
                colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary),
                shape = RoundedCornerShape(12.dp),
                contentPadding = PaddingValues(horizontal = 32.dp, vertical = 12.dp)
            ) {
                Icon(Icons.Default.Store, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Browse Shops", fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun OrderCard(
    order: Order,
    onClick: () -> Unit
) {
    // Format date
    val formattedDate = order.orderDate?.let {
        try {
            val inputFormatter = DateTimeFormatter.ISO_DATE_TIME
            val outputFormatter = DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a")
            LocalDateTime.parse(it.substringBefore("["), inputFormatter).format(outputFormatter)
        } catch (e: Exception) { it }
    } ?: "Recently"
    
    // Status color and label
    val (statusColor, statusLabel) = when (order.status) {
        "pending" -> WarningYellow to "Pending"
        "confirmed" -> SuccessGreen to "Confirmed"
        "processing" -> ProviderBlue to "Processing"
        "packed" -> ProviderBlue to "Packed"
        "shipped", "dispatched" -> ProviderBlue to "Shipped"
        "delivered" -> SuccessGreen to "Delivered"
        "cancelled" -> ErrorRed to "Cancelled"
        "returned" -> ErrorRed to "Returned"
        else -> WhiteTextMuted to (order.status ?: "Unknown")
    }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Row 1: Order # and Status badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(OrangePrimary.copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Inventory2,
                            contentDescription = null,
                            tint = OrangePrimary,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = "Order #${order.id}",
                            style = MaterialTheme.typography.titleMedium,
                            color = WhiteText,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = formattedDate,
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteTextMuted
                        )
                    }
                }
                
                // Status Badge
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = statusColor.copy(alpha = 0.15f)
                ) {
                    Text(
                        text = statusLabel,
                        style = MaterialTheme.typography.labelMedium,
                        color = statusColor,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // Row 2: Items preview and Price
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Items count
                val itemCount = order.items?.size ?: 0
                Text(
                    text = if (itemCount > 0) "$itemCount item${if (itemCount > 1) "s" else ""}" else "Items",
                    style = MaterialTheme.typography.bodyMedium,
                    color = WhiteTextMuted
                )
                
                // Total price
                Text(
                    text = "₹${order.total}",
                    style = MaterialTheme.typography.titleMedium,
                    color = OrangePrimary,
                    fontWeight = FontWeight.Bold
                )
            }
            
            // Row 3: Pickup/Delivery info (if available)
            if (order.deliveryMethod == "pickup" && order.shop != null) {
                order.shop.address?.let { address ->
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(SlateBackground.copy(alpha = 0.5f))
                            .padding(10.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.LocationOn,
                            contentDescription = null,
                            tint = OrangePrimary,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Pickup: $address",
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteTextMuted,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }
    }
}
