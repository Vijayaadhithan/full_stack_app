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
    "Beauty & Wellness" to "Beauty & Wellness",
    "Home Services" to "Home Services",
    "Professional Services" to "Professional Services",
    "Health & Fitness" to "Health & Fitness",
    "Education & Training" to "Education & Training"
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

    var searchTerm by remember { mutableStateOf("") }
    var categoryFilter by remember { mutableStateOf("all") }

    val serviceMetrics = remember(services) {
        val total = services.size
        val online = services.count { it.isAvailable && it.isAvailableNow != false }
        val categories = services.mapNotNull { it.category }.toSet().size
        ServiceMetrics(
            total = total,
            online = online,
            paused = total - online,
            categories = categories
        )
    }

    val categoryOptions = remember(services) {
        val options = SERVICE_CATEGORIES.toMutableList()
        services.mapNotNull { it.category }
            .distinct()
            .filter { category -> options.none { it.second.equals(category, ignoreCase = true) } }
            .forEach { category ->
                options.add(category to category)
            }
        options
    }

    val categoryLabelMap = remember(categoryOptions) {
        categoryOptions.associate { it.second to it.first }
    }

    val filteredServices = remember(services, searchTerm, categoryFilter) {
        val trimmed = searchTerm.trim()
        services.filter { service ->
            val matchesSearch = trimmed.isBlank() ||
                listOf(service.name, service.description, service.category)
                    .filterNotNull()
                    .any { it.contains(trimmed, ignoreCase = true) }
            val matchesCategory = categoryFilter == "all" || service.category == categoryFilter
            matchesSearch && matchesCategory
        }
    }
    
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
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    ServiceMetricsGrid(metrics = serviceMetrics)
                }

                item {
                    ServiceFilters(
                        searchTerm = searchTerm,
                        categoryFilter = categoryFilter,
                        categoryOptions = categoryOptions,
                        onSearchTermChange = { searchTerm = it },
                        onCategorySelected = { categoryFilter = it }
                    )
                }

                if (filteredServices.isEmpty()) {
                    item {
                        val hasFilters = searchTerm.isNotBlank() || categoryFilter != "all"
                        val hasServices = services.isNotEmpty()
                        EmptyServicesState(
                            showAction = !hasServices,
                            message = when {
                                !hasServices -> "No services yet. Add your first service to get bookings."
                                hasFilters -> "No services match these filters."
                                else -> "No services yet."
                            },
                            onAddService = {
                                editingService = null
                                showAddEditDialog = true
                            }
                        )
                    }
                } else {
                    items(filteredServices) { service ->
                        ServiceCard(
                            service = service,
                            categoryLabel = categoryLabelMap[service.category] ?: service.category ?: "Other",
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
                            isAvailable = request.isAvailable,
                            isAvailableNow = request.isAvailableNow,
                            availabilityNote = request.availabilityNote
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

private data class ServiceMetrics(
    val total: Int,
    val online: Int,
    val paused: Int,
    val categories: Int
)

@Composable
private fun ServiceMetricsGrid(metrics: ServiceMetrics) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text = "Services Overview",
            style = MaterialTheme.typography.titleMedium,
            color = WhiteText,
            fontWeight = FontWeight.Bold
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            ServiceMetricCard(
                title = "Total services",
                value = metrics.total.toString(),
                highlightColor = WhiteTextMuted,
                modifier = Modifier.weight(1f)
            )
            ServiceMetricCard(
                title = "Online today",
                value = metrics.online.toString(),
                highlightColor = SuccessGreen,
                modifier = Modifier.weight(1f)
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            ServiceMetricCard(
                title = "Paused services",
                value = metrics.paused.toString(),
                highlightColor = WarningYellow,
                modifier = Modifier.weight(1f)
            )
            ServiceMetricCard(
                title = "Categories",
                value = metrics.categories.toString(),
                highlightColor = ProviderBlue,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun ServiceMetricCard(
    title: String,
    value: String,
    highlightColor: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodySmall,
                color = WhiteTextMuted
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                color = highlightColor,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ServiceFilters(
    searchTerm: String,
    categoryFilter: String,
    categoryOptions: List<Pair<String, String>>,
    onSearchTermChange: (String) -> Unit,
    onCategorySelected: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedLabel = if (categoryFilter == "all") {
        "All categories"
    } else {
        categoryOptions.find { it.second == categoryFilter }?.first ?: categoryFilter
    }

    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedTextField(
                value = searchTerm,
                onValueChange = onSearchTermChange,
                label = { Text("Search services") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = ProviderBlue,
                    unfocusedBorderColor = GlassBorder,
                    focusedTextColor = WhiteText,
                    unfocusedTextColor = WhiteText
                )
            )

            ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = it }
            ) {
                OutlinedTextField(
                    value = selectedLabel,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Category filter") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = ProviderBlue,
                        unfocusedBorderColor = GlassBorder,
                        focusedTextColor = WhiteText,
                        unfocusedTextColor = WhiteText
                    )
                )
                ExposedDropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    DropdownMenuItem(
                        text = { Text("All categories") },
                        onClick = {
                            onCategorySelected("all")
                            expanded = false
                        }
                    )
                    categoryOptions.forEach { (label, value) ->
                        DropdownMenuItem(
                            text = { Text(label) },
                            onClick = {
                                onCategorySelected(value)
                                expanded = false
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyServicesState(
    message: String,
    showAction: Boolean,
    onAddService: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Build,
                contentDescription = null,
                tint = WhiteTextMuted,
                modifier = Modifier.size(48.dp)
            )
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = WhiteTextMuted
            )
            if (showAction) {
                Button(
                    onClick = onAddService,
                    colors = ButtonDefaults.buttonColors(containerColor = ProviderBlue)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Add service")
                }
            }
        }
    }
}

@Composable
private fun ServiceCard(
    service: ProviderService,
    categoryLabel: String?,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onToggleAvailability: (Boolean) -> Unit
) {
    val isOnline = service.isAvailable && service.isAvailableNow != false
    val locationLabel = if (service.serviceLocationType == "provider_location") {
        "Provider location"
    } else {
        "Customer location"
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
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = ProviderBlue.copy(alpha = 0.2f)
                    ) {
                        Text(
                            text = categoryLabel ?: "Other",
                            style = MaterialTheme.typography.labelSmall,
                            color = ProviderBlue,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                        )
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
                        text = if (isOnline) "Online" else "Paused",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (isOnline) SuccessGreen else ErrorRed
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

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Location: $locationLabel",
                style = MaterialTheme.typography.bodySmall,
                color = WhiteTextMuted
            )

            if (!service.availabilityNote.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = service.availabilityNote,
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextSubtle
                )
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
    var selectedCategory by remember {
        mutableStateOf(service?.category ?: SERVICE_CATEGORIES.firstOrNull()?.second ?: "")
    }
    var price by remember { mutableStateOf(service?.price ?: "") }
    var duration by remember { mutableStateOf((service?.duration ?: 30).toString()) }
    var locationType by remember { mutableStateOf(service?.serviceLocationType ?: "customer_location") }
    var isAvailable by remember { mutableStateOf(service?.isAvailable ?: true) }
    var isAvailableNow by remember { mutableStateOf(service?.isAvailableNow ?: true) }
    var availabilityNote by remember { mutableStateOf(service?.availabilityNote ?: "") }

    var activeTab by remember { mutableStateOf("basic") }
    
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
                    .heightIn(max = 420.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                TabRow(
                    selectedTabIndex = if (activeTab == "basic") 0 else 1,
                    containerColor = SlateBackground,
                    contentColor = ProviderBlue
                ) {
                    Tab(
                        selected = activeTab == "basic",
                        onClick = { activeTab = "basic" },
                        text = { Text("Basic") }
                    )
                    Tab(
                        selected = activeTab == "availability",
                        onClick = { activeTab = "availability" },
                        text = { Text("Availability") }
                    )
                }

                when (activeTab) {
                    "availability" -> {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Available now", color = WhiteTextMuted)
                                Switch(
                                    checked = isAvailableNow,
                                    onCheckedChange = { isAvailableNow = it },
                                    colors = SwitchDefaults.colors(
                                        checkedThumbColor = WhiteText,
                                        checkedTrackColor = ProviderBlue
                                    )
                                )
                            }

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Accepting new bookings", color = WhiteTextMuted)
                                Switch(
                                    checked = isAvailable,
                                    onCheckedChange = { isAvailable = it },
                                    colors = SwitchDefaults.colors(
                                        checkedThumbColor = WhiteText,
                                        checkedTrackColor = SuccessGreen
                                    )
                                )
                            }

                            OutlinedTextField(
                                value = availabilityNote,
                                onValueChange = { availabilityNote = it },
                                label = { Text("Availability note (optional)") },
                                modifier = Modifier.fillMaxWidth(),
                                maxLines = 3,
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = ProviderBlue,
                                    unfocusedBorderColor = GlassBorder
                                )
                            )
                        }
                    }
                    else -> {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
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

                            ExposedDropdownMenuBox(
                                expanded = categoryExpanded,
                                onExpandedChange = { categoryExpanded = it }
                            ) {
                                OutlinedTextField(
                                    value = SERVICE_CATEGORIES.find { it.second == selectedCategory }?.first
                                        ?: selectedCategory.ifBlank { "Select" },
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
                        }
                    }
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
                            isAvailable = isAvailable,
                            isAvailableNow = isAvailableNow,
                            availabilityNote = availabilityNote.ifBlank { null }
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
