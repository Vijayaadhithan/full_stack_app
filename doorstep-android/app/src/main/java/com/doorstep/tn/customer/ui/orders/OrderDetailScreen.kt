package com.doorstep.tn.customer.ui.orders

import android.content.Intent
import android.net.Uri
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.doorstep.tn.common.theme.*
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
 * 2. Shop/Customer contact info
 * 3. Order items list with product details
 * 4. Order summary (subtotal, total)
 * 5. Map link for pickup orders
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderDetailScreen(
    orderId: Int,
    viewModel: CustomerViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    val selectedOrder by viewModel.selectedOrder.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    
    // Load order details on first composition
    LaunchedEffect(orderId) {
        viewModel.loadOrderDetails(orderId)
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
                paddingValues = paddingValues,
                onOpenMap = { lat, lng ->
                    val gmmIntentUri = Uri.parse("geo:$lat,$lng?q=$lat,$lng")
                    val mapIntent = Intent(Intent.ACTION_VIEW, gmmIntentUri)
                    mapIntent.setPackage("com.google.android.apps.maps")
                    context.startActivity(mapIntent)
                }
            )
        }
    }
}

@Composable
private fun OrderDetailContent(
    order: Order,
    paddingValues: PaddingValues,
    onOpenMap: (Double, Double) -> Unit
) {
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
    
    // Format date
    val formattedDate = order.orderDate?.let {
        try {
            val inputFormatter = DateTimeFormatter.ISO_DATE_TIME
            val outputFormatter = DateTimeFormatter.ofPattern("dd MMMM yyyy, hh:mm a")
            LocalDateTime.parse(it.substringBefore("["), inputFormatter).format(outputFormatter)
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
                            Text(
                                text = when (order.deliveryMethod) {
                                    "pickup" -> "Pickup"
                                    "delivery" -> "Home Delivery"
                                    else -> order.deliveryMethod ?: "Not specified"
                                },
                                color = WhiteText,
                                fontWeight = FontWeight.Medium
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("Payment", color = WhiteTextMuted, style = MaterialTheme.typography.bodySmall)
                            Text(
                                text = when (order.paymentMethod) {
                                    "upi" -> "UPI"
                                    "cash" -> "Cash"
                                    "pay_later" -> "Pay Later"
                                    else -> order.paymentMethod ?: "Not specified"
                                },
                                color = WhiteText,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
        }
        
        // ==================== Shop Contact Info (for pickup) ====================
        if (order.shop != null) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = if (order.deliveryMethod == "pickup") "Shop Contact" else "Shop Info",
                            style = MaterialTheme.typography.titleMedium,
                            color = WhiteText,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        
                        // Shop Name
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Store, null, tint = OrangePrimary, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = order.shop.name ?: "Shop",
                                color = WhiteText,
                                fontWeight = FontWeight.Medium
                            )
                        }
                        
                        // Shop Phone
                        order.shop.phone?.let { phone ->
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Phone, null, tint = WhiteTextMuted, modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(text = phone, color = WhiteTextMuted)
                            }
                        }
                        
                        // Shop Address
                        order.shop.address?.let { address ->
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.LocationOn, null, tint = WhiteTextMuted, modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = address,
                                    color = WhiteTextMuted,
                                    modifier = Modifier.weight(1f)
                                )
                                
                                // Map Link
                                if (order.shop.latitude != null && order.shop.longitude != null) {
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Surface(
                                        modifier = Modifier.clickable { 
                                            onOpenMap(order.shop.latitude, order.shop.longitude) 
                                        },
                                        shape = RoundedCornerShape(8.dp),
                                        color = OrangePrimary.copy(alpha = 0.15f)
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Icon(
                                                Icons.Default.Map, 
                                                null, 
                                                tint = OrangePrimary,
                                                modifier = Modifier.size(16.dp)
                                            )
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text(
                                                "View on Map",
                                                color = OrangePrimary,
                                                style = MaterialTheme.typography.labelSmall
                                            )
                                        }
                                    }
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
                    
                    if (order.items.isNullOrEmpty()) {
                        Text(
                            text = "No items in this order",
                            color = WhiteTextMuted,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }
        }
        
        // Order items list
        order.items?.let { items ->
            items(items) { item ->
                OrderItemCard(item = item)
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
        
        // Bottom spacing
        item { Spacer(modifier = Modifier.height(24.dp)) }
    }
}

@Composable
private fun OrderItemCard(item: OrderItem) {
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
            
            // Item Total
            Text(
                text = "₹${item.total}",
                color = OrangePrimary,
                fontWeight = FontWeight.Bold
            )
        }
    }
}
