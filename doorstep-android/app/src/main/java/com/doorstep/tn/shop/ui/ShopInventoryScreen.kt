package com.doorstep.tn.shop.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.launch
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.shop.data.model.ShopProduct
import com.doorstep.tn.shop.data.model.UpdateProductRequest

/**
 * Shop Inventory Management Screen for stock control
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShopInventoryScreen(
    viewModel: ShopViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val products by viewModel.products.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()
    
    var searchQuery by remember { mutableStateOf("") }
    var showLowStockOnly by remember { mutableStateOf(false) }
    var stockDrafts by remember { mutableStateOf<Map<Int, String>>(emptyMap()) }
    
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    
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
    
    val filteredProducts = products.filter { product ->
        val matchesSearch = searchQuery.isEmpty() || 
            product.name.contains(searchQuery, ignoreCase = true)
        val matchesFilter = !showLowStockOnly || product.isLowStock
        matchesSearch && matchesFilter
    }

    fun updateStockDraft(productId: Int, value: String) {
        stockDrafts = stockDrafts + (productId to value)
    }

    fun handleSaveStock(product: ShopProduct) {
        val current = product.stock?.toString() ?: ""
        val draft = (stockDrafts[product.id] ?: current).trim()
        if (draft == current) return
        val nextStock = if (draft.isBlank()) null else draft.toIntOrNull()
        if (draft.isNotBlank() && (nextStock == null || nextStock < 0)) {
            scope.launch {
                snackbarHostState.showSnackbar("Enter a valid stock (0 or more), or leave blank.")
            }
            return
        }
        viewModel.updateProduct(product.id, UpdateProductRequest(stock = nextStock)) {
            stockDrafts = stockDrafts - product.id
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Inventory",
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
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = SlateDarker
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Search and Filter
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
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
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = ShopGreen,
                        unfocusedBorderColor = SlateCard,
                        focusedContainerColor = SlateCard,
                        unfocusedContainerColor = SlateCard
                    ),
                    singleLine = true
                )
                
                FilterChip(
                    selected = showLowStockOnly,
                    onClick = { showLowStockOnly = !showLowStockOnly },
                    label = { Text("Low Stock") },
                    leadingIcon = if (showLowStockOnly) {
                        {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    } else null,
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = WarningYellow,
                        selectedLabelColor = SlateDarker
                    )
                )
            }
            
            // Stats Summary
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                val totalProducts = products.size
                val lowStockCount = products.count { it.isLowStock }
                val outOfStockCount = products.count { (it.stock ?: 0) <= 0 }
                
                StatChip(
                    label = "Total",
                    value = "$totalProducts",
                    color = ProviderBlue
                )
                StatChip(
                    label = "Low",
                    value = "$lowStockCount",
                    color = WarningYellow
                )
                StatChip(
                    label = "Out",
                    value = "$outOfStockCount",
                    color = ErrorRed
                )
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
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
                    Text(
                        text = if (showLowStockOnly) "No low stock items" else "No products found",
                        color = WhiteTextMuted
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(filteredProducts) { product ->
                        val draft = stockDrafts[product.id] ?: (product.stock?.toString() ?: "")
                        InventoryItemCard(
                            product = product,
                            stockDraft = draft,
                            onStockChange = { updateStockDraft(product.id, it) },
                            onSaveStock = { handleSaveStock(product) },
                            onToggleAvailability = {
                                viewModel.updateProduct(
                                    product.id,
                                    UpdateProductRequest(isAvailable = !product.isAvailable)
                                )
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StatChip(
    label: String,
    value: String,
    color: androidx.compose.ui.graphics.Color
) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = color.copy(alpha = 0.2f)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = color
            )
            Text(
                text = value,
                style = MaterialTheme.typography.labelMedium,
                color = color,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun InventoryItemCard(
    product: ShopProduct,
    stockDraft: String,
    onStockChange: (String) -> Unit,
    onSaveStock: () -> Unit,
    onToggleAvailability: () -> Unit
) {
    val stockColor = when {
        (product.stock ?: 0) <= 0 -> ErrorRed
        product.isLowStock -> WarningYellow
        else -> ShopGreen
    }
    
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
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .background(stockColor.copy(alpha = 0.2f), RoundedCornerShape(8.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = product.stock?.toString() ?: "—",
                        style = MaterialTheme.typography.titleMedium,
                        color = stockColor,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = product.name,
                        style = MaterialTheme.typography.titleSmall,
                        color = WhiteText,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = "SKU: ${product.sku ?: "N/A"}",
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                    Text(
                        text = product.displayPrice,
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                    if (product.isLowStock) {
                        Text(
                            text = "Low stock",
                            style = MaterialTheme.typography.labelSmall,
                            color = WarningYellow
                        )
                    }
                }

                Column(horizontalAlignment = Alignment.End) {
                    val availabilityLabel = if (product.isAvailable) "Have it" else "Finished"
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = if (product.isAvailable) ShopGreen.copy(alpha = 0.15f) else SlateBackground
                    ) {
                        Text(
                            text = availabilityLabel,
                            style = MaterialTheme.typography.labelSmall,
                            color = if (product.isAvailable) ShopGreen else WhiteTextMuted,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    Switch(
                        checked = product.isAvailable,
                        onCheckedChange = { onToggleAvailability() },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = WhiteText,
                            checkedTrackColor = ShopGreen,
                            uncheckedThumbColor = WhiteText,
                            uncheckedTrackColor = SlateCard
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "Exact stock count (leave blank to disable tracking)",
                style = MaterialTheme.typography.bodySmall,
                color = WhiteTextMuted
            )
            Spacer(modifier = Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = stockDraft,
                    onValueChange = { onStockChange(it.filter { c -> c.isDigit() }) },
                    label = { Text("Stock") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.weight(1f)
                )
                val current = product.stock?.toString() ?: ""
                val isDirty = stockDraft.trim() != current
                Button(
                    onClick = onSaveStock,
                    enabled = isDirty,
                    colors = ButtonDefaults.buttonColors(containerColor = ShopGreen)
                ) {
                    Text("Save")
                }
            }
        }
    }
}
