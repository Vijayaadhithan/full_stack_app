package com.doorstep.tn.shop.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
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
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.shop.data.model.CreateProductRequest
import com.doorstep.tn.shop.data.model.ShopProduct
import com.doorstep.tn.shop.data.model.UpdateProductRequest

/**
 * Product Add/Edit Screen - Unified screen for creating and editing products
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShopProductEditScreen(
    viewModel: ShopViewModel = hiltViewModel(),
    productId: Int? = null, // null = add mode, non-null = edit mode
    onNavigateBack: () -> Unit,
    onSuccess: () -> Unit = {}
) {
    val products by viewModel.products.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()
    
    val isEditMode = productId != null
    val existingProduct = if (isEditMode) products.find { it.id == productId } else null
    
    // Form state
    var name by remember(existingProduct) { mutableStateOf(existingProduct?.name ?: "") }
    var description by remember(existingProduct) { mutableStateOf(existingProduct?.description ?: "") }
    var category by remember(existingProduct) { mutableStateOf(existingProduct?.category ?: "") }
    var price by remember(existingProduct) { mutableStateOf(existingProduct?.price ?: "") }
    var mrp by remember(existingProduct) { mutableStateOf(existingProduct?.mrp ?: "") }
    var stock by remember(existingProduct) { mutableStateOf(existingProduct?.stock?.toString() ?: "0") }
    var lowStockThreshold by remember(existingProduct) { mutableStateOf(existingProduct?.lowStockThreshold?.toString() ?: "10") }
    var weight by remember(existingProduct) { mutableStateOf(existingProduct?.weight ?: "") }
    var sku by remember(existingProduct) { mutableStateOf(existingProduct?.sku ?: "") }
    var barcode by remember(existingProduct) { mutableStateOf(existingProduct?.barcode ?: "") }
    var dimensionLength by remember(existingProduct) { mutableStateOf(existingProduct?.dimensions?.length?.toString() ?: "") }
    var dimensionWidth by remember(existingProduct) { mutableStateOf(existingProduct?.dimensions?.width?.toString() ?: "") }
    var dimensionHeight by remember(existingProduct) { mutableStateOf(existingProduct?.dimensions?.height?.toString() ?: "") }
    var specifications by remember(existingProduct) { mutableStateOf(existingProduct?.specifications ?: emptyMap()) }
    var specKey by remember { mutableStateOf("") }
    var specValue by remember { mutableStateOf("") }
    var isAvailable by remember(existingProduct) { mutableStateOf(existingProduct?.isAvailable ?: true) }
    var minOrderQuantity by remember(existingProduct) { mutableStateOf(existingProduct?.minOrderQuantity?.toString() ?: "1") }
    var maxOrderQuantity by remember(existingProduct) { mutableStateOf(existingProduct?.maxOrderQuantity?.toString() ?: "") }
    var tags by remember(existingProduct) { mutableStateOf(existingProduct?.tags?.joinToString(", ") ?: "") }
    
    val snackbarHostState = remember { SnackbarHostState() }
    
    // Load products if editing
    LaunchedEffect(productId) {
        if (isEditMode && products.isEmpty()) {
            viewModel.loadProducts()
        }
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
    
    fun saveProduct() {
        if (name.isBlank() || category.isBlank() || price.isBlank()) return
        
        if (isEditMode && productId != null) {
            val dimensions = if (dimensionLength.isNotBlank() || dimensionWidth.isNotBlank() || dimensionHeight.isNotBlank()) {
                com.doorstep.tn.shop.data.model.ProductDimensions(
                    length = dimensionLength.toDoubleOrNull(),
                    width = dimensionWidth.toDoubleOrNull(),
                    height = dimensionHeight.toDoubleOrNull()
                )
            } else null
            viewModel.updateProduct(
                productId = productId,
                request = UpdateProductRequest(
                    name = name.trim(),
                    description = description.ifBlank { null },
                    category = category.trim(),
                    price = price.trim(),
                    mrp = mrp.ifBlank { null },
                    stock = stock.toIntOrNull() ?: 0,
                    lowStockThreshold = lowStockThreshold.toIntOrNull(),
                    weight = weight.toDoubleOrNull(),
                    dimensions = dimensions,
                    sku = sku.ifBlank { null },
                    barcode = barcode.ifBlank { null },
                    specifications = specifications.ifEmpty { null },
                    isAvailable = isAvailable,
                    tags = tags.split(",").map { it.trim() }.filter { it.isNotEmpty() },
                    minOrderQuantity = minOrderQuantity.toIntOrNull() ?: 1,
                    maxOrderQuantity = maxOrderQuantity.toIntOrNull()
                ),
                onSuccess = {
                    onSuccess()
                    onNavigateBack()
                }
            )
        } else {
            val dimensions = if (dimensionLength.isNotBlank() || dimensionWidth.isNotBlank() || dimensionHeight.isNotBlank()) {
                com.doorstep.tn.shop.data.model.ProductDimensions(
                    length = dimensionLength.toDoubleOrNull(),
                    width = dimensionWidth.toDoubleOrNull(),
                    height = dimensionHeight.toDoubleOrNull()
                )
            } else null
            viewModel.createProduct(
                request = CreateProductRequest(
                    name = name.trim(),
                    description = description.ifBlank { null },
                    category = category.trim(),
                    price = price.trim(),
                    mrp = mrp.ifBlank { null },
                    stock = stock.toIntOrNull() ?: 0,
                    lowStockThreshold = lowStockThreshold.toIntOrNull(),
                    weight = weight.toDoubleOrNull(),
                    dimensions = dimensions,
                    sku = sku.ifBlank { null },
                    barcode = barcode.ifBlank { null },
                    specifications = specifications.ifEmpty { null },
                    isAvailable = isAvailable,
                    tags = tags.split(",").map { it.trim() }.filter { it.isNotEmpty() },
                    minOrderQuantity = minOrderQuantity.toIntOrNull() ?: 1,
                    maxOrderQuantity = maxOrderQuantity.toIntOrNull()
                ),
                onSuccess = {
                    onSuccess()
                    onNavigateBack()
                }
            )
        }
    }
    
    val isFormValid = name.isNotBlank() && category.isNotBlank() && price.isNotBlank()
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = if (isEditMode) "Edit Product" else "Add Product",
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
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = SlateBackground
                )
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = SlateDarker,
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { saveProduct() },
                containerColor = ShopGreen,
                contentColor = WhiteText,
                icon = { Icon(Icons.Default.Check, contentDescription = null) },
                text = { Text(if (isEditMode) "Update" else "Save") }
            )
        }
    ) { paddingValues ->
        if (isLoading && isEditMode && existingProduct == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = ShopGreen)
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Basic Info Section
                SectionCard(title = "Basic Information") {
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("Product Name *") },
                        singleLine = true,
                        isError = name.isBlank(),
                        modifier = Modifier.fillMaxWidth()
                    )
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    OutlinedTextField(
                        value = description,
                        onValueChange = { description = it },
                        label = { Text("Description") },
                        minLines = 3,
                        maxLines = 5,
                        modifier = Modifier.fillMaxWidth()
                    )
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    OutlinedTextField(
                        value = category,
                        onValueChange = { category = it },
                        label = { Text("Category *") },
                        singleLine = true,
                        isError = category.isBlank(),
                        modifier = Modifier.fillMaxWidth()
                    )
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    OutlinedTextField(
                        value = tags,
                        onValueChange = { tags = it },
                        label = { Text("Tags (comma separated)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                
                // Pricing Section
                SectionCard(title = "Pricing") {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedTextField(
                            value = price,
                            onValueChange = { price = it.filter { c -> c.isDigit() || c == '.' } },
                            label = { Text("Price (₹) *") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            isError = price.isBlank(),
                            modifier = Modifier.weight(1f)
                        )
                        
                        OutlinedTextField(
                            value = mrp,
                            onValueChange = { mrp = it.filter { c -> c.isDigit() || c == '.' } },
                            label = { Text("MRP (₹)") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
                
                // Inventory Section
                SectionCard(title = "Inventory") {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedTextField(
                            value = stock,
                            onValueChange = { stock = it.filter { c -> c.isDigit() } },
                            label = { Text("Stock") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.weight(1f)
                        )
                        
                        OutlinedTextField(
                            value = lowStockThreshold,
                            onValueChange = { lowStockThreshold = it.filter { c -> c.isDigit() } },
                            label = { Text("Low Stock Alert") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.weight(1f)
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Available for sale",
                            style = MaterialTheme.typography.bodyMedium,
                            color = WhiteText
                        )
                        Switch(
                            checked = isAvailable,
                            onCheckedChange = { isAvailable = it },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = WhiteText,
                                checkedTrackColor = ShopGreen
                            )
                        )
                    }
                }

                // Identifiers Section
                SectionCard(title = "Identifiers") {
                    OutlinedTextField(
                        value = sku,
                        onValueChange = { sku = it },
                        label = { Text("SKU") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    OutlinedTextField(
                        value = barcode,
                        onValueChange = { barcode = it },
                        label = { Text("Barcode") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                // Dimensions & Specifications Section
                SectionCard(title = "Dimensions & Specs") {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedTextField(
                            value = dimensionLength,
                            onValueChange = { dimensionLength = it.filter { c -> c.isDigit() || c == '.' } },
                            label = { Text("Length (cm)") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = dimensionWidth,
                            onValueChange = { dimensionWidth = it.filter { c -> c.isDigit() || c == '.' } },
                            label = { Text("Width (cm)") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = dimensionHeight,
                            onValueChange = { dimensionHeight = it.filter { c -> c.isDigit() || c == '.' } },
                            label = { Text("Height (cm)") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.weight(1f)
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = specKey,
                            onValueChange = { specKey = it },
                            label = { Text("Spec Key") },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = specValue,
                            onValueChange = { specValue = it },
                            label = { Text("Spec Value") },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        IconButton(
                            onClick = {
                                val key = specKey.trim()
                                val value = specValue.trim()
                                if (key.isNotEmpty() && value.isNotEmpty()) {
                                    specifications = specifications + (key to value)
                                    specKey = ""
                                    specValue = ""
                                }
                            }
                        ) {
                            Icon(Icons.Default.Add, contentDescription = "Add Spec", tint = ShopGreen)
                        }
                    }
                    
                    if (specifications.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        specifications.forEach { (key, value) ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "$key: $value",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = WhiteText
                                )
                                IconButton(onClick = { specifications = specifications - key }) {
                                    Icon(
                                        imageVector = Icons.Default.Close,
                                        contentDescription = "Remove",
                                        tint = ErrorRed
                                    )
                                }
                            }
                        }
                    }
                }
                
                // Weight & Quantity Section
                SectionCard(title = "Weight & Quantity") {
                    OutlinedTextField(
                        value = weight,
                        onValueChange = { weight = it.filter { c -> c.isDigit() || c == '.' } },
                        label = { Text("Weight (kg)") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.fillMaxWidth()
                    )
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedTextField(
                            value = minOrderQuantity,
                            onValueChange = { minOrderQuantity = it.filter { c -> c.isDigit() } },
                            label = { Text("Min Order Qty") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.weight(1f)
                        )
                        
                        OutlinedTextField(
                            value = maxOrderQuantity,
                            onValueChange = { maxOrderQuantity = it.filter { c -> c.isDigit() } },
                            label = { Text("Max Order Qty") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
                
                // Spacer for FAB
                Spacer(modifier = Modifier.height(80.dp))
            }
        }
    }
}

@Composable
private fun SectionCard(
    title: String,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = WhiteText,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(12.dp))
            content()
        }
    }
}
