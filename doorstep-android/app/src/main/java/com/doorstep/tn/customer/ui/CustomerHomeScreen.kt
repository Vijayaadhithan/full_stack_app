package com.doorstep.tn.customer.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.EventNote
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.doorstep.tn.R
import com.doorstep.tn.auth.ui.AuthViewModel
import com.doorstep.tn.common.localization.Translations
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.common.ui.PollingEffect
import com.doorstep.tn.common.ui.FestivalBanner
import com.doorstep.tn.common.ui.GradientCard
import com.doorstep.tn.common.ui.GradientType
import com.doorstep.tn.common.ui.LanguageToggleButton
import com.doorstep.tn.common.ui.TimeBasedGreeting
import com.doorstep.tn.common.util.StatusUtils
import com.doorstep.tn.common.util.parseGeoPoint
import com.doorstep.tn.core.network.SearchResult
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
    authViewModel: AuthViewModel = hiltViewModel(),
    onNavigateToProducts: () -> Unit,
    onNavigateToServices: () -> Unit,
    onNavigateToShops: () -> Unit,
    onNavigateToCart: () -> Unit,
    onNavigateToWishlist: () -> Unit,
    onNavigateToOrders: () -> Unit,
    onNavigateToBookings: () -> Unit,
    onNavigateToProfile: () -> Unit,
    onNavigateToSearch: () -> Unit,
    onNavigateToServiceDetail: (Int) -> Unit,
    onNavigateToProductDetail: (Int, Int) -> Unit,
    onNavigateToShopDetail: (Int) -> Unit,
    onNavigateToNotifications: () -> Unit = {},
    onLogout: () -> Unit
) {
    // Collect state from ViewModel
    val orders by viewModel.orders.collectAsState()
    val bookings by viewModel.bookings.collectAsState()
    val bookingRequests by viewModel.bookingRequests.collectAsState()
    val bookingHistory by viewModel.bookingHistory.collectAsState()
    val cartItems by viewModel.cartItems.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val bookingRequestsLoading by viewModel.bookingRequestsLoading.collectAsState()
    val bookingHistoryLoading by viewModel.bookingHistoryLoading.collectAsState()
    val language by viewModel.language.collectAsState()
    val userName by viewModel.userName.collectAsState()
    val unreadNotificationCount by viewModel.unreadNotificationCount.collectAsState()
    val buyAgainData by viewModel.buyAgainRecommendations.collectAsState()
    val isBuyAgainLoading by viewModel.isBuyAgainLoading.collectAsState()
    val searchResults by viewModel.searchResults.collectAsState()
    val isSearching by viewModel.isSearching.collectAsState()
    val user by authViewModel.user.collectAsState()
    
    val t = Translations.get(language)
    var inlineSearchQuery by rememberSaveable { mutableStateOf("") }
    val savedLocation = remember(user) {
        parseGeoPoint(user?.latitude, user?.longitude)
    }
    
    // Load data on first composition
    LaunchedEffect(Unit) {
        viewModel.loadOrders()
        viewModel.loadBookings()
        viewModel.loadBookingRequests()
        viewModel.loadBookingHistory()
        viewModel.loadCart()
        viewModel.loadNotifications()
        viewModel.loadBuyAgainRecommendations()
    }

    LaunchedEffect(savedLocation) {
        viewModel.updateSearchLocation(
            latitude = savedLocation?.latitude,
            longitude = savedLocation?.longitude,
            radius = if (savedLocation != null) 45 else null
        )
        val trimmedQuery = inlineSearchQuery.trim()
        if (trimmedQuery.length >= 2) {
            viewModel.performSearch(trimmedQuery)
        }
    }

    LaunchedEffect(inlineSearchQuery) {
        val trimmedQuery = inlineSearchQuery.trim()
        when {
            trimmedQuery.length >= 2 -> viewModel.performSearch(trimmedQuery)
            trimmedQuery.isEmpty() -> viewModel.clearSearch()
            else -> viewModel.clearSearch()
        }
    }

    PollingEffect(intervalMs = 30_000L) {
        viewModel.loadOrders()
        viewModel.loadBookings()
        viewModel.loadBookingRequests()
        viewModel.loadBookingHistory()
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
            
            // Premium Search Bar + Inline Results
            item {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    GradientCard(
                        gradientType = GradientType.SUNSET
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Row(
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

                            OutlinedTextField(
                                value = inlineSearchQuery,
                                onValueChange = { inlineSearchQuery = it },
                                modifier = Modifier.fillMaxWidth(),
                                placeholder = {
                                    Text(
                                        text = if (language == "ta") "தேடத் தொடங்கு..." else "Start typing...",
                                        color = WhiteText.copy(alpha = 0.7f)
                                    )
                                },
                                leadingIcon = {
                                    Icon(
                                        imageVector = Icons.Default.Search,
                                        contentDescription = null,
                                        tint = WhiteText.copy(alpha = 0.9f)
                                    )
                                },
                                trailingIcon = {
                                    if (inlineSearchQuery.isNotEmpty()) {
                                        IconButton(onClick = {
                                            inlineSearchQuery = ""
                                            viewModel.clearSearch()
                                        }) {
                                            Icon(
                                                imageVector = Icons.Default.Clear,
                                                contentDescription = "Clear",
                                                tint = WhiteText.copy(alpha = 0.9f)
                                            )
                                        }
                                    }
                                },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                                keyboardActions = KeyboardActions(
                                    onSearch = {
                                        val trimmedQuery = inlineSearchQuery.trim()
                                        if (trimmedQuery.length >= 2) {
                                            viewModel.performSearch(trimmedQuery)
                                        }
                                    }
                                ),
                                shape = RoundedCornerShape(14.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedTextColor = WhiteText,
                                    unfocusedTextColor = WhiteText,
                                    focusedBorderColor = WhiteText.copy(alpha = 0.6f),
                                    unfocusedBorderColor = WhiteText.copy(alpha = 0.35f),
                                    focusedContainerColor = WhiteText.copy(alpha = 0.2f),
                                    unfocusedContainerColor = WhiteText.copy(alpha = 0.15f),
                                    cursorColor = WhiteText
                                )
                            )

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                if (savedLocation != null) {
                                    Icon(
                                        imageVector = Icons.Default.LocationOn,
                                        contentDescription = null,
                                        tint = WhiteText.copy(alpha = 0.7f),
                                        modifier = Modifier.size(14.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = if (language == "ta") "இடம் அடிப்படையில் தேடுகிறது" else "Searching near you",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = WhiteText.copy(alpha = 0.7f)
                                    )
                                }

                                Spacer(modifier = Modifier.weight(1f))

                                TextButton(
                                    onClick = onNavigateToSearch,
                                    colors = ButtonDefaults.textButtonColors(
                                        contentColor = WhiteText
                                    )
                                ) {
                                    Text(
                                        text = if (language == "ta") "முழு தேடல்" else "Full search",
                                        style = MaterialTheme.typography.labelLarge
                                    )
                                }
                            }
                        }
                    }

                    InlineSearchResults(
                        query = inlineSearchQuery,
                        isSearching = isSearching,
                        results = searchResults,
                        language = language,
                        onNavigateToService = onNavigateToServiceDetail,
                        onNavigateToProduct = onNavigateToProductDetail,
                        onNavigateToShop = onNavigateToShopDetail
                    )
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
            
            // Buy Again Section - matches web's dashboard.tsx "Buy Again" section
            val hasBuyAgainItems = buyAgainData?.let { 
                it.products.isNotEmpty() || it.services.isNotEmpty() 
            } ?: false
            
            if (isBuyAgainLoading || hasBuyAgainItems) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = if (language == "ta") "மீண்டும் வாங்கு" else "Buy Again",
                                style = MaterialTheme.typography.titleMedium,
                                color = WhiteText,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = if (language == "ta") "உங்கள் விருப்பங்கள்" else "Personalized for you",
                                style = MaterialTheme.typography.bodySmall,
                                color = WhiteTextMuted
                            )
                        }
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = TempleGold.copy(alpha = 0.15f)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.AutoAwesome,
                                    contentDescription = null,
                                    tint = TempleGold,
                                    modifier = Modifier.size(14.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = if (language == "ta") "தனிப்பட்ட" else "Personalized",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = TempleGold
                                )
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    if (isBuyAgainLoading) {
                        Box(
                            modifier = Modifier.fillMaxWidth().height(80.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = OrangePrimary, modifier = Modifier.size(28.dp))
                        }
                    } else {
                        // Combine products and services, show top 4
                        val recommendations = mutableListOf<Any>()
                        buyAgainData?.products?.forEach { recommendations.add(it) }
                        buyAgainData?.services?.forEach { recommendations.add(it) }
                        
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(recommendations.take(4).size) { index ->
                                val item = recommendations[index]
                                when (item) {
                                    is com.doorstep.tn.core.network.BuyAgainProduct -> {
                                        BuyAgainProductCard(
                                            product = item,
                                            language = language,
                                            onAddToCart = { viewModel.addToCart(item.productId) }
                                        )
                                    }
                                    is com.doorstep.tn.core.network.BuyAgainService -> {
                                        BuyAgainServiceCard(
                                            service = item,
                                            language = language,
                                            onBook = onNavigateToServices
                                        )
                                    }
                                }
                            }
                        }
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

            // Booking Requests Section
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (language == "ta") "முன்பதிவு கோரிக்கைகள்" else "Booking Requests",
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

                val pendingRequests = bookingRequests.filter { it.status.lowercase() == "pending" }

                if (bookingRequestsLoading && pendingRequests.isEmpty()) {
                    Box(
                        modifier = Modifier.fillMaxWidth().height(80.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = OrangePrimary)
                    }
                } else if (pendingRequests.isEmpty()) {
                    EmptyStateCard(
                        message = if (language == "ta") "புதிய கோரிக்கைகள் இல்லை." else "No pending booking requests.",
                        icon = Icons.AutoMirrored.Filled.EventNote
                    )
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        pendingRequests.take(3).forEach { booking ->
                            BookingListItem(
                                booking = booking,
                                statusLabel = StatusUtils.getBookingStatusLabel(booking.status),
                                statusColor = StatusUtils.getBookingStatusColor(booking.status),
                                onClick = onNavigateToBookings
                            )
                        }
                    }
                }
            }

            // Booking History Section
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (language == "ta") "முன்பதிவு வரலாறு" else "Booking History",
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

                if (bookingHistoryLoading && bookingHistory.isEmpty()) {
                    Box(
                        modifier = Modifier.fillMaxWidth().height(80.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = OrangePrimary)
                    }
                } else if (bookingHistory.isEmpty()) {
                    EmptyStateCard(
                        message = if (language == "ta") "முன்பதிவு வரலாறு இல்லை." else "No booking history yet.",
                        icon = Icons.Default.History
                    )
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        bookingHistory.take(3).forEach { booking ->
                            BookingListItem(
                                booking = booking,
                                statusLabel = StatusUtils.getBookingStatusLabel(booking.status),
                                statusColor = StatusUtils.getBookingStatusColor(booking.status),
                                onClick = onNavigateToBookings
                            )
                        }
                    }
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
private fun InlineSearchResults(
    query: String,
    isSearching: Boolean,
    results: List<SearchResult>,
    language: String,
    onNavigateToService: (Int) -> Unit,
    onNavigateToProduct: (Int, Int) -> Unit,
    onNavigateToShop: (Int) -> Unit
) {
    val trimmedQuery = query.trim()
    if (trimmedQuery.isEmpty() && !isSearching && results.isEmpty()) {
        return
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            when {
                trimmedQuery.length < 2 -> {
                    Text(
                        text = if (language == "ta") {
                            "தேட குறைந்தது 2 எழுத்துகளை உள்ளிடுங்கள்"
                        } else {
                            "Type at least 2 characters to search"
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                }
                isSearching -> {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        CircularProgressIndicator(
                            color = OrangePrimary,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = if (language == "ta") "தேடுகிறது..." else "Searching...",
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteTextMuted
                        )
                    }
                }
                results.isEmpty() -> {
                    Text(
                        text = if (language == "ta") "முடிவு கிடைக்கவில்லை" else "No results found",
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                }
                else -> {
                    Text(
                        text = if (language == "ta") "சிறந்த முடிவுகள்" else "Top results",
                        style = MaterialTheme.typography.titleSmall,
                        color = WhiteText,
                        fontWeight = FontWeight.SemiBold
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        results.take(6).forEach { result ->
                            InlineSearchResultRow(
                                result = result,
                                language = language,
                                onClick = {
                                    when (result.type) {
                                        "service" -> onNavigateToService(result.id)
                                        "product" -> onNavigateToProduct(0, result.id)
                                        "shop" -> onNavigateToShop(result.id)
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun InlineSearchResultRow(
    result: SearchResult,
    language: String,
    onClick: () -> Unit
) {
    val (icon, color) = when (result.type) {
        "service" -> Icons.Default.Handshake to ProviderBlue
        "product" -> Icons.Default.ShoppingBag to OrangePrimary
        "shop" -> Icons.Default.Store to SuccessGreen
        else -> Icons.Default.Search to WhiteTextMuted
    }

    val distanceLabel = result.distance?.let { dist ->
        if (dist.isFinite()) String.format("%.1f km away", dist) else null
    }

    val typeLabel = when (result.type) {
        "service" -> if (language == "ta") "சேவை" else "Service"
        "product" -> if (language == "ta") "பொருள்" else "Product"
        "shop" -> if (language == "ta") "கடை" else "Shop"
        else -> if (language == "ta") "தேடல்" else "Search"
    }
    val actionLabel = when (result.type) {
        "service" -> if (language == "ta") "முன்பதிவு" else "Book"
        "product" -> if (language == "ta") "பார்" else "View"
        "shop" -> if (language == "ta") "திற" else "Open"
        else -> if (language == "ta") "பார்" else "View"
    }
    val subtitle = result.description?.takeIf { it.isNotBlank() }
        ?: result.providerName?.takeIf { it.isNotBlank() }
        ?: result.shopName?.takeIf { it.isNotBlank() }
        ?: result.category?.takeIf { it.isNotBlank() }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SlateDarker)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(color.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                if (!result.imageUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = result.imageUrl,
                        contentDescription = result.name,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = color,
                        modifier = Modifier.size(22.dp)
                    )
                }
            }

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = color.copy(alpha = 0.2f)
                    ) {
                        Text(
                            text = typeLabel,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall,
                            color = color
                        )
                    }
                    distanceLabel?.let { label ->
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = WhiteText.copy(alpha = 0.12f)
                        ) {
                            Text(
                                text = label,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = WhiteTextSubtle
                            )
                        }
                    }
                }

                Text(
                    text = result.name,
                    style = MaterialTheme.typography.titleSmall,
                    color = WhiteText,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                subtitle?.let { text ->
                    Text(
                        text = text,
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                result.price?.let { price ->
                    Text(
                        text = "₹$price",
                        style = MaterialTheme.typography.titleSmall,
                        color = OrangePrimary,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                OutlinedButton(
                    onClick = onClick,
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = WhiteText),
                    border = BorderStroke(1.dp, color.copy(alpha = 0.5f))
                ) {
                    Text(
                        text = actionLabel,
                        style = MaterialTheme.typography.labelMedium
                    )
                }
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
    val statusColor = StatusUtils.getOrderStatusColor(order.status)
    val statusLabel = StatusUtils.getOrderStatusLabel(order.status)
    
    val statusText = when (language) {
        "ta" -> when (order.status.lowercase()) {
            "pending" -> "நிலுவையில்"
            "delivered" -> "டெலிவரி ஆனது"
            "cancelled" -> "ரத்து"
            "returned" -> "திருப்பப்பட்டது"
            "awaiting_customer_agreement" -> "உறுதிப்படுத்தல் தேவை"
            else -> order.status
        }
        else -> statusLabel
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

@Composable
private fun BookingListItem(
    booking: Booking,
    statusLabel: String,
    statusColor: Color,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
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
                Text(
                    text = booking.service?.name ?: "Service #${booking.serviceId}",
                    style = MaterialTheme.typography.titleSmall,
                    color = WhiteText,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                )
                val timeLabel = booking.timeSlotLabel ?: "Scheduled"
                Text(
                    text = timeLabel,
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

            Surface(
                shape = RoundedCornerShape(10.dp),
                color = statusColor.copy(alpha = 0.15f)
            ) {
                Text(
                    text = statusLabel,
                    color = statusColor,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                )
            }
        }
    }
}

/**
 * Buy Again Product Card - matches web's dashboard buy-again product card design
 */
@Composable
private fun BuyAgainProductCard(
    product: com.doorstep.tn.core.network.BuyAgainProduct,
    language: String,
    onAddToCart: () -> Unit
) {
    Card(
        modifier = Modifier.width(160.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(80.dp)
                    .background(OrangePrimary.copy(alpha = 0.1f), RoundedCornerShape(10.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.ShoppingBag, null, tint = OrangePrimary, modifier = Modifier.size(32.dp))
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Surface(shape = RoundedCornerShape(4.dp), color = GlassBorder) {
                    Text(if (language == "ta") "பொருள்" else "Product", style = MaterialTheme.typography.labelSmall, color = WhiteTextMuted, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                }
                Text("×${product.timesOrdered}", style = MaterialTheme.typography.labelSmall, color = WhiteTextMuted)
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(product.name ?: "Product", style = MaterialTheme.typography.bodyMedium, color = WhiteText, fontWeight = FontWeight.SemiBold, maxLines = 1)
            Text(product.shopName ?: "Shop", style = MaterialTheme.typography.bodySmall, color = WhiteTextMuted, maxLines = 1)
            product.price?.let { Text("₹$it", style = MaterialTheme.typography.bodySmall, color = OrangePrimary, fontWeight = FontWeight.Bold) }
            Spacer(modifier = Modifier.height(8.dp))
            Button(onClick = onAddToCart, modifier = Modifier.fillMaxWidth().height(32.dp), shape = RoundedCornerShape(8.dp), colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary), contentPadding = PaddingValues(4.dp)) {
                Icon(Icons.Default.ShoppingCart, null, modifier = Modifier.size(14.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text(if (language == "ta") "சேர்" else "Add", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/**
 * Buy Again Service Card - matches web's dashboard buy-again service card design
 */
@Composable
private fun BuyAgainServiceCard(
    service: com.doorstep.tn.core.network.BuyAgainService,
    language: String,
    onBook: () -> Unit
) {
    Card(
        modifier = Modifier.width(160.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(80.dp)
                    .background(PeacockBlue.copy(alpha = 0.1f), RoundedCornerShape(10.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Build, null, tint = PeacockBlue, modifier = Modifier.size(32.dp))
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Surface(shape = RoundedCornerShape(4.dp), color = GlassBorder) {
                    Text(if (language == "ta") "சேவை" else "Service", style = MaterialTheme.typography.labelSmall, color = WhiteTextMuted, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                }
                Text("×${service.timesBooked}", style = MaterialTheme.typography.labelSmall, color = WhiteTextMuted)
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(service.name ?: "Service", style = MaterialTheme.typography.bodyMedium, color = WhiteText, fontWeight = FontWeight.SemiBold, maxLines = 1)
            Text(service.providerName ?: "Provider", style = MaterialTheme.typography.bodySmall, color = WhiteTextMuted, maxLines = 1)
            service.price?.let { Text("₹$it", style = MaterialTheme.typography.bodySmall, color = PeacockBlue, fontWeight = FontWeight.Bold) }
            Spacer(modifier = Modifier.height(8.dp))
            Button(onClick = onBook, modifier = Modifier.fillMaxWidth().height(32.dp), shape = RoundedCornerShape(8.dp), colors = ButtonDefaults.buttonColors(containerColor = PeacockBlue), contentPadding = PaddingValues(4.dp)) {
                Icon(Icons.Default.CalendarMonth, null, modifier = Modifier.size(14.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text(if (language == "ta") "முன்பதிவு" else "Book", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
            }
        }
    }
}
