package com.doorstep.tn.shop.ui

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
import com.doorstep.tn.auth.ui.AuthViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.shop.data.model.CreatePromotionRequest
import com.doorstep.tn.shop.data.model.ShopPromotion
import com.doorstep.tn.shop.data.model.UpdatePromotionRequest

/**
 * Shop Promotions Management Screen
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShopPromotionsScreen(
    viewModel: ShopViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val authViewModel: AuthViewModel = hiltViewModel()
    val user by authViewModel.user.collectAsState()
    val promotions by viewModel.promotions.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()
    
    var showAddDialog by remember { mutableStateOf(false) }
    var promotionToEdit by remember { mutableStateOf<ShopPromotion?>(null) }
    var promotionToDelete by remember { mutableStateOf<ShopPromotion?>(null) }
    val shopOwnerId = user?.id
    
    val snackbarHostState = remember { SnackbarHostState() }
    
    LaunchedEffect(shopOwnerId) {
        shopOwnerId?.let { viewModel.loadPromotions(it) }
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
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Promotions",
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
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddDialog = true },
                containerColor = ShopGreen
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = "Add Promotion",
                    tint = WhiteText
                )
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = SlateDarker
    ) { paddingValues ->
        if (isLoading && promotions.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = ShopGreen)
            }
        } else if (promotions.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Default.LocalOffer,
                        contentDescription = null,
                        tint = WhiteTextMuted,
                        modifier = Modifier.size(64.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("No promotions yet", color = WhiteTextMuted)
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = { showAddDialog = true },
                        colors = ButtonDefaults.buttonColors(containerColor = ShopGreen)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Create Promotion")
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(promotions) { promotion ->
                    PromotionCard(
                        promotion = promotion,
                        onToggleStatus = { viewModel.togglePromotionStatus(promotion.id, !promotion.isActive) },
                        onEdit = { promotionToEdit = promotion },
                        onDelete = { promotionToDelete = promotion }
                    )
                }
            }
        }
    }
    
    if (showAddDialog) {
        PromotionFormDialog(
            shopId = shopOwnerId,
            onDismiss = { showAddDialog = false },
            onConfirm = { request ->
                viewModel.createPromotion(request) {
                    showAddDialog = false
                }
            }
        )
    }

    promotionToEdit?.let { promotion ->
        PromotionFormDialog(
            shopId = shopOwnerId,
            initialPromotion = promotion,
            onDismiss = { promotionToEdit = null },
            onConfirmEdit = { request, promotionId ->
                viewModel.updatePromotion(promotionId, request) {
                    promotionToEdit = null
                }
            }
        )
    }
    
    promotionToDelete?.let { promotion ->
        AlertDialog(
            onDismissRequest = { promotionToDelete = null },
            title = { Text("Delete Promotion") },
            text = { Text("Delete \"${promotion.name}\"?") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deletePromotion(promotion.id)
                    promotionToDelete = null
                }) {
                    Text("Delete", color = ErrorRed)
                }
            },
            dismissButton = {
                TextButton(onClick = { promotionToDelete = null }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun PromotionCard(
    promotion: ShopPromotion,
    onToggleStatus: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
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
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = promotion.name,
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    if (promotion.description != null) {
                        Text(
                            text = promotion.description,
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteTextMuted
                        )
                    }
                }
                Switch(
                    checked = promotion.isActive,
                    onCheckedChange = { onToggleStatus() },
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = WhiteText,
                        checkedTrackColor = ShopGreen
                    )
                )
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Discount value
                Column {
                    Text("Discount", style = MaterialTheme.typography.labelSmall, color = WhiteTextMuted)
                    Text(
                        text = if (promotion.type == "percentage") 
                            "${promotion.value.toInt()}%" 
                        else 
                            "₹${promotion.value.toInt()}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = ShopGreen,
                        fontWeight = FontWeight.Bold
                    )
                }
                
                // Code
                if (promotion.code != null) {
                    Column {
                        Text("Code", style = MaterialTheme.typography.labelSmall, color = WhiteTextMuted)
                        Text(
                            text = promotion.code,
                            style = MaterialTheme.typography.bodyMedium,
                            color = OrangePrimary,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
                
                // Uses
                if (promotion.usageLimit != null) {
                    Column {
                        Text("Uses", style = MaterialTheme.typography.labelSmall, color = WhiteTextMuted)
                        Text(
                            text = "${promotion.usedCount ?: 0}/${promotion.usageLimit}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = WhiteText
                        )
                    }
                }
                
                Spacer(modifier = Modifier.weight(1f))
                
                IconButton(onClick = onEdit) {
                    Icon(
                        imageVector = Icons.Default.Edit,
                        contentDescription = "Edit",
                        tint = WhiteText
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PromotionFormDialog(
    shopId: Int?,
    initialPromotion: ShopPromotion? = null,
    onDismiss: () -> Unit,
    onConfirm: (CreatePromotionRequest) -> Unit = {},
    onConfirmEdit: (UpdatePromotionRequest, Int) -> Unit = { _, _ -> }
) {
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var discountType by remember { mutableStateOf("percentage") }
    var discountValue by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var usageLimit by remember { mutableStateOf("") }
    var expiryDays by remember { mutableStateOf("") }
    val isEditMode = initialPromotion != null

    LaunchedEffect(initialPromotion) {
        initialPromotion?.let { promo ->
            name = promo.name
            description = promo.description ?: ""
            discountType = promo.type
            discountValue = promo.value.toString()
            code = promo.code ?: ""
            usageLimit = promo.usageLimit?.toString() ?: ""
            expiryDays = ""
            if (!promo.startDate.isNullOrBlank() && !promo.endDate.isNullOrBlank()) {
                runCatching {
                    val start = java.time.Instant.parse(promo.startDate)
                    val end = java.time.Instant.parse(promo.endDate)
                    val days = java.time.Duration.between(start, end).toDays().toInt()
                    if (days > 0) expiryDays = days.toString()
                }
            }
        }
    }
    
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (isEditMode) "Edit Promotion" else "Create Promotion") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name *") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = discountType == "percentage",
                        onClick = { discountType = "percentage" },
                        label = { Text("Percentage") }
                    )
                    FilterChip(
                        selected = discountType == "fixed_amount",
                        onClick = { discountType = "fixed_amount" },
                        label = { Text("Fixed Amount") }
                    )
                }
                
                OutlinedTextField(
                    value = discountValue,
                    onValueChange = { discountValue = it },
                    label = { Text(if (discountType == "percentage") "Discount % *" else "Amount ₹ *") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                
                OutlinedTextField(
                    value = code,
                    onValueChange = { code = it.uppercase() },
                    label = { Text("Promo Code") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                
                OutlinedTextField(
                    value = usageLimit,
                    onValueChange = { usageLimit = it },
                    label = { Text("Usage Limit") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                
                OutlinedTextField(
                    value = expiryDays,
                    onValueChange = { expiryDays = it },
                    label = { Text("Expiry Days") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description") },
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (name.isNotBlank() && discountValue.isNotBlank() && shopId != null) {
                        val expiryValue = expiryDays.toIntOrNull()
                        if (isEditMode && initialPromotion != null) {
                            val updateRequest = UpdatePromotionRequest(
                                name = name.trim(),
                                description = description.ifBlank { null },
                                type = discountType,
                                value = discountValue.toDoubleOrNull() ?: 0.0,
                                code = code.ifBlank { null },
                                usageLimit = usageLimit.toIntOrNull(),
                                expiryDays = expiryValue
                            )
                            onConfirmEdit(updateRequest, initialPromotion.id)
                        } else {
                            val createRequest = CreatePromotionRequest(
                                name = name.trim(),
                                description = description.ifBlank { null },
                                type = discountType,
                                value = discountValue.toDoubleOrNull() ?: 0.0,
                                code = code.ifBlank { null },
                                usageLimit = usageLimit.toIntOrNull(),
                                isActive = true,
                                shopId = shopId,
                                expiryDays = expiryValue ?: 0
                            )
                            onConfirm(createRequest)
                        }
                    }
                },
                enabled = name.isNotBlank() && discountValue.isNotBlank() && shopId != null
            ) {
                Text(if (isEditMode) "Update" else "Create")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
