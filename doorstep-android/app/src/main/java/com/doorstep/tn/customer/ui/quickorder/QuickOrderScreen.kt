package com.doorstep.tn.customer.ui.quickorder

import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.customer.ui.CustomerViewModel

/**
 * Quick Order Screen - Text-based ordering matching web functionality
 * Allows customers to send a simple text list to a shop
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuickOrderScreen(
    shopId: Int,
    shopName: String,
    viewModel: CustomerViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToOrder: (Int) -> Unit
) {
    val context = LocalContext.current
    val isLoading by viewModel.isLoading.collectAsState()
    val orders by viewModel.orders.collectAsState()
    val userId by viewModel.userId.collectAsState()
    
    var orderText by remember { mutableStateOf("") }
    var deliveryMethod by remember { mutableStateOf("pickup") }
    var shopInfo by remember { mutableStateOf<com.doorstep.tn.customer.data.model.Shop?>(null) }
    
    // Monthly list state (persisted to SharedPreferences)
    var monthlyList by remember { mutableStateOf("") }
    
    // Load monthly list on screen launch
    LaunchedEffect(shopId, userId) {
        monthlyList = loadMonthlyList(context, shopId, userId)
        viewModel.loadOrders()
        viewModel.getShopById(shopId) { shop ->
            shopInfo = shop
        }
    }
    
    val pickupAvailable = shopInfo?.pickupAvailable ?: true
    val deliveryAvailable = shopInfo?.deliveryAvailable ?: false

    LaunchedEffect(pickupAvailable, deliveryAvailable) {
        if (pickupAvailable && !deliveryAvailable) {
            deliveryMethod = "pickup"
        } else if (!pickupAvailable && deliveryAvailable) {
            deliveryMethod = "delivery"
        }
    }

    val frequentItems = remember(orders, shopId) {
        val counts = mutableMapOf<String, Int>()

        fun bump(value: String) {
            val trimmed = value.trim()
            if (trimmed.isEmpty()) return
            counts[trimmed] = (counts[trimmed] ?: 0) + 1
        }

        orders.forEach { order ->
            if (order.shopId != shopId) return@forEach
            if (order.status == "cancelled") return@forEach

            if (order.orderType == "product_order") {
                order.items.orEmpty().forEach { item ->
                    val name = item.product?.name?.trim().orEmpty()
                    if (name.isEmpty()) return@forEach
                    val value = if (item.quantity > 1) "${item.quantity} $name" else name
                    bump(value)
                }
            } else if (order.orderType == "text_order") {
                order.orderText
                    ?.split(Regex("[\\n,]+"))
                    ?.map { it.trim() }
                    ?.filter { it.isNotEmpty() }
                    ?.forEach { bump(it) }
            }
        }

        counts.entries
            .sortedByDescending { it.value }
            .map { it.key }
            .take(12)
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Column {
                        Text("Quick Order", color = WhiteText)
                        Text(
                            text = shopInfo?.displayName ?: shopName,
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteTextMuted
                        )
                    }
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
        ) {
            // Hero Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = SlateCard)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(
                                    Brush.linearGradient(
                                        colors = listOf(OrangePrimary, AmberSecondary)
                                    )
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Store,
                                contentDescription = null,
                                tint = WhiteText,
                                modifier = Modifier.size(28.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(16.dp))
                        Column {
                            Text(
                                text = "Send a simple list",
                                style = MaterialTheme.typography.titleMedium,
                                color = WhiteText,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = "Shop will confirm availability & set the bill.",
                                style = MaterialTheme.typography.bodySmall,
                                color = WhiteTextMuted
                            )
                        }
                    }
                }
            }
            
            // Delivery Method Selector
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = SlateCard)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "Delivery Method",
                        style = MaterialTheme.typography.labelMedium,
                        color = WhiteTextMuted
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        DeliveryOptionChip(
                            label = "Pickup",
                            icon = Icons.Default.Store,
                            selected = deliveryMethod == "pickup",
                            enabled = pickupAvailable,
                            onClick = { deliveryMethod = "pickup" },
                            modifier = Modifier.weight(1f)
                        )
                        DeliveryOptionChip(
                            label = "Delivery",
                            icon = Icons.Default.LocalShipping,
                            selected = deliveryMethod == "delivery",
                            enabled = deliveryAvailable,
                            onClick = { deliveryMethod = "delivery" },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Order Text Area
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = SlateCard)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "Items",
                        style = MaterialTheme.typography.labelMedium,
                        color = WhiteTextMuted
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = orderText,
                        onValueChange = { orderText = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(150.dp),
                        placeholder = {
                            Text(
                                "Example: \"1kg Rice, 2 Sugars, 1 Hamam Soap\"",
                                color = WhiteTextMuted.copy(alpha = 0.5f)
                            )
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = WhiteText,
                            unfocusedTextColor = WhiteText,
                            focusedBorderColor = OrangePrimary,
                            unfocusedBorderColor = GlassWhite,
                            cursorColor = OrangePrimary
                        ),
                        shape = RoundedCornerShape(12.dp)
                    )
                    Text(
                        text = "Tip: Keep it simple. One line is enough.",
                        style = MaterialTheme.typography.labelSmall,
                        color = WhiteTextMuted,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Monthly List Section
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(
                    containerColor = SlateCard.copy(alpha = 0.7f)
                )
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Monthly List",
                            style = MaterialTheme.typography.titleSmall,
                            color = WhiteText,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = "Save your repeat items once and reuse anytime.",
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteTextMuted
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = {
                                if (monthlyList.isNotEmpty()) {
                                    orderText = monthlyList
                                    Toast.makeText(context, "Monthly list loaded", Toast.LENGTH_SHORT).show()
                                }
                            },
                            enabled = monthlyList.isNotEmpty(),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = OrangePrimary
                            )
                        ) {
                            Text("Use")
                        }
                        OutlinedButton(
                            onClick = {
                                if (orderText.isNotBlank()) {
                                    saveMonthlyList(context, shopId, userId, orderText)
                                    monthlyList = orderText
                                    Toast.makeText(context, "Monthly list saved", Toast.LENGTH_SHORT).show()
                                }
                            },
                            enabled = orderText.isNotBlank(),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = OrangePrimary
                            )
                        ) {
                            Text("Save")
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            if (frequentItems.isNotEmpty()) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Text(
                            text = "Tap to add",
                            style = MaterialTheme.typography.titleSmall,
                            color = WhiteText,
                            fontWeight = FontWeight.Medium
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(frequentItems) { item ->
                                SuggestionChip(
                                    onClick = {
                                        orderText = if (orderText.isBlank()) {
                                            item
                                        } else {
                                            "$orderText, $item"
                                        }
                                    },
                                    label = { Text(item, color = WhiteText) },
                                    colors = SuggestionChipDefaults.suggestionChipColors(
                                        containerColor = ProviderBlue.copy(alpha = 0.2f)
                                    ),
                                    border = SuggestionChipDefaults.suggestionChipBorder(
                                        enabled = true,
                                        borderColor = ProviderBlue.copy(alpha = 0.3f)
                                    )
                                )
                            }
                        }
                        Text(
                            text = "Based on popular items from this shop.",
                            style = MaterialTheme.typography.labelSmall,
                            color = WhiteTextMuted,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Send Button
            Button(
                onClick = {
                    if (orderText.isBlank()) {
                        Toast.makeText(context, "Please enter your items", Toast.LENGTH_SHORT).show()
                        return@Button
                    }
                    viewModel.createTextOrder(
                        shopId = shopId,
                        orderText = orderText.trim(),
                        deliveryMethod = deliveryMethod,
                        onSuccess = { orderId ->
                            Toast.makeText(context, "Order sent to shop!", Toast.LENGTH_SHORT).show()
                            onNavigateToOrder(orderId)
                        },
                        onError = { message ->
                            Toast.makeText(context, message, Toast.LENGTH_LONG).show()
                        }
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .height(56.dp),
                enabled = !isLoading && orderText.isNotBlank(),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = OrangePrimary
                )
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = WhiteText,
                        strokeWidth = 2.dp
                    )
                } else {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Send,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Send to Shop",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
private fun DeliveryOptionChip(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.clickable(enabled = enabled, onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = if (selected) OrangePrimary.copy(alpha = if (enabled) 0.15f else 0.08f) else SlateBackground,
        border = if (selected) {
            androidx.compose.foundation.BorderStroke(2.dp, OrangePrimary)
        } else {
            androidx.compose.foundation.BorderStroke(1.dp, GlassWhite)
        }
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = when {
                    !enabled -> WhiteTextMuted.copy(alpha = 0.5f)
                    selected -> OrangePrimary
                    else -> WhiteTextMuted
                },
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = label,
                color = when {
                    !enabled -> WhiteTextMuted.copy(alpha = 0.5f)
                    selected -> OrangePrimary
                    else -> WhiteTextMuted
                },
                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal
            )
        }
    }
}

// Persistence helpers for monthly list
private fun saveMonthlyList(context: Context, shopId: Int, userId: Int?, list: String) {
    val prefs = context.getSharedPreferences("quick_order", Context.MODE_PRIVATE)
    val userKey = userId?.toString() ?: "anon"
    prefs.edit().putString("monthly_list_${userKey}_$shopId", list).apply()
}

private fun loadMonthlyList(context: Context, shopId: Int, userId: Int?): String {
    val prefs = context.getSharedPreferences("quick_order", Context.MODE_PRIVATE)
    val userKey = userId?.toString() ?: "anon"
    return prefs.getString("monthly_list_${userKey}_$shopId", "") ?: ""
}
