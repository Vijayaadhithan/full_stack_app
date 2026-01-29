package com.doorstep.tn.shop.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.shop.data.model.AddWorkerRequest
import com.doorstep.tn.shop.data.model.ShopWorker
import com.doorstep.tn.shop.data.model.UpdateWorkerRequest
import com.doorstep.tn.shop.data.repository.Result

/**
 * Shop Workers Management Screen
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ShopWorkersScreen(
    viewModel: ShopViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val workers by viewModel.workers.collectAsState()
    val responsibilities by viewModel.workerResponsibilities.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()

    var showAddDialog by remember { mutableStateOf(false) }
    var workerToEdit by remember { mutableStateOf<ShopWorker?>(null) }
    var workerToResetPin by remember { mutableStateOf<ShopWorker?>(null) }
    var workerToRemove by remember { mutableStateOf<ShopWorker?>(null) }

    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) {
        viewModel.loadWorkers()
        viewModel.loadWorkerResponsibilities()
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
                        text = "Workers",
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
                    IconButton(onClick = { viewModel.loadWorkers() }) {
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
                onClick = { showAddDialog = true },
                containerColor = ShopGreen
            ) {
                Icon(
                    imageVector = Icons.Default.PersonAdd,
                    contentDescription = "Add Worker",
                    tint = WhiteText
                )
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = SlateDarker
    ) { paddingValues ->
        if (isLoading && workers.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = ShopGreen)
            }
        } else if (workers.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Default.People,
                        contentDescription = null,
                        tint = WhiteTextMuted,
                        modifier = Modifier.size(64.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("No workers yet", color = WhiteTextMuted)
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = { showAddDialog = true },
                        colors = ButtonDefaults.buttonColors(containerColor = ShopGreen)
                    ) {
                        Icon(Icons.Default.PersonAdd, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Add Worker")
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
                items(workers) { worker ->
                    WorkerCard(
                        worker = worker,
                        onToggleStatus = { viewModel.toggleWorkerStatus(worker.id, !worker.active) },
                        onEdit = { workerToEdit = worker },
                        onResetPin = { workerToResetPin = worker },
                        onRemove = { workerToRemove = worker }
                    )
                }
            }
        }
    }

    if (showAddDialog) {
        AddWorkerDialog(
            availableResponsibilities = responsibilities?.all ?: emptyList(),
            presets = responsibilities?.presets ?: emptyMap(),
            checkWorkerNumber = { workerNumber -> viewModel.checkWorkerNumber(workerNumber) },
            onDismiss = { showAddDialog = false },
            onConfirm = { request ->
                viewModel.addWorker(request) {
                    showAddDialog = false
                }
            }
        )
    }

    workerToEdit?.let { worker ->
        EditWorkerDialog(
            worker = worker,
            availableResponsibilities = responsibilities?.all ?: emptyList(),
            presets = responsibilities?.presets ?: emptyMap(),
            onDismiss = { workerToEdit = null },
            onConfirm = { request ->
                viewModel.updateWorker(worker.id, request) {
                    workerToEdit = null
                }
            }
        )
    }

    workerToResetPin?.let { worker ->
        ResetPinDialog(
            workerName = worker.name ?: "Worker",
            onDismiss = { workerToResetPin = null },
            onConfirm = { pin ->
                viewModel.updateWorker(worker.id, UpdateWorkerRequest(pin = pin)) {
                    workerToResetPin = null
                }
            }
        )
    }

    workerToRemove?.let { worker ->
        AlertDialog(
            onDismissRequest = { workerToRemove = null },
            title = { Text("Remove Worker") },
            text = { Text("Remove ${worker.name ?: "Worker"} from your shop?") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.removeWorker(worker.id)
                    workerToRemove = null
                }) {
                    Text("Remove", color = ErrorRed)
                }
            },
            dismissButton = {
                TextButton(onClick = { workerToRemove = null }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun WorkerCard(
    worker: ShopWorker,
    onToggleStatus: () -> Unit,
    onEdit: () -> Unit,
    onResetPin: () -> Unit,
    onRemove: () -> Unit
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
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(ProviderBlue, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = (worker.name ?: "W").take(1).uppercase(),
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = worker.name ?: "Unknown",
                            style = MaterialTheme.typography.titleSmall,
                            color = WhiteText,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        if (!worker.active) {
                            Surface(
                                shape = RoundedCornerShape(4.dp),
                                color = ErrorRed.copy(alpha = 0.2f)
                            ) {
                                Text(
                                    text = "Inactive",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = ErrorRed,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                    }

                    val workerNumber = worker.workerNumber?.takeIf { it.isNotBlank() }
                    Text(
                        text = "Worker ID: ${workerNumber ?: "Not set"}",
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )

                    worker.phone?.takeIf { it.isNotBlank() }?.let {
                        Text(
                            text = it,
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteTextMuted
                        )
                    }
                    worker.email?.takeIf { it.isNotBlank() }?.let {
                        Text(
                            text = it,
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteTextMuted
                        )
                    }
                }

                Switch(
                    checked = worker.active,
                    onCheckedChange = { onToggleStatus() },
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = WhiteText,
                        checkedTrackColor = ShopGreen
                    )
                )
            }

            if (worker.responsibilities.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    worker.responsibilities.forEach { resp ->
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = ProviderBlue.copy(alpha = 0.2f)
                        ) {
                            Text(
                                text = resp,
                                style = MaterialTheme.typography.labelSmall,
                                color = ProviderBlue,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onEdit) {
                    Icon(Icons.Default.Edit, contentDescription = "Edit", tint = WhiteText)
                }
                IconButton(onClick = onResetPin) {
                    Icon(Icons.Default.Lock, contentDescription = "Reset PIN", tint = WarningYellow)
                }
                IconButton(onClick = onRemove) {
                    Icon(Icons.Default.PersonRemove, contentDescription = "Remove", tint = ErrorRed)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddWorkerDialog(
    availableResponsibilities: List<String>,
    presets: Map<String, List<String>>,
    checkWorkerNumber: suspend (String) -> Result<Map<String, Any>>,
    onDismiss: () -> Unit,
    onConfirm: (AddWorkerRequest) -> Unit
) {
    var workerNumber by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var pin by remember { mutableStateOf("") }
    var selectedResponsibilities by remember { mutableStateOf(setOf<String>()) }
    var selectedPreset by remember { mutableStateOf("") }
    var isCheckingNumber by remember { mutableStateOf(false) }
    var isNumberAvailable by remember { mutableStateOf<Boolean?>(null) }

    val sanitizedNumber = workerNumber.filter { it.isDigit() }.take(10)

    LaunchedEffect(sanitizedNumber) {
        if (sanitizedNumber.length == 10) {
            isCheckingNumber = true
            when (val result = checkWorkerNumber(sanitizedNumber)) {
                is Result.Success -> {
                    val available = result.data["available"] as? Boolean
                    isNumberAvailable = available
                }
                is Result.Error -> {
                    isNumberAvailable = null
                }
            }
            isCheckingNumber = false
        } else {
            isNumberAvailable = null
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Worker") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = workerNumber,
                    onValueChange = { workerNumber = it.filter { c -> c.isDigit() }.take(10) },
                    label = { Text("10-Digit Worker Number *") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )
                if (sanitizedNumber.length == 10) {
                    val statusText = when {
                        isCheckingNumber -> "Checking availability…"
                        isNumberAvailable == true -> "Available"
                        isNumberAvailable == false -> "Already taken"
                        else -> ""
                    }
                    if (statusText.isNotBlank()) {
                        Text(
                            text = statusText,
                            color = when (isNumberAvailable) {
                                true -> ShopGreen
                                false -> ErrorRed
                                else -> WhiteTextMuted
                            },
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Full Name *") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email (optional)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it.filter { c -> c.isDigit() }.take(10) },
                    label = { Text("Phone (optional)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = pin,
                    onValueChange = { pin = it.filter { c -> c.isDigit() }.take(4) },
                    label = { Text("4-Digit PIN *") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    modifier = Modifier.fillMaxWidth()
                )

                if (presets.isNotEmpty()) {
                    var expanded by remember { mutableStateOf(false) }
                    ExposedDropdownMenuBox(
                        expanded = expanded,
                        onExpandedChange = { expanded = !expanded }
                    ) {
                        OutlinedTextField(
                            value = selectedPreset,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Preset (optional)") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                        )
                        ExposedDropdownMenu(
                            expanded = expanded,
                            onDismissRequest = { expanded = false },
                            modifier = Modifier.background(SlateCard)
                        ) {
                            presets.keys.forEach { preset ->
                                DropdownMenuItem(
                                    text = { Text(preset, color = if (preset == selectedPreset) ShopGreen else WhiteText) },
                                    onClick = {
                                        selectedPreset = preset
                                        selectedResponsibilities = presets[preset]?.toSet() ?: emptySet()
                                        expanded = false
                                    }
                                )
                            }
                        }
                    }
                }

                if (availableResponsibilities.isNotEmpty()) {
                    Text(
                        text = "Responsibilities",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Column {
                        availableResponsibilities.forEach { resp ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(
                                    checked = resp in selectedResponsibilities,
                                    onCheckedChange = {
                                        selectedResponsibilities = if (it) {
                                            selectedResponsibilities + resp
                                        } else {
                                            selectedResponsibilities - resp
                                        }
                                    }
                                )
                                Text(text = resp, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            val canSubmit = sanitizedNumber.length == 10 &&
                name.isNotBlank() &&
                pin.length == 4 &&
                (isNumberAvailable != false)
            TextButton(
                onClick = {
                    if (canSubmit) {
                        onConfirm(
                            AddWorkerRequest(
                                workerNumber = sanitizedNumber,
                                name = name.trim(),
                                email = email.trim().ifBlank { null },
                                phone = phone.trim().ifBlank { null },
                                pin = pin,
                                responsibilities = selectedResponsibilities.toList()
                            )
                        )
                    }
                },
                enabled = canSubmit
            ) {
                Text("Add")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EditWorkerDialog(
    worker: ShopWorker,
    availableResponsibilities: List<String>,
    presets: Map<String, List<String>>,
    onDismiss: () -> Unit,
    onConfirm: (UpdateWorkerRequest) -> Unit
) {
    var name by remember { mutableStateOf(worker.name ?: "") }
    var email by remember { mutableStateOf(worker.email ?: "") }
    var phone by remember { mutableStateOf(worker.phone ?: "") }
    var selectedResponsibilities by remember { mutableStateOf(worker.responsibilities.toSet()) }
    var selectedPreset by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Edit Worker") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Full Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it.filter { c -> c.isDigit() }.take(10) },
                    label = { Text("Phone") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    modifier = Modifier.fillMaxWidth()
                )

                if (presets.isNotEmpty()) {
                    var expanded by remember { mutableStateOf(false) }
                    ExposedDropdownMenuBox(
                        expanded = expanded,
                        onExpandedChange = { expanded = !expanded }
                    ) {
                        OutlinedTextField(
                            value = selectedPreset,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Preset (optional)") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                        )
                        ExposedDropdownMenu(
                            expanded = expanded,
                            onDismissRequest = { expanded = false },
                            modifier = Modifier.background(SlateCard)
                        ) {
                            presets.keys.forEach { preset ->
                                DropdownMenuItem(
                                    text = { Text(preset, color = if (preset == selectedPreset) ShopGreen else WhiteText) },
                                    onClick = {
                                        selectedPreset = preset
                                        selectedResponsibilities = presets[preset]?.toSet() ?: emptySet()
                                        expanded = false
                                    }
                                )
                            }
                        }
                    }
                }

                if (availableResponsibilities.isNotEmpty()) {
                    Text(
                        text = "Responsibilities",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Column {
                        availableResponsibilities.forEach { resp ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(
                                    checked = resp in selectedResponsibilities,
                                    onCheckedChange = {
                                        selectedResponsibilities = if (it) {
                                            selectedResponsibilities + resp
                                        } else {
                                            selectedResponsibilities - resp
                                        }
                                    }
                                )
                                Text(text = resp, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onConfirm(
                        UpdateWorkerRequest(
                            name = name.trim().ifBlank { null },
                            email = email.trim().ifBlank { null },
                            phone = phone.trim().ifBlank { null },
                            responsibilities = selectedResponsibilities.toList()
                        )
                    )
                }
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ResetPinDialog(
    workerName: String,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var pin by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Reset PIN") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Set a new 4-digit PIN for $workerName")
                OutlinedTextField(
                    value = pin,
                    onValueChange = { pin = it.filter { c -> c.isDigit() }.take(4) },
                    label = { Text("New PIN") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(pin) },
                enabled = pin.length == 4
            ) {
                Text("Update")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
