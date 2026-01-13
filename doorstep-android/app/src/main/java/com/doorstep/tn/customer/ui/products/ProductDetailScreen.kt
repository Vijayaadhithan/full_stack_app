package com.doorstep.tn.customer.ui.products

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import android.widget.Toast
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.customer.ui.CustomerViewModel

/**
 * Product Detail Screen
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductDetailScreen(
    shopId: Int,
    productId: Int,
    viewModel: CustomerViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToCart: () -> Unit
) {
    val product by viewModel.selectedProduct.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val cartCount by viewModel.cartItems.collectAsState().let { state ->
        derivedStateOf { state.value.sumOf { it.quantity } }
    }
    var quantity by remember(productId) { mutableStateOf(1) }
    
    // Toast events
    val context = LocalContext.current
    LaunchedEffect(Unit) {
        viewModel.toastEvent.collect { message ->
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
        }
    }
    
    // Use loadShopProduct if shopId is valid, otherwise load by productId only (from search)
    LaunchedEffect(shopId, productId) {
        if (shopId > 0) {
            viewModel.loadShopProduct(shopId, productId)
        } else {
            viewModel.loadProductById(productId)
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Product Details", color = WhiteText) },
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
        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = OrangePrimary)
            }
        } else if (product != null) {
            val p = product!!
            val openOrderAllowed = (p.openOrderMode == true || p.catalogModeEnabled == true)
            val maxQuantity = if (!openOrderAllowed) p.stock?.takeIf { it > 0 } else null
            val canDecrease = quantity > 1
            val canIncrease = maxQuantity?.let { quantity < it } ?: true
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .verticalScroll(rememberScrollState())
            ) {
                // Product Images
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(300.dp)
                        .background(SlateCard),
                    contentAlignment = Alignment.Center
                ) {
                    if (!p.images.isNullOrEmpty()) {
                        AsyncImage(
                            model = p.images.first(),
                            contentDescription = p.name,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Fit
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Default.Image,
                            contentDescription = null,
                            tint = WhiteTextMuted,
                            modifier = Modifier.size(64.dp)
                        )
                    }
                }
                
                // Product Info
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Text(
                        text = p.name,
                        style = MaterialTheme.typography.headlineSmall,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    // Category
                    p.category?.let { category ->
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = OrangePrimary.copy(alpha = 0.2f)
                        ) {
                            Text(
                                text = category,
                                color = OrangePrimary,
                                style = MaterialTheme.typography.labelSmall,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Price
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "₹${p.price}",
                            style = MaterialTheme.typography.headlineMedium,
                            color = OrangePrimary,
                            fontWeight = FontWeight.Bold
                        )
                        
                        p.mrp?.let { mrp ->
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = "₹$mrp",
                                style = MaterialTheme.typography.titleMedium,
                                color = WhiteTextMuted,
                                textDecoration = TextDecoration.LineThrough
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Availability
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = if (p.isAvailable) Icons.Default.CheckCircle else Icons.Default.Cancel,
                            contentDescription = null,
                            tint = if (p.isAvailable) SuccessGreen else ErrorRed,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (p.isAvailable) "In Stock" else "Out of Stock",
                            style = MaterialTheme.typography.bodyMedium,
                            color = if (p.isAvailable) SuccessGreen else ErrorRed
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(20.dp))
                    
                    Text(
                        text = "Quantity",
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(0.dp)
                    ) {
                        IconButton(
                            onClick = { if (canDecrease) quantity -= 1 },
                            enabled = canDecrease,
                            modifier = Modifier
                                .size(32.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(GlassWhite)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Remove,
                                contentDescription = "Decrease",
                                tint = WhiteText,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                        
                        Text(
                            text = "$quantity",
                            style = MaterialTheme.typography.titleSmall,
                            color = WhiteText,
                            modifier = Modifier.padding(horizontal = 16.dp)
                        )
                        
                        IconButton(
                            onClick = { if (canIncrease) quantity += 1 },
                            enabled = canIncrease,
                            modifier = Modifier
                                .size(32.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(GlassWhite)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = "Increase",
                                tint = WhiteText,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                        
                        maxQuantity?.let { max ->
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = "Max $max",
                                style = MaterialTheme.typography.labelSmall,
                                color = WhiteTextMuted
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    // Description
                    p.description?.let { desc ->
                        Text(
                            text = "Description",
                            style = MaterialTheme.typography.titleMedium,
                            color = WhiteText,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = desc,
                            style = MaterialTheme.typography.bodyMedium,
                            color = WhiteTextMuted
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(32.dp))
                    
                    // Add to Cart and Wishlist Buttons
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Button(
                            onClick = { viewModel.addToCart(productId, quantity) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary),
                            enabled = p.isAvailable
                        ) {
                            Icon(Icons.Default.AddShoppingCart, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Add to Cart", style = MaterialTheme.typography.titleMedium)
                        }

                        // Wishlist Button
                        val isInWishlist = viewModel.isInWishlist(productId)
                        OutlinedButton(
                            onClick = { 
                                if (isInWishlist) {
                                    viewModel.removeFromWishlist(productId)
                                } else {
                                    viewModel.addToWishlist(productId)
                                }
                            },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = if (isInWishlist) ErrorRed else WhiteText
                            ),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp, 
                                if (isInWishlist) ErrorRed else WhiteTextMuted
                            )
                        ) {
                            Icon(
                                imageVector = if (isInWishlist) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                contentDescription = "Wishlist",
                                tint = if (isInWishlist) ErrorRed else WhiteText
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
                    Text("Product not found", color = WhiteTextMuted)
                }
            }
        }
    }
}
