package com.doorstep.tn.provider.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.provider.data.model.CreateServiceRequest
import com.doorstep.tn.provider.data.model.ProviderService
import com.doorstep.tn.provider.data.model.UpdateServiceRequest

/**
 * Service categories matching web implementation
 */
val SERVICE_CATEGORIES = listOf(
    "Air Conditioning" to "ac",
    "Plumbing" to "plumbing",
    "Electrical" to "electrical",
    "Appliance Repair" to "appliance",
    "Cleaning" to "cleaning",
    "Pest Control" to "pest_control",
    "Carpentry" to "carpentry",
    "Painting" to "painting",
    "Home Repair" to "home_repair",
    "Gardening" to "gardening",
    "Vehicle Service" to "vehicle",
    "Beauty & Wellness" to "beauty",
    "Other" to "other"
)

/**
 * Provider Services Screen - List and manage services
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProviderServicesScreen(
    viewModel: ProviderViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val services by viewModel.services.collectAsState()
    val isLoading by viewModel.isLoadingServices.collectAsState()
    val error by viewModel.error.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()
    
    // State for add/edit dialog
    var showAddEditDialog by remember { mutableStateOf(false) }
    var editingService by remember { mutableStateOf<ProviderService?>(null) }
    
    // State for delete confirmation
    var showDeleteDialog by remember { mutableStateOf(false) }
    var serviceToDelete by remember { mutableStateOf<ProviderService?>(null) }
    
    val snackbarHostState = remember { SnackbarHostState() }
    
    LaunchedEffect(successMessage) {
        successMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearSuccessMessage()
        }
    }
    
    LaunchedEffect(error) {
        error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }
    
    // Load services on start
    LaunchedEffect(Unit) {
        viewModel.loadProviderServices()
    }
    
    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { 
                    Text(
                        "My Services",
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    ) 
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
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
                onClick = {
                    editingService = null
                    showAddEditDialog = true
                },
                containerColor = ProviderBlue
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add Service", tint = WhiteText)
            }
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
                CircularProgressIndicator(color = ProviderBlue)
            }
        } else if (services.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Default.Build,
                        contentDescription = null,
                        tint = WhiteTextMuted,
                        modifier = Modifier.size(64.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        "No services yet",
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText
                    )
                    Text(
                        "Tap + to add your first service",
                        style = MaterialTheme.typography.bodyMedium,
                        color = WhiteTextMuted
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(services) { service ->
                    ServiceCard(
                        service = service,
                        onEdit = {
                            editingService = service
                            showAddEditDialog = true
                        },
                        onDelete = {
                            serviceToDelete = service
                            showDeleteDialog = true
                        },
                        onToggleAvailability = { isAvailable ->
                            viewModel.toggleServiceAvailability(service.id, isAvailable)
                        }
                    )
                }
            }
        }
    }
    
    // Add/Edit Service Dialog
    if (showAddEditDialog) {
        AddEditServiceDialog(
            service = editingService,
            onDismiss = { showAddEditDialog = false },
            onSave = { request ->
                if (editingService != null) {
                    viewModel.updateService(
                        editingService!!.id,
                        UpdateServiceRequest(
                            name = request.name,
                            description = request.description,
                            category = request.category,
                            price = request.price,
                            duration = request.duration,
                            serviceLocationType = request.serviceLocationType,
                            isAvailable = request.isAvailable
                        )
                    ) {
                        showAddEditDialog = false
                    }
                } else {
                    viewModel.createService(request) {
                        showAddEditDialog = false
                    }
                }
            }
        )
    }
    
    // Delete Confirmation Dialog
    if (showDeleteDialog && serviceToDelete != null) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Delete Service", color = WhiteText) },
            text = { 
                Text(
                    "Are you sure you want to delete \"${serviceToDelete?.name}\"? This action cannot be undone.",
                    color = WhiteTextMuted
                ) 
            },
            confirmButton = {
                Button(
                    onClick = {
                        serviceToDelete?.let { viewModel.deleteService(it.id) }
                        showDeleteDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ErrorRed)
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) {
                    Text("Cancel", color = WhiteTextMuted)
                }
            },
            containerColor = SlateCard
        )
    }
}

@Composable
private fun ServiceCard(
    service: ProviderService,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onToggleAvailability: (Boolean) -> Unit
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
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = service.name,
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    service.category?.let { category ->
                        val displayName = SERVICE_CATEGORIES.find { it.second == category }?.first ?: category
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = ProviderBlue.copy(alpha = 0.2f)
                        ) {
                            Text(
                                text = displayName,
                                style = MaterialTheme.typography.labelSmall,
                                color = ProviderBlue,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                            )
                        }
                    }
                }
                
                Text(
                    text = "₹${service.price ?: "0"}",
                    style = MaterialTheme.typography.titleLarge,
                    color = SuccessGreen,
                    fontWeight = FontWeight.Bold
                )
            }
            
            service.description?.let { desc ->
                if (desc.isNotBlank()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = desc,
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Schedule,
                        contentDescription = null,
                        tint = WhiteTextMuted,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "${service.duration ?: 30} min",
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                }
                
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = if (service.isAvailable) "Available" else "Unavailable",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (service.isAvailable) SuccessGreen else ErrorRed
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Switch(
                        checked = service.isAvailable,
                        onCheckedChange = onToggleAvailability,
                        modifier = Modifier.height(24.dp),
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = WhiteText,
                            checkedTrackColor = SuccessGreen,
                            uncheckedThumbColor = WhiteText,
                            uncheckedTrackColor = SlateCard
                        )
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                TextButton(onClick = onDelete) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = null,
                        tint = ErrorRed,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Delete", color = ErrorRed)
                }
                Spacer(modifier = Modifier.width(8.dp))
                Button(
                    onClick = onEdit,
                    colors = ButtonDefaults.buttonColors(containerColor = ProviderBlue)
                ) {
                    Icon(
                        imageVector = Icons.Default.Edit,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Edit")
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddEditServiceDialog(
    service: ProviderService?,
    onDismiss: () -> Unit,
    onSave: (CreateServiceRequest) -> Unit
) {
    val isEditing = service != null
    
    var name by remember { mutableStateOf(service?.name ?: "") }
    var description by remember { mutableStateOf(service?.description ?: "") }
    var selectedCategory by remember { mutableStateOf(service?.category ?: "other") }
    var price by remember { mutableStateOf(service?.price ?: "") }
    var duration by remember { mutableStateOf((service?.duration ?: 30).toString()) }
    var locationType by remember { mutableStateOf(service?.serviceLocationType ?: "customer_location") }
    var isAvailable by remember { mutableStateOf(service?.isAvailable ?: true) }
    
    var categoryExpanded by remember { mutableStateOf(false) }
    var locationExpanded by remember { mutableStateOf(false) }
    
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = if (isEditing) "Edit Service" else "Add New Service",
                color = WhiteText,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 400.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Service Name *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = ProviderBlue,
                        unfocusedBorderColor = GlassBorder
                    )
                )
                
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description") },
                    modifier = Modifier.fillMaxWidth(),
                    maxLines = 3,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = ProviderBlue,
                        unfocusedBorderColor = GlassBorder
                    )
                )
                
                // Category Dropdown
                ExposedDropdownMenuBox(
                    expanded = categoryExpanded,
                    onExpandedChange = { categoryExpanded = it }
                ) {
                    OutlinedTextField(
                        value = SERVICE_CATEGORIES.find { it.second == selectedCategory }?.first ?: "Other",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Category *") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = ProviderBlue,
                            unfocusedBorderColor = GlassBorder
                        )
                    )
                    ExposedDropdownMenu(
                        expanded = categoryExpanded,
                        onDismissRequest = { categoryExpanded = false }
                    ) {
                        SERVICE_CATEGORIES.forEach { (displayName, value) ->
                            DropdownMenuItem(
                                text = { Text(displayName) },
                                onClick = {
                                    selectedCategory = value
                                    categoryExpanded = false
                                }
                            )
                        }
                    }
                }
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedTextField(
                        value = price,
                        onValueChange = { price = it.filter { ch -> ch.isDigit() } },
                        label = { Text("Price (₹) *") },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = ProviderBlue,
                            unfocusedBorderColor = GlassBorder
                        )
                    )
                    
                    OutlinedTextField(
                        value = duration,
                        onValueChange = { duration = it.filter { ch -> ch.isDigit() } },
                        label = { Text("Duration (min)") },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = ProviderBlue,
                            unfocusedBorderColor = GlassBorder
                        )
                    )
                }
                
                // Location Type Dropdown
                ExposedDropdownMenuBox(
                    expanded = locationExpanded,
                    onExpandedChange = { locationExpanded = it }
                ) {
                    OutlinedTextField(
                        value = if (locationType == "customer_location") "Customer's Location" else "My Location",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Service Location") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = locationExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = ProviderBlue,
                            unfocusedBorderColor = GlassBorder
                        )
                    )
                    ExposedDropdownMenu(
                        expanded = locationExpanded,
                        onDismissRequest = { locationExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Customer's Location") },
                            onClick = {
                                locationType = "customer_location"
                                locationExpanded = false
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("My Location") },
                            onClick = {
                                locationType = "provider_location"
                                locationExpanded = false
                            }
                        )
                    }
                }
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Available for booking", color = WhiteTextMuted)
                    Switch(
                        checked = isAvailable,
                        onCheckedChange = { isAvailable = it },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = WhiteText,
                            checkedTrackColor = SuccessGreen
                        )
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank() && price.isNotBlank()) {
                        onSave(CreateServiceRequest(
                            name = name.trim(),
                            description = description.ifBlank { null },
                            category = selectedCategory,
                            price = price,
                            duration = duration.toIntOrNull() ?: 30,
                            serviceLocationType = locationType,
                            isAvailable = isAvailable
                        ))
                    }
                },
                enabled = name.isNotBlank() && price.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = ProviderBlue)
            ) {
                Text(if (isEditing) "Update" else "Create")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = WhiteTextMuted)
            }
        },
        containerColor = SlateCard
    )
}
