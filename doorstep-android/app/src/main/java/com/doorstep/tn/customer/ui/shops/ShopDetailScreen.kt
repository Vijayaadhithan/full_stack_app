package com.doorstep.tn.customer.ui.shops

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.customer.data.model.Product
import com.doorstep.tn.customer.ui.CustomerViewModel

/**
 * Shop Detail Screen - Shows shop info and products
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShopDetailScreen(
    shopId: Int,
    viewModel: CustomerViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToProduct: (shopId: Int, productId: Int) -> Unit,
    onNavigateToCart: () -> Unit,
    onNavigateToQuickOrder: (shopId: Int, shopName: String) -> Unit = { _, _ -> }
) {
    val shop by viewModel.selectedShop.collectAsState()
    val products by viewModel.shopProducts.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    
    // Search and Filter State
    var searchQuery by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf<String?>(null) }
    
    // Derive unique categories from products
    val categories = remember(products) {
        products.mapNotNull { it.category }.distinct().sorted()
    }
    
    // Compute filtered products
    val filteredProducts = remember(products, searchQuery, selectedCategory) {
        products.filter { product ->
            val matchesSearch = searchQuery.trim().isEmpty() || 
                                product.name.contains(searchQuery, ignoreCase = true) || 
                                (product.description?.contains(searchQuery, ignoreCase = true) == true)
            val matchesCategory = selectedCategory == null || product.category.equals(selectedCategory, ignoreCase = true)
            matchesSearch && matchesCategory
        }
    }
    
    LaunchedEffect(shopId) {
        viewModel.loadShopDetails(shopId)
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(shop?.displayName ?: "Shop Details", color = WhiteText) },
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
                        Icon(
                            imageVector = Icons.Default.ShoppingCart,
                            contentDescription = "Cart",
                            tint = WhiteText
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SlateBackground)
            )
        },
        containerColor = SlateDarker
    ) { paddingValues ->
        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = ShopGreen)
            }
        } else if (shop != null) {
            val s = shop!!
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                // Shop Header
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        // Shop Image
                        Box(
                            modifier = Modifier
                                .size(80.dp)
                                .clip(CircleShape)
                                .background(GlassWhite),
                            contentAlignment = Alignment.Center
                        ) {
                            if (!s.profileImage.isNullOrEmpty()) {
                                AsyncImage(
                                    model = s.profileImage,
                                    contentDescription = s.displayName,
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop
                                )
                            } else {
                                Icon(
                                    imageVector = Icons.Default.Store,
                                    contentDescription = null,
                                    tint = ShopGreen,
                                    modifier = Modifier.size(40.dp)
                                )
                            }
                        }
                        
                        Spacer(modifier = Modifier.height(12.dp))
                        
                        Text(
                            text = s.displayName,
                            style = MaterialTheme.typography.titleLarge,
                            color = WhiteText,
                            fontWeight = FontWeight.Bold
                        )
                        
                        s.description?.let { desc ->
                            Text(
                                text = desc,
                                style = MaterialTheme.typography.bodyMedium,
                                color = WhiteTextMuted,
                                maxLines = 2
                            )
                        }
                        
                        Spacer(modifier = Modifier.height(12.dp))
                        
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Location
                            if (s.addressCity != null) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.LocationOn,
                                        contentDescription = null,
                                        tint = WhiteTextMuted,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = s.addressCity,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = WhiteTextMuted
                                    )
                                }
                            }
                            
                            // Rating
                            val rating = s.rating
                            if (rating != null && rating > 0) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.Star,
                                        contentDescription = null,
                                        tint = AmberSecondary,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = String.format("%.1f", s.rating),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = AmberSecondary
                                    )
                                }
                            }
                            
                            // Open Status
                            Surface(
                                shape = RoundedCornerShape(4.dp),
                                color = if (s.isOpen) SuccessGreen.copy(alpha = 0.2f) else ErrorRed.copy(alpha = 0.2f)
                            ) {
                                Text(
                                    text = if (s.isOpen) "Open" else "Closed",
                                    color = if (s.isOpen) SuccessGreen else ErrorRed,
                                    style = MaterialTheme.typography.labelSmall,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }
                        }
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        // Quick Order Button - Premium feature
                        Button(
                            onClick = { onNavigateToQuickOrder(shopId, s.displayName) },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = OrangePrimary
                            )
                        ) {
                            Icon(
                                imageVector = Icons.Default.FlashOn,
                                contentDescription = null,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Quick Order",
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
                
                // Products Header
                Text(
                    text = "Products",
                    style = MaterialTheme.typography.titleMedium,
                    color = WhiteText,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 16.dp)
                )
                
                Spacer(modifier = Modifier.height(12.dp))
                
                // Search and Filter Section
                Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                    // Search Bar
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Search in shop...", color = WhiteTextMuted) },
                        leadingIcon = { Icon(Icons.Default.Search, null, tint = WhiteTextMuted) },
                        trailingIcon = if (searchQuery.isNotEmpty()) {
                            {
                                IconButton(onClick = { searchQuery = "" }) {
                                    Icon(Icons.Default.Close, null, tint = WhiteTextMuted)
                                }
                            }
                        } else null,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = SlateCard,
                            unfocusedContainerColor = SlateCard,
                            focusedBorderColor = OrangePrimary,
                            unfocusedBorderColor = Color.Transparent,
                            cursorColor = OrangePrimary,
                            focusedTextColor = WhiteText,
                            unfocusedTextColor = WhiteText
                        ),
                        singleLine = true
                    )
                    
                    // Categories Chips
                    if (categories.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(12.dp))
                        androidx.compose.foundation.lazy.LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            item {
                                FilterChip(
                                    selected = selectedCategory == null,
                                    onClick = { selectedCategory = null },
                                    label = { Text("All") },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = OrangePrimary,
                                        selectedLabelColor = WhiteText,
                                        containerColor = SlateCard,
                                        labelColor = WhiteTextMuted
                                    ),
                                    border = null
                                )
                            }
                            items(categories) { category ->
                                FilterChip(
                                    selected = selectedCategory == category,
                                    onClick = { selectedCategory = if (selectedCategory == category) null else category },
                                    label = { Text(category) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = OrangePrimary,
                                        selectedLabelColor = WhiteText,
                                        containerColor = SlateCard,
                                        labelColor = WhiteTextMuted
                                    ),
                                    border = null
                                )
                            }
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(12.dp))
                
                // Products Grid
                if (filteredProducts.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            if (products.isEmpty()) "No products available" else "No matching products found", 
                            color = WhiteTextMuted
                        )
                    }
                } else {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(2),
                        contentPadding = PaddingValues(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(filteredProducts) { product ->
                            ShopProductCard(
                                product = product,
                                onClick = { onNavigateToProduct(shopId, product.id) }
                            )
                        }
                    }
                }
            }
        } else {
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
                    Text("Shop not found", color = WhiteTextMuted)
                }
            }
        }
    }
}

@Composable
private fun ShopProductCard(
    product: Product,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(100.dp)
                    .background(GlassWhite),
                contentAlignment = Alignment.Center
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
                        imageVector = Icons.Default.Image,
                        contentDescription = null,
                        tint = WhiteTextMuted,
                        modifier = Modifier.size(32.dp)
                    )
                }
            }
            
            Column(modifier = Modifier.padding(12.dp)) {
                Text(
                    text = product.name,
                    style = MaterialTheme.typography.bodyMedium,
                    color = WhiteText,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "₹${product.price}",
                    style = MaterialTheme.typography.titleMedium,
                    color = OrangePrimary,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
