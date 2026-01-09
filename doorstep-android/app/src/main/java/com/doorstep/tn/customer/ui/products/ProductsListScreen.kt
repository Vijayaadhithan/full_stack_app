package com.doorstep.tn.customer.ui.products

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.common.ui.LocationFilterDropdown
import com.doorstep.tn.customer.data.model.Product
import com.doorstep.tn.customer.ui.CustomerViewModel

/**
 * Products List Screen - with location filter matching web UI
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductsListScreen(
    viewModel: CustomerViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToProduct: (shopId: Int, productId: Int) -> Unit,
    onNavigateToCart: () -> Unit
) {
    val products by viewModel.products.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val searchQuery by viewModel.productSearchQuery.collectAsState()
    val selectedCategory by viewModel.selectedCategory.collectAsState()
    
    // Location filter state
    var locationRadius by remember { mutableIntStateOf(45) }
    var locationLat by remember { mutableStateOf<Double?>(null) }
    var locationLng by remember { mutableStateOf<Double?>(null) }
    
    val categories = listOf("All", "Grocery", "Electronics", "Clothing", "Home", "Beauty")
    
    // Re-fetch products when category or location changes
    LaunchedEffect(selectedCategory, locationLat, locationLng, locationRadius) {
        viewModel.loadProducts(
            category = selectedCategory,
            latitude = locationLat,
            longitude = locationLng,
            radius = if (locationLat != null) locationRadius else null
        )
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
                        BadgedBox(badge = { Badge { Text("${viewModel.cartCount}") } }) {
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
                            IconButton(onClick = { viewModel.updateSearchQuery("") }) {
                                Icon(Icons.Default.Clear, contentDescription = "Clear", tint = WhiteTextMuted, modifier = Modifier.size(16.dp))
                            }
                        }
                    },
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(
                        onSearch = { viewModel.loadProducts(search = searchQuery, latitude = locationLat, longitude = locationLng, radius = if (locationLat != null) locationRadius else null) }
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
                    onUseDeviceLocation = {
                        locationLat = 10.557
                        locationLng = 77.235
                    },
                    onUseSavedLocation = {
                        locationLat = 10.557
                        locationLng = 77.235
                    },
                    onClear = {
                        locationLat = null
                        locationLng = null
                    }
                )
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
            ScrollableTabRow(
                selectedTabIndex = categories.indexOf(selectedCategory ?: "All"),
                modifier = Modifier.fillMaxWidth(),
                containerColor = SlateDarker,
                edgePadding = 16.dp,
                divider = {}
            ) {
                categories.forEach { category ->
                    val isSelected = (selectedCategory ?: "All") == category
                    Tab(
                        selected = isSelected,
                        onClick = { 
                            viewModel.updateCategory(if (category == "All") null else category)
                        }
                    ) {
                        Surface(
                            shape = RoundedCornerShape(20.dp),
                            color = if (isSelected) OrangePrimary else SlateCard,
                            modifier = Modifier.padding(8.dp)
                        ) {
                            Text(
                                text = category,
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
                        contentPadding = PaddingValues(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(products) { product ->
                            ProductCard(
                                product = product,
                                onClick = { product.shopId?.let { shopId -> onNavigateToProduct(shopId, product.id) } },
                                onAddToCart = { viewModel.addToCart(product.id) },
                                onAddToWishlist = { viewModel.addToWishlist(product.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProductCard(
    product: Product,
    onClick: () -> Unit,
    onAddToCart: () -> Unit,
    onAddToWishlist: () -> Unit = {}
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
                    onClick = onAddToWishlist,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(4.dp)
                        .size(32.dp)
                        .background(SlateCard.copy(alpha = 0.8f), RoundedCornerShape(8.dp))
                ) {
                    Icon(
                        imageVector = Icons.Default.FavoriteBorder,
                        contentDescription = "Add to Wishlist",
                        tint = OrangePrimary,
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
