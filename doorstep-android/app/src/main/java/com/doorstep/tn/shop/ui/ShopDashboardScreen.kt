package com.doorstep.tn.shop.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.shop.data.model.ShopOrder
import com.doorstep.tn.shop.data.model.ShopReview
import java.text.NumberFormat
import java.util.Locale

/**
 * Shop Owner Dashboard Screen with real API data
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShopDashboardScreen(
    viewModel: ShopViewModel = hiltViewModel(),
    onNavigateToProducts: () -> Unit,
    onNavigateToOrders: () -> Unit,
    onNavigateToWorkers: () -> Unit,
    onNavigateToPromotions: () -> Unit,
    onNavigateToInventory: () -> Unit = {},
    onNavigateToReviews: () -> Unit = {},
    onNavigateToProfile: () -> Unit,
    onLogout: () -> Unit
) {
    val dashboardStats by viewModel.dashboardStats.collectAsState()
    val recentOrders by viewModel.recentOrders.collectAsState()
    val shopReviews by viewModel.shopReviews.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()
    
    // Load data on first composition
    LaunchedEffect(Unit) {
        viewModel.loadDashboardData()
    }
    
    // Show snackbar for messages
    val snackbarHostState = remember { SnackbarHostState() }
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
                    Column {
                        Text(
                            text = "Shop Dashboard",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = ShopGreen
                        )
                        Text(
                            text = "Manage your shop",
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteTextMuted
                        )
                    }
                },
                actions = {
                    IconButton(onClick = onNavigateToProfile) {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = "Settings",
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
        
        if (isLoading && dashboardStats == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = ShopGreen)
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                // Stats Cards
                item {
                    Text(
                        text = "Today's Overview",
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        val pendingOrders = dashboardStats?.pendingOrders ?: 0
                        val ordersInProgress = dashboardStats?.ordersInProgress ?: 0
                        StatCard(
                            title = "Orders",
                            value = "${(pendingOrders + ordersInProgress)}",
                            subtitle = "$pendingOrders pending",
                            icon = Icons.Default.Receipt,
                            color = OrangePrimary,
                            modifier = Modifier.weight(1f)
                        )
                        StatCard(
                            title = "Revenue",
                            value = formatCurrency(dashboardStats?.earningsToday ?: 0.0),
                            subtitle = "Today",
                            icon = Icons.Default.CurrencyRupee,
                            color = ShopGreen,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
                
                // Additional Stats Row
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        StatCard(
                            title = "This Month",
                            value = formatCurrency(dashboardStats?.earningsMonth ?: 0.0),
                            subtitle = "Earnings",
                            icon = Icons.AutoMirrored.Filled.TrendingUp,
                            color = ProviderBlue,
                            modifier = Modifier.weight(1f)
                        )
                        StatCard(
                            title = "Products",
                            value = "${dashboardStats?.totalProducts ?: 0}",
                            subtitle = "${dashboardStats?.lowStockItems ?: 0} low stock",
                            icon = Icons.Default.Inventory,
                            color = AmberSecondary,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
                
                // Quick Actions
                item {
                    Text(
                        text = "Quick Actions",
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            ActionCard(
                                icon = Icons.Default.Inventory,
                                label = "Products",
                                color = OrangePrimary,
                                modifier = Modifier.weight(1f),
                                onClick = onNavigateToProducts
                            )
                            ActionCard(
                                icon = Icons.Default.ShoppingCart,
                                label = "Orders",
                                color = ProviderBlue,
                                badge = if ((dashboardStats?.pendingOrders ?: 0) > 0) 
                                    "${dashboardStats?.pendingOrders}" else null,
                                modifier = Modifier.weight(1f),
                                onClick = onNavigateToOrders
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            ActionCard(
                                icon = Icons.Default.Inventory2,
                                label = "Inventory",
                                color = AmberSecondary,
                                badge = if ((dashboardStats?.lowStockItems ?: 0) > 0)
                                    "${dashboardStats?.lowStockItems}" else null,
                                modifier = Modifier.weight(1f),
                                onClick = onNavigateToInventory
                            )
                            ActionCard(
                                icon = Icons.Default.LocalOffer,
                                label = "Promotions",
                                color = ShopGreen,
                                modifier = Modifier.weight(1f),
                                onClick = onNavigateToPromotions
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            ActionCard(
                                icon = Icons.Default.People,
                                label = "Workers",
                                color = ProviderBlue,
                                modifier = Modifier.weight(1f),
                                onClick = onNavigateToWorkers
                            )
                            ActionCard(
                                icon = Icons.Default.Star,
                                label = "Reviews",
                                color = WarningYellow,
                                badge = if (shopReviews.isNotEmpty()) "${shopReviews.size}" else null,
                                modifier = Modifier.weight(1f),
                                onClick = onNavigateToReviews
                            )
                        }
                    }
                }
                
                // Pending Orders Section
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Recent Orders",
                            style = MaterialTheme.typography.titleMedium,
                            color = WhiteText,
                            fontWeight = FontWeight.Bold
                        )
                        TextButton(onClick = onNavigateToOrders) {
                            Text("View All", color = OrangePrimary)
                        }
                    }
                }
                
                if (recentOrders.isEmpty()) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = SlateCard)
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "No recent orders",
                                    color = WhiteTextMuted
                                )
                            }
                        }
                    }
                } else {
                    items(recentOrders.take(5)) { order ->
                        PendingOrderCard(
                            order = order,
                            onClick = onNavigateToOrders
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }

                // Top Customers
                item {
                    Text(
                        text = "Top Customers",
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                }
                
                item {
                    val customers = dashboardStats?.customerSpendTotals ?: emptyList()
                    if (customers.isEmpty()) {
                        Text(
                            text = "No customer analytics yet",
                            color = WhiteTextMuted,
                            style = MaterialTheme.typography.bodySmall
                        )
                    } else {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = SlateCard)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                customers.take(5).forEach { customer ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Column {
                                            Text(
                                                text = customer.name ?: "Customer",
                                                color = WhiteText,
                                                style = MaterialTheme.typography.bodyMedium
                                            )
                                            Text(
                                                text = customer.phone ?: "",
                                                color = WhiteTextMuted,
                                                style = MaterialTheme.typography.bodySmall
                                            )
                                        }
                                        Text(
                                            text = "₹%.2f".format(customer.totalSpent),
                                            color = ShopGreen,
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(8.dp))
                                }
                            }
                        }
                    }
                }

                // Top Items
                item {
                    Text(
                        text = "Top Items",
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                }
                
                item {
                    val items = dashboardStats?.itemSalesTotals ?: emptyList()
                    if (items.isEmpty()) {
                        Text(
                            text = "No sales data yet",
                            color = WhiteTextMuted,
                            style = MaterialTheme.typography.bodySmall
                        )
                    } else {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = SlateCard)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                items.take(5).forEach { item ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Column {
                                            Text(
                                                text = item.name ?: "Item",
                                                color = WhiteText,
                                                style = MaterialTheme.typography.bodyMedium
                                            )
                                            Text(
                                                text = "Qty: ${item.quantity}",
                                                color = WhiteTextMuted,
                                                style = MaterialTheme.typography.bodySmall
                                            )
                                        }
                                        Text(
                                            text = "₹%.2f".format(item.totalAmount),
                                            color = ShopGreen,
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(8.dp))
                                }
                            }
                        }
                    }
                }
                
                // Low Stock Alert
                if ((dashboardStats?.lowStockItems ?: 0) > 0) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = WarningYellow.copy(alpha = 0.1f)
                            )
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Warning,
                                    contentDescription = null,
                                    tint = WarningYellow
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "Low Stock Alert",
                                        style = MaterialTheme.typography.titleSmall,
                                        color = WarningYellow,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "${dashboardStats?.lowStockItems} products are running low",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = WhiteTextMuted
                                    )
                                }
                                TextButton(onClick = onNavigateToInventory) {
                                    Text("View", color = WarningYellow)
                                }
                            }
                        }
                    }
                }
                
                // Recent Reviews Section
                if (shopReviews.isNotEmpty()) {
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Recent Reviews",
                                style = MaterialTheme.typography.titleMedium,
                                color = WhiteText,
                                fontWeight = FontWeight.Bold
                            )
                            TextButton(onClick = onNavigateToReviews) {
                                Text("View All", color = OrangePrimary)
                            }
                        }
                    }
                    
                    items(shopReviews.take(3)) { review ->
                        ReviewCard(review = review)
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }
                
                // Logout
                item {
                    Spacer(modifier = Modifier.height(16.dp))
                    OutlinedButton(
                        onClick = onLogout,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = ErrorRed
                        )
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.Logout,
                            contentDescription = null
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Logout")
                    }
                }
            }
        }
    }
}

@Composable
private fun StatCard(
    title: String,
    value: String,
    subtitle: String,
    icon: ImageVector,
    color: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = GlassWhite)
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
                    text = title,
                    style = MaterialTheme.typography.bodyMedium,
                    color = WhiteTextMuted
                )
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = color,
                    modifier = Modifier.size(20.dp)
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.headlineSmall,
                color = WhiteText,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = color
            )
        }
    }
}

@Composable
private fun ActionCard(
    icon: ImageVector,
    label: String,
    color: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier,
    badge: String? = null,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier
            .height(80.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(color),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = WhiteText,
                    modifier = Modifier.size(20.dp)
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = WhiteText,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.weight(1f)
            )
            badge?.let {
                Badge { Text(it) }
            }
        }
    }
}

@Composable
private fun PendingOrderCard(
    order: ShopOrder,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "#${order.id}",
                        style = MaterialTheme.typography.titleSmall,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    StatusChip(status = order.status)
                }
                Text(
                    text = order.customerName,
                    style = MaterialTheme.typography.bodyMedium,
                    color = WhiteTextMuted
                )
                Text(
                    text = "${order.items.size} items • ${order.displayTotal}",
                    style = MaterialTheme.typography.bodySmall,
                    color = OrangePrimary
                )
            }
            
            if (order.isPending) {
                Button(
                    onClick = onClick,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = ShopGreen
                    ),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("View")
                }
            }
        }
    }
}

@Composable
private fun StatusChip(status: String) {
    val (bgColor, textColor) = when (status) {
        "pending" -> WarningYellow.copy(alpha = 0.2f) to WarningYellow
        "confirmed", "processing" -> ProviderBlue.copy(alpha = 0.2f) to ProviderBlue
        "packed", "dispatched" -> AmberSecondary.copy(alpha = 0.2f) to AmberSecondary
        "delivered" -> ShopGreen.copy(alpha = 0.2f) to ShopGreen
        "cancelled" -> ErrorRed.copy(alpha = 0.2f) to ErrorRed
        else -> GlassWhite to WhiteTextMuted
    }
    
    Surface(
        shape = RoundedCornerShape(4.dp),
        color = bgColor
    ) {
        Text(
            text = status.replaceFirstChar { it.uppercase() },
            style = MaterialTheme.typography.labelSmall,
            color = textColor,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
        )
    }
}

@Composable
private fun ReviewCard(review: ShopReview) {
    val clampedRating = review.rating.coerceIn(0, 5)
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
                verticalAlignment = Alignment.CenterVertically
            ) {
                repeat(clampedRating) {
                    Icon(
                        imageVector = Icons.Default.Star,
                        contentDescription = null,
                        tint = WarningYellow,
                        modifier = Modifier.size(16.dp)
                    )
                }
                repeat(5 - clampedRating) {
                    Icon(
                        imageVector = Icons.Default.StarBorder,
                        contentDescription = null,
                        tint = WhiteTextMuted,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = review.review ?: "No comment",
                style = MaterialTheme.typography.bodyMedium,
                color = WhiteText,
                maxLines = 2
            )
            if (review.hasReply) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "You replied: ${review.shopReply}",
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted,
                    maxLines = 1
                )
            }
        }
    }
}

private fun formatCurrency(amount: Double): String {
    val formatter = NumberFormat.getCurrencyInstance(Locale("en", "IN"))
    return formatter.format(amount)
}
