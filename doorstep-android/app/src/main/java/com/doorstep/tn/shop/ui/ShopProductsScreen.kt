package com.doorstep.tn.shop.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.shop.data.model.ShopProduct
import com.doorstep.tn.shop.data.model.UpdateProductRequest

/**
 * Shop Products Management Screen
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShopProductsScreen(
    viewModel: ShopViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToEdit: (Int) -> Unit = {},
    onNavigateToAdd: () -> Unit = {}
) {
    val products by viewModel.products.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()
    
    var searchQuery by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf<String?>(null) }
    var productToDelete by remember { mutableStateOf<ShopProduct?>(null) }
    
    val snackbarHostState = remember { SnackbarHostState() }
    
    LaunchedEffect(Unit) {
        viewModel.loadProducts()
    }
    
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
    
    // Filter products by search and category
    val filteredProducts = products.filter { product ->
        val matchesSearch = searchQuery.isEmpty() || 
            product.name.contains(searchQuery, ignoreCase = true) ||
            product.category?.contains(searchQuery, ignoreCase = true) == true
        val matchesCategory = selectedCategory == null || product.category == selectedCategory
        matchesSearch && matchesCategory
    }
    
    // Get unique categories
    val categories = products.mapNotNull { it.category }.distinct()
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Products",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
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
                actions = {
                    IconButton(onClick = { viewModel.loadProducts() }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Refresh",
                            tint = WhiteText
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = SlateBackground
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onNavigateToAdd,
                containerColor = ShopGreen
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = "Add Product",
                    tint = WhiteText
                )
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = SlateDarker
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Search products...") },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = null,
                        tint = WhiteTextMuted
                    )
                },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(
                                imageVector = Icons.Default.Clear,
                                contentDescription = "Clear",
                                tint = WhiteTextMuted
                            )
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = ShopGreen,
                    unfocusedBorderColor = SlateCard,
                    focusedContainerColor = SlateCard,
                    unfocusedContainerColor = SlateCard
                ),
                singleLine = true
            )
            
            // Category Chips
            if (categories.isNotEmpty()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = selectedCategory == null,
                        onClick = { selectedCategory = null },
                        label = { Text("All") },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = ShopGreen,
                            selectedLabelColor = WhiteText
                        )
                    )
                    categories.take(3).forEach { category ->
                        FilterChip(
                            selected = selectedCategory == category,
                            onClick = { 
                                selectedCategory = if (selectedCategory == category) null else category 
                            },
                            label = { Text(category) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = ShopGreen,
                                selectedLabelColor = WhiteText
                            )
                        )
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
            }
            
            if (isLoading && products.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = ShopGreen)
                }
            } else if (filteredProducts.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            imageVector = Icons.Default.Inventory,
                            contentDescription = null,
                            tint = WhiteTextMuted,
                            modifier = Modifier.size(64.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = if (searchQuery.isEmpty()) "No products yet" else "No products found",
                            color = WhiteTextMuted
                        )
                        if (searchQuery.isEmpty()) {
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(
                                onClick = onNavigateToAdd,
                                colors = ButtonDefaults.buttonColors(containerColor = ShopGreen)
                            ) {
                                Icon(Icons.Default.Add, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Add Product")
                            }
                        }
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(filteredProducts) { product ->
                        ProductCard(
                            product = product,
                            onClick = { onNavigateToEdit(product.id) },
                            onDelete = { productToDelete = product },
                            onToggleAvailability = { 
                                viewModel.updateProductStock(
                                    product.id, 
                                    product.stock ?: 0,
                                    !product.isAvailable
                                )
                            }
                        )
                    }
                }
            }
        }
    }
    
    // Delete Confirmation Dialog
    productToDelete?.let { product ->
        AlertDialog(
            onDismissRequest = { productToDelete = null },
            title = { Text("Delete Product") },
            text = { Text("Are you sure you want to delete \"${product.name}\"?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteProduct(product.id)
                        productToDelete = null
                    }
                ) {
                    Text("Delete", color = ErrorRed)
                }
            },
            dismissButton = {
                TextButton(onClick = { productToDelete = null }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun ProductCard(
    product: ShopProduct,
    onClick: () -> Unit,
    onDelete: () -> Unit,
    onToggleAvailability: () -> Unit
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
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Product Image
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(GlassWhite),
                contentAlignment = Alignment.Center
            ) {
                if (product.mainImage != null) {
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data(product.mainImage)
                            .crossfade(true)
                            .build(),
                        contentDescription = product.name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.Inventory,
                        contentDescription = null,
                        tint = WhiteTextMuted,
                        modifier = Modifier.size(32.dp)
                    )
                }
            }
            
            Spacer(modifier = Modifier.width(12.dp))
            
            // Product Info
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = product.name,
                        style = MaterialTheme.typography.titleSmall,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    if (!product.isAvailable) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = ErrorRed.copy(alpha = 0.2f)
                        ) {
                            Text(
                                text = "Unavailable",
                                style = MaterialTheme.typography.labelSmall,
                                color = ErrorRed,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                }
                if (product.category != null) {
                    Text(
                        text = product.category,
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = product.displayPrice,
                        style = MaterialTheme.typography.bodyMedium,
                        color = ShopGreen,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Stock: ${product.stock ?: 0}",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (product.isLowStock) WarningYellow else WhiteTextMuted
                    )
                }
            }
            
            // Actions
            Column {
                IconButton(onClick = onToggleAvailability) {
                    Icon(
                        imageVector = if (product.isAvailable) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                        contentDescription = "Toggle availability",
                        tint = if (product.isAvailable) ShopGreen else WhiteTextMuted
                    )
                }
                IconButton(onClick = onDelete) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "Delete",
                        tint = ErrorRed
                    )
                }
            }
        }
    }
}
