package com.doorstep.tn.customer.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.R
import com.doorstep.tn.common.localization.Translations
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.common.ui.FestivalBanner
import com.doorstep.tn.common.ui.GradientCard
import com.doorstep.tn.common.ui.GradientType
import com.doorstep.tn.common.ui.LanguageToggleButton
import com.doorstep.tn.common.ui.TimeBasedGreeting
import com.doorstep.tn.customer.data.model.Booking
import com.doorstep.tn.customer.data.model.Order

/**
 * Customer Home Dashboard Screen
 * Beautiful Tamil Nadu-inspired design
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerHomeScreen(
    viewModel: CustomerViewModel = hiltViewModel(),
    onNavigateToProducts: () -> Unit,
    onNavigateToServices: () -> Unit,
    onNavigateToShops: () -> Unit,
    onNavigateToCart: () -> Unit,
    onNavigateToWishlist: () -> Unit,
    onNavigateToOrders: () -> Unit,
    onNavigateToBookings: () -> Unit,
    onNavigateToProfile: () -> Unit,
    onNavigateToSearch: () -> Unit,
    onNavigateToNotifications: () -> Unit = {},
    onLogout: () -> Unit
) {
    // Collect state from ViewModel
    val orders by viewModel.orders.collectAsState()
    val bookings by viewModel.bookings.collectAsState()
    val cartItems by viewModel.cartItems.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val language by viewModel.language.collectAsState()
    val userName by viewModel.userName.collectAsState()
    val unreadNotificationCount by viewModel.unreadNotificationCount.collectAsState()
    
    val t = Translations.get(language)
    
    // Load data on first composition
    LaunchedEffect(Unit) {
        viewModel.loadOrders()
        viewModel.loadBookings()
        viewModel.loadCart()
        viewModel.loadNotifications()
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // App logo
                        Image(
                            painter = painterResource(id = R.drawable.doorstep_logo),
                            contentDescription = "DoorStep",
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(10.dp))
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        TimeBasedGreeting(
                            language = language,
                            userName = userName
                        )
                    }
                },
                actions = {
                    // Language toggle
                    LanguageToggleButton(
                        currentLanguage = language,
                        onLanguageSelected = { viewModel.setLanguage(it) }
                    )
                    // Notifications with badge
                    IconButton(onClick = onNavigateToNotifications) {
                        BadgedBox(
                            badge = {
                                if (unreadNotificationCount > 0) {
                                    Badge(
                                        containerColor = ErrorRed
                                    ) { 
                                        Text(
                                            if (unreadNotificationCount > 99) "99+" else "$unreadNotificationCount",
                                            color = WhiteText
                                        ) 
                                    }
                                }
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.Notifications,
                                contentDescription = "Notifications",
                                tint = WhiteText
                            )
                        }
                    }
                    // Wishlist
                    IconButton(onClick = onNavigateToWishlist) {
                        Icon(
                            imageVector = Icons.Default.Favorite,
                            contentDescription = "Wishlist",
                            tint = WhiteText
                        )
                    }
                    // Cart with badge
                    IconButton(onClick = onNavigateToCart) {
                        BadgedBox(
                            badge = {
                                if (cartItems.isNotEmpty()) {
                                    Badge(
                                        containerColor = TempleGold
                                    ) { 
                                        Text(
                                            "${cartItems.size}",
                                            color = SlateBackground
                                        ) 
                                    }
                                }
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.ShoppingCart,
                                contentDescription = "Cart",
                                tint = WhiteText
                            )
                        }
                    }
                    // Profile
                    IconButton(onClick = onNavigateToProfile) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .background(
                                    brush = Brush.linearGradient(
                                        colors = listOf(OrangePrimary, AmberSecondary)
                                    ),
                                    shape = CircleShape
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Person,
                                contentDescription = "Profile",
                                tint = WhiteText,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = SlateBackground
                )
            )
        },
        containerColor = SlateDarker
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Festival Banner (shows during festivals)
            item {
                FestivalBanner()
            }
            
            // Premium Search Bar
            item {
                GradientCard(
                    gradientType = GradientType.SUNSET,
                    modifier = Modifier.clickable(onClick = onNavigateToSearch)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .background(
                                    color = WhiteText.copy(alpha = 0.2f),
                                    shape = RoundedCornerShape(12.dp)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = null,
                                tint = WhiteText,
                                modifier = Modifier.size(24.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(14.dp))
                        Column {
                            Text(
                                text = t.searchPlaceholder,
                                style = MaterialTheme.typography.bodyLarge,
                                color = WhiteText,
                                fontWeight = FontWeight.Medium
                            )
                            Text(
                                text = t.tapToSearch,
                                style = MaterialTheme.typography.bodySmall,
                                color = WhiteText.copy(alpha = 0.7f)
                            )
                        }
                    }
                }
            }
            
            // Tap to start - Premium Action Cards (matches web design)
            item {
                Text(
                    text = if (language == "ta") "தொடங்க தட்டவும்" else "Tap to start",
                    style = MaterialTheme.typography.titleMedium,
                    color = WhiteText,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(12.dp))
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Service Card
                    PremiumActionCard(
                        icon = Icons.Default.Build,
                        title = if (language == "ta") "சேவை" else "Service",
                        subtitle = if (language == "ta") "இப்போது முன்பதிவு செய்யுங்கள்" else "Book Now",
                        gradientColors = listOf(PeacockBlue, GradientPeacock),
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToServices
                    )
                    // Buy/Products Card
                    PremiumActionCard(
                        icon = Icons.Default.ShoppingBag,
                        title = if (language == "ta") "வாங்கு" else "Buy",
                        subtitle = if (language == "ta") "கடை" else "Shop",
                        gradientColors = listOf(OrangePrimary, SunsetOrange),
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToProducts
                    )
                    // Shops Card (restored - was incorrectly changed to My Bookings)
                    PremiumActionCard(
                        icon = Icons.Default.Store,
                        title = if (language == "ta") "கடைகள்" else "Shops",
                        subtitle = if (language == "ta") "அருகிலுள்ள கடைகளை பாருங்கள்" else "Browse nearby",
                        gradientColors = listOf(ShopGreen, SuccessGreen),
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToShops
                    )
                }
            }
            
            // Browse by category
            item {
                Text(
                    text = t.categories,
                    style = MaterialTheme.typography.titleMedium,
                    color = WhiteText,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(12.dp))
                
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    val categories = when (language) {
                        "ta" -> listOf(
                            "மளிகை" to Icons.Default.LocalGroceryStore,
                            "மின்சாரம்" to Icons.Default.Devices,
                            "ஆடை" to Icons.Default.Checkroom,
                            "வீடு" to Icons.Default.Home,
                            "அழகு" to Icons.Default.Face
                        )
                        else -> listOf(
                            "Grocery" to Icons.Default.LocalGroceryStore,
                            "Electronics" to Icons.Default.Devices,
                            "Clothing" to Icons.Default.Checkroom,
                            "Home" to Icons.Default.Home,
                            "Beauty" to Icons.Default.Face
                        )
                    }
                    items(categories.size) { index ->
                        CategoryChip(
                            name = categories[index].first,
                            icon = categories[index].second,
                            onClick = onNavigateToProducts
                        )
                    }
                }
            }
            
            // My Orders Section
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = t.myOrders,
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    TextButton(onClick = onNavigateToOrders) {
                        Text(t.viewAll, color = OrangePrimary)
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = null,
                            tint = OrangePrimary,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                
                if (isLoading) {
                    Box(
                        modifier = Modifier.fillMaxWidth().height(80.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = OrangePrimary)
                    }
                } else if (orders.isEmpty()) {
                    EmptyStateCard(
                        message = if (language == "ta") "ஆர்டர் இல்லை. ஷாப்பிங் தொடங்குங்கள்!" 
                                  else "No orders yet. Start shopping!",
                        icon = Icons.Default.ShoppingBag
                    )
                } else {
                    val latestOrder = orders.first()
                    OrderPreviewCard(
                        order = latestOrder,
                        language = language,
                        onClick = onNavigateToOrders
                    )
                }
            }
            
            // My Bookings Section
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = t.myBookings,
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    TextButton(onClick = onNavigateToBookings) {
                        Text(t.viewAll, color = OrangePrimary)
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = null,
                            tint = OrangePrimary,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                
                if (isLoading) {
                    Box(
                        modifier = Modifier.fillMaxWidth().height(80.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = OrangePrimary)
                    }
                } else if (bookings.isEmpty()) {
                    EmptyStateCard(
                        message = if (language == "ta") "முன்பதிவு இல்லை. சேவைகளை பாருங்கள்!" 
                                  else "No bookings yet. Browse services!",
                        icon = Icons.Default.Build
                    )
                } else {
                    val latestBooking = bookings.first()
                    BookingPreviewCard(
                        booking = latestBooking,
                        language = language,
                        onClick = onNavigateToBookings
                    )
                }
            }
            
            // Logout
            item {
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedButton(
                    onClick = onLogout,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = ErrorRed
                    ),
                    border = ButtonDefaults.outlinedButtonBorder(enabled = true).copy(
                        brush = Brush.horizontalGradient(
                            colors = listOf(ErrorRed.copy(alpha = 0.5f), ErrorRed.copy(alpha = 0.3f))
                        )
                    )
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Logout,
                        contentDescription = null
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = Translations.get(language).logout,
                        fontWeight = FontWeight.Medium
                    )
                }
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun QuickActionCard(
    icon: ImageVector,
    label: String,
    gradientColors: List<Color>,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier
            .height(110.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = Brush.linearGradient(colors = gradientColors)
                ),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier.padding(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .background(
                            color = WhiteText.copy(alpha = 0.2f),
                            shape = CircleShape
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = WhiteText,
                        modifier = Modifier.size(26.dp)
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = label,
                    style = MaterialTheme.typography.bodyMedium,
                    color = WhiteText,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

/**
 * Premium Action Card matching web's "Tap to start" design
 * Larger cards with TAP label, icon, title, and subtitle
 */
@Composable
private fun PremiumActionCard(
    icon: ImageVector,
    title: String,
    subtitle: String,
    gradientColors: List<Color>,
    modifier: Modifier = Modifier,
    showBorder: Boolean = false,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier
            .height(140.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        border = if (showBorder) androidx.compose.foundation.BorderStroke(1.dp, WhiteTextMuted.copy(alpha = 0.3f)) else null,
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = Brush.linearGradient(colors = gradientColors)
                )
        ) {
            // TAP label in top right
            Text(
                text = "TAP",
                style = MaterialTheme.typography.labelSmall,
                color = WhiteText.copy(alpha = 0.5f),
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(12.dp)
            )
            
            // Main content
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomStart)
                    .padding(14.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .background(
                            color = WhiteText.copy(alpha = 0.15f),
                            shape = RoundedCornerShape(10.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = WhiteText,
                        modifier = Modifier.size(22.dp)
                    )
                }
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    color = WhiteText,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteText.copy(alpha = 0.7f)
                )
            }
        }
    }
}
@Composable
private fun CategoryChip(
    name: String,
    icon: ImageVector,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 18.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .background(
                        brush = Brush.linearGradient(
                            colors = listOf(OrangePrimary, AmberSecondary)
                        ),
                        shape = RoundedCornerShape(8.dp)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = WhiteText,
                    modifier = Modifier.size(18.dp)
                )
            }
            Spacer(modifier = Modifier.width(10.dp))
            Text(
                text = name,
                style = MaterialTheme.typography.bodyMedium,
                color = WhiteText,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun EmptyStateCard(
    message: String,
    icon: ImageVector
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .background(
                        color = OrangePrimary.copy(alpha = 0.15f),
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = OrangePrimary,
                    modifier = Modifier.size(22.dp)
                )
            }
            Spacer(modifier = Modifier.width(14.dp))
            Text(
                text = message,
                color = WhiteTextMuted,
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

@Composable
private fun OrderPreviewCard(
    order: Order,
    language: String,
    onClick: () -> Unit
) {
    val statusColor = when (order.status.lowercase()) {
        "delivered" -> SuccessGreen
        "dispatched", "shipped" -> PeacockBlue
        "cancelled" -> ErrorRed
        else -> OrangePrimary
    }
    
    val statusText = when (language) {
        "ta" -> when (order.status.lowercase()) {
            "pending" -> "நிலுவையில்"
            "delivered" -> "டெலிவரி ஆனது"
            "cancelled" -> "ரத்து"
            else -> order.status
        }
        else -> order.status
    }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .background(
                            brush = Brush.linearGradient(
                                colors = listOf(OrangePrimary, AmberSecondary)
                            ),
                            shape = RoundedCornerShape(12.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Receipt,
                        contentDescription = null,
                        tint = WhiteText,
                        modifier = Modifier.size(24.dp)
                    )
                }
                Spacer(modifier = Modifier.width(14.dp))
                Column {
                    Text(
                        text = "#ORD-${order.id}",
                        style = MaterialTheme.typography.titleSmall,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "${order.items?.size ?: 0} items • ₹${order.total}",
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                }
            }
            
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = statusColor.copy(alpha = 0.15f)
            ) {
                Text(
                    text = statusText.replaceFirstChar { it.uppercase() },
                    color = statusColor,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
                )
            }
        }
    }
}

@Composable
private fun BookingPreviewCard(
    booking: Booking,
    language: String,
    onClick: () -> Unit
) {
    val statusColor = when (booking.status.lowercase()) {
        "confirmed", "accepted" -> SuccessGreen
        "pending" -> OrangePrimary
        "rejected", "cancelled" -> ErrorRed
        else -> PeacockBlue
    }
    
    val statusText = when (language) {
        "ta" -> when (booking.status.lowercase()) {
            "pending" -> "நிலுவையில்"
            "confirmed" -> "உறுதி"
            "cancelled" -> "ரத்து"
            else -> booking.status
        }
        else -> booking.status
    }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .background(
                            brush = Brush.linearGradient(
                                colors = listOf(PeacockBlue, GradientPeacock)
                            ),
                            shape = RoundedCornerShape(12.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Build,
                        contentDescription = null,
                        tint = WhiteText,
                        modifier = Modifier.size(24.dp)
                    )
                }
                Spacer(modifier = Modifier.width(14.dp))
                Column {
                    Text(
                        text = booking.service?.name ?: "Service #${booking.serviceId}",
                        style = MaterialTheme.typography.titleSmall,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = booking.timeSlotLabel ?: "Scheduled",
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                    booking.bookingDate?.let { date ->
                        Text(
                            text = date,
                            style = MaterialTheme.typography.bodySmall,
                            color = OrangePrimary
                        )
                    }
                }
            }
            
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = statusColor.copy(alpha = 0.15f)
            ) {
                Text(
                    text = statusText.replaceFirstChar { it.uppercase() },
                    color = statusColor,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
                )
            }
        }
    }
}
