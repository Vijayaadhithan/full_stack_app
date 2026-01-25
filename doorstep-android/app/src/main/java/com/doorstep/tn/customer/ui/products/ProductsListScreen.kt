package com.doorstep.tn.customer.ui.products

import android.Manifest
import android.content.pm.PackageManager
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.doorstep.tn.auth.ui.AuthViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.common.ui.LocationFilterDropdown
import com.doorstep.tn.common.util.fetchCurrentLocation
import com.doorstep.tn.common.util.parseGeoPoint
import com.doorstep.tn.customer.data.model.Product
import com.doorstep.tn.customer.ui.CustomerViewModel
import org.json.JSONObject

/**
 * Products List Screen - with location filter matching web UI
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductsListScreen(
    viewModel: CustomerViewModel = hiltViewModel(),
    authViewModel: AuthViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToProduct: (shopId: Int, productId: Int) -> Unit,
    onNavigateToCart: () -> Unit
) {
    val products by viewModel.products.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val isLoadingMore by viewModel.isLoadingMore.collectAsState()
    val productsHasMore by viewModel.productsHasMore.collectAsState()
    val searchQuery by viewModel.productSearchQuery.collectAsState()
    val selectedCategory by viewModel.selectedCategory.collectAsState()
    val user by authViewModel.user.collectAsState()

    var appliedSearch by remember { mutableStateOf("") }
    var minPriceFilter by remember { mutableStateOf("") }
    var maxPriceFilter by remember { mutableStateOf("") }
    var locationCityFilter by remember { mutableStateOf("") }
    var locationStateFilter by remember { mutableStateOf("") }
    var colorFilter by remember { mutableStateOf("") }
    var sizeFilter by remember { mutableStateOf("") }
    var showFilters by remember { mutableStateOf(false) }
    
    // Reactive Cart Count
    val cartCount by viewModel.cartItems.collectAsState().let { state ->
        derivedStateOf { state.value.sumOf { it.quantity } }
    }
    
    // Wishlist IDs for checking status
    val wishlistIds by viewModel.wishlistProductIds.collectAsState()
    
    // Toast events
    val context = LocalContext.current
    LaunchedEffect(Unit) {
        viewModel.toastEvent.collect { message ->
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
        }
    }
    
    // Location filter state
    var locationRadius by remember { mutableIntStateOf(45) }
    var locationLat by remember { mutableStateOf<Double?>(null) }
    var locationLng by remember { mutableStateOf<Double?>(null) }
    var locationSource by remember { mutableStateOf<String?>(null) }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarseGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (fineGranted || coarseGranted) {
            fetchCurrentLocation(
                context = context,
                onSuccess = { point ->
                    locationLat = point.latitude
                    locationLng = point.longitude
                    locationSource = "Device"
                },
                onError = { message ->
                    Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
                }
            )
        } else {
            Toast.makeText(context, "Location permission denied", Toast.LENGTH_SHORT).show()
        }
    }

    val requestDeviceLocation = {
        val fineGranted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        if (fineGranted || coarseGranted) {
            fetchCurrentLocation(
                context = context,
                onSuccess = { point ->
                    locationLat = point.latitude
                    locationLng = point.longitude
                    locationSource = "Device"
                },
                onError = { message ->
                    Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
                }
            )
        } else {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }
    
    val categories = listOf(
        "All" to null,
        "Groceries" to "groceries",
        "Electronics" to "electronics",
        "Clothing" to "readymade",
        "Home" to "hardware",
        "Beauty" to "beauty"
    )

    val gridState = rememberLazyGridState()
    val shouldLoadMore by remember {
        derivedStateOf {
            val layoutInfo = gridState.layoutInfo
            val totalItems = layoutInfo.totalItemsCount
            val lastVisible = layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            totalItems > 0 && lastVisible >= totalItems - 4
        }
    }
    
    // Re-fetch products when category or location changes
    LaunchedEffect(
        selectedCategory,
        locationLat,
        locationLng,
        locationRadius,
        appliedSearch,
        minPriceFilter,
        maxPriceFilter,
        locationCityFilter,
            locationStateFilter,
            colorFilter,
            sizeFilter
    ) {
        viewModel.loadProducts(
            category = selectedCategory,
            search = appliedSearch.takeIf { it.isNotBlank() },
            minPrice = minPriceFilter.toDoubleOrNull(),
            maxPrice = maxPriceFilter.toDoubleOrNull(),
            attributes = buildAttributesJson(
                color = colorFilter,
                size = sizeFilter
            ),
            locationCity = locationCityFilter.takeIf { it.isNotBlank() },
            locationState = locationStateFilter.takeIf { it.isNotBlank() },
            latitude = locationLat,
            longitude = locationLng,
            radius = if (locationLat != null) locationRadius else null
        )
    }

    LaunchedEffect(shouldLoadMore, productsHasMore, isLoadingMore, isLoading) {
        if (shouldLoadMore && productsHasMore && !isLoadingMore && !isLoading) {
            viewModel.loadMoreProducts()
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Products", color = WhiteText) },
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
                    IconButton(onClick = onNavigateToCart) {
                        BadgedBox(
                            badge = {
                                if (cartCount > 0) {
                                    Badge { Text(cartCount.toString()) }
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
            // ==================== Filter Row: Search + Location ====================
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Compact Search Field
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { viewModel.updateSearchQuery(it) },
                    modifier = Modifier.width(200.dp),
                    placeholder = { 
                        Text("Search...", color = WhiteTextSubtle, style = MaterialTheme.typography.bodySmall) 
                    },
                    leadingIcon = {
                        Icon(Icons.Default.Search, contentDescription = null, tint = WhiteTextMuted, modifier = Modifier.size(18.dp))
                    },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = {
                                viewModel.updateSearchQuery("")
                                appliedSearch = ""
                            }) {
                                Icon(Icons.Default.Clear, contentDescription = "Clear", tint = WhiteTextMuted, modifier = Modifier.size(16.dp))
                            }
                        }
                    },
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(
                        onSearch = { appliedSearch = searchQuery.trim() }
                    ),
                    singleLine = true,
                    shape = RoundedCornerShape(24.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = OrangePrimary,
                        unfocusedBorderColor = GlassBorder,
                        focusedContainerColor = GlassWhite,
                        unfocusedContainerColor = GlassWhite,
                        focusedTextColor = WhiteText,
                        unfocusedTextColor = WhiteText
                    ),
                    textStyle = MaterialTheme.typography.bodySmall
                )
                
                // Location Filter
                LocationFilterDropdown(
                    currentRadius = locationRadius,
                    currentLat = locationLat,
                    currentLng = locationLng,
                    onRadiusChange = { locationRadius = it },
                    onUseDeviceLocation = { requestDeviceLocation() },
                    onUseSavedLocation = {
                        val saved = parseGeoPoint(user?.latitude, user?.longitude)
                        if (saved != null) {
                            locationLat = saved.latitude
                            locationLng = saved.longitude
                            locationSource = "Profile"
                        } else {
                            Toast.makeText(
                                context,
                                "Saved location not available",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    },
                    onClear = {
                        locationLat = null
                        locationLng = null
                        locationSource = null
                    },
                    sourceLabel = locationSource
                )

                IconButton(onClick = { showFilters = true }) {
                    Icon(
                        imageVector = Icons.Default.FilterList,
                        contentDescription = "Filters",
                        tint = WhiteTextMuted
                    )
                }
            }
            
            // Location info
            if (locationLat != null && locationLng != null) {
                Text(
                    text = "Showing products within $locationRadius km",
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                )
            }
            
            // Category Chips
            val selectedTabIndex = categories.indexOfFirst { it.second == selectedCategory }.let { index ->
                if (index >= 0) index else 0
            }

            ScrollableTabRow(
                selectedTabIndex = selectedTabIndex,
                modifier = Modifier.fillMaxWidth(),
                containerColor = SlateDarker,
                edgePadding = 16.dp,
                divider = {}
            ) {
                categories.forEach { (categoryLabel, categoryValue) ->
                    val isSelected = selectedCategory == categoryValue
                    Tab(
                        selected = isSelected,
                        onClick = { 
                            viewModel.updateCategory(categoryValue)
                        }
                    ) {
                        Surface(
                            shape = RoundedCornerShape(20.dp),
                            color = if (isSelected) OrangePrimary else SlateCard,
                            modifier = Modifier.padding(8.dp)
                        ) {
                            Text(
                                text = categoryLabel,
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                                color = WhiteText
                            )
                        }
                    }
                }
            }
            
            HorizontalDivider(color = GlassBorder, thickness = 1.dp)
            
            // Products Grid
            when {
                isLoading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = OrangePrimary)
                    }
                }
                products.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Default.Inventory2,
                                contentDescription = null,
                                tint = WhiteTextMuted,
                                modifier = Modifier.size(64.dp)
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text("No products found", color = WhiteTextMuted)
                        }
                    }
                }
                else -> {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(2),
                        modifier = Modifier.fillMaxSize(),
                        state = gridState,
                        contentPadding = PaddingValues(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(products) { product ->
                            ProductCard(
                                product = product,
                                isInWishlist = wishlistIds.contains(product.id),
                                onClick = { product.shopId?.let { shopId -> onNavigateToProduct(shopId, product.id) } },
                                onAddToCart = { viewModel.addToCart(product.id) },
                                onToggleWishlist = { 
                                    if (wishlistIds.contains(product.id)) {
                                        viewModel.removeFromWishlist(product.id)
                                    } else {
                                        viewModel.addToWishlist(product.id)
                                    }
                                }
                            )
                        }
                        if (isLoadingMore) {
                            item(span = { GridItemSpan(2) }) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 12.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    CircularProgressIndicator(color = OrangePrimary)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showFilters) {
        ProductFiltersDialog(
            initialMinPrice = minPriceFilter,
            initialMaxPrice = maxPriceFilter,
            initialCity = locationCityFilter,
            initialState = locationStateFilter,
            initialColor = colorFilter,
            initialSize = sizeFilter,
            onApply = { minPrice, maxPrice, city, state, color, size ->
                minPriceFilter = minPrice
                maxPriceFilter = maxPrice
                locationCityFilter = city
                locationStateFilter = state
                colorFilter = color
                sizeFilter = size
            },
            onDismiss = { showFilters = false }
        )
    }
}

@Composable
private fun ProductFiltersDialog(
    initialMinPrice: String,
    initialMaxPrice: String,
    initialCity: String,
    initialState: String,
    initialColor: String,
    initialSize: String,
    onApply: (String, String, String, String, String, String) -> Unit,
    onDismiss: () -> Unit
) {
    var minPrice by remember(initialMinPrice) { mutableStateOf(initialMinPrice) }
    var maxPrice by remember(initialMaxPrice) { mutableStateOf(initialMaxPrice) }
    var city by remember(initialCity) { mutableStateOf(initialCity) }
    var state by remember(initialState) { mutableStateOf(initialState) }
    var color by remember(initialColor) { mutableStateOf(initialColor) }
    var size by remember(initialSize) { mutableStateOf(initialSize) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Filters") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = minPrice,
                    onValueChange = { minPrice = it },
                    label = { Text("Min price") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = maxPrice,
                    onValueChange = { maxPrice = it },
                    label = { Text("Max price") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = city,
                    onValueChange = { city = it },
                    label = { Text("City") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = state,
                    onValueChange = { state = it },
                    label = { Text("State") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = color,
                    onValueChange = { color = it },
                    label = { Text("Color") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = size,
                    onValueChange = { size = it },
                    label = { Text("Size") },
                    singleLine = true
                )
                Text(
                    text = "City/State filters apply when nearby search is disabled.",
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onApply(
                        minPrice.trim(),
                        maxPrice.trim(),
                        city.trim(),
                        state.trim(),
                        color.trim(),
                        size.trim()
                    )
                    onDismiss()
                }
            ) {
                Text("Apply")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

private fun buildAttributesJson(color: String, size: String): String? {
    val attributes = mutableMapOf<String, String>()
    if (color.isNotBlank()) {
        attributes["color"] = color.trim()
    }
    if (size.isNotBlank()) {
        attributes["size"] = size.trim()
    }
    return if (attributes.isEmpty()) null else JSONObject(attributes).toString()
}

@Composable
private fun ProductCard(
    product: Product,
    isInWishlist: Boolean,
    onClick: () -> Unit,
    onAddToCart: () -> Unit,
    onToggleWishlist: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Column {
            // Product Image
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(120.dp)
                    .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
                    .background(GlassWhite)
            ) {
                if (!product.images.isNullOrEmpty()) {
                    AsyncImage(
                        model = product.images.first(),
                        contentDescription = product.name,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.ShoppingBag,
                        contentDescription = null,
                        tint = WhiteTextMuted,
                        modifier = Modifier
                            .size(48.dp)
                            .align(Alignment.Center)
                    )
                }
                
                // Wishlist heart button
                IconButton(
                    onClick = onToggleWishlist,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(4.dp)
                        .size(32.dp)
                        .background(SlateCard.copy(alpha = 0.8f), RoundedCornerShape(8.dp))
                ) {
                    Icon(
                        imageVector = if (isInWishlist) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                        contentDescription = if (isInWishlist) "Remove from Wishlist" else "Add to Wishlist",
                        tint = if (isInWishlist) ErrorRed else OrangePrimary,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
            
            // Product Info
            Column(
                modifier = Modifier.padding(12.dp)
            ) {
                Text(
                    text = product.name,
                    style = MaterialTheme.typography.titleSmall,
                    color = WhiteText,
                    fontWeight = FontWeight.Medium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                
                Spacer(modifier = Modifier.height(4.dp))
                
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "₹${product.price}",
                        style = MaterialTheme.typography.titleMedium,
                        color = OrangePrimary,
                        fontWeight = FontWeight.Bold
                    )
                    if (product.mrp != product.price) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "₹${product.mrp}",
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteTextMuted,
                            textDecoration = TextDecoration.LineThrough
                        )
                    }
                }
                
                Spacer(modifier = Modifier.height(8.dp))
                
                Button(
                    onClick = onAddToCart,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary),
                    contentPadding = PaddingValues(vertical = 8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add", style = MaterialTheme.typography.labelMedium)
                }
            }
        }
    }
}
