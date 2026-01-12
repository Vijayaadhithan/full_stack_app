package com.doorstep.tn.customer.ui.profile

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.auth.ui.AuthViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.customer.ui.CustomerViewModel
import com.doorstep.tn.core.network.UpdateProfileRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * Customer Profile Screen - matches web app's profile.tsx
 * Features: Full form, address fields, verification status
 * Uses same PATCH /api/users/{id} API as web
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    authViewModel: AuthViewModel = hiltViewModel(),
    customerViewModel: CustomerViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToReviews: () -> Unit,
    onLogout: () -> Unit
) {
    val user by authViewModel.user.collectAsState()
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }
    
    // Form state - initialized from user data (syncs with web)
    var name by remember(user) { mutableStateOf(user?.name ?: "") }
    var phone by remember(user) { mutableStateOf(user?.phone ?: "") }
    var email by remember(user) { mutableStateOf(user?.email ?: "") }
    var upiId by remember(user) { mutableStateOf(user?.upiId ?: "") }
    var addressStreet by remember(user) { mutableStateOf(user?.addressStreet ?: "") }
    var addressCity by remember(user) { mutableStateOf(user?.addressCity ?: "") }
    var addressState by remember(user) { mutableStateOf(user?.addressState ?: "") }
    var addressPostalCode by remember(user) { mutableStateOf(user?.addressPostalCode ?: "") }
    var addressCountry by remember(user) { mutableStateOf(user?.addressCountry ?: "India") }
    var addressLandmark by remember(user) { mutableStateOf(user?.addressLandmark ?: "") }

    val upiSuggestions = remember(upiId) { buildUpiSuggestions(upiId) }
    
    var isLoading by remember { mutableStateOf(false) }
    
    // GPS Location state
    val context = LocalContext.current
    var capturedLatitude by remember(user) { mutableStateOf(user?.latitude?.toDoubleOrNull()) }
    var capturedLongitude by remember(user) { mutableStateOf(user?.longitude?.toDoubleOrNull()) }
    var isCapturingLocation by remember { mutableStateOf(false) }
    
    // Location permission launcher
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineLocationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarseLocationGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        
        if (fineLocationGranted || coarseLocationGranted) {
            // Permission granted, capture location
            captureLocation(
                context = context,
                onSuccess = { lat, lng ->
                    capturedLatitude = lat
                    capturedLongitude = lng
                    isCapturingLocation = false
                    scope.launch {
                        snackbarHostState.showSnackbar("Location captured successfully!")
                    }
                },
                onError = { error ->
                    isCapturingLocation = false
                    scope.launch {
                        snackbarHostState.showSnackbar("Error: $error")
                    }
                }
            )
        } else {
            isCapturingLocation = false
            scope.launch {
                snackbarHostState.showSnackbar("Location permission denied")
            }
        }
    }
    
    // Function to request location
    fun requestLocation() {
        isCapturingLocation = true
        
        // Check if permission is already granted
        val hasFineLocation = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        
        val hasCoarseLocation = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        
        if (hasFineLocation || hasCoarseLocation) {
            // Permission already granted, capture location
            captureLocation(
                context = context,
                onSuccess = { lat, lng ->
                    capturedLatitude = lat
                    capturedLongitude = lng
                    isCapturingLocation = false
                    scope.launch {
                        snackbarHostState.showSnackbar("Location captured successfully!")
                    }
                },
                onError = { error ->
                    isCapturingLocation = false
                    scope.launch {
                        snackbarHostState.showSnackbar("Error: $error")
                    }
                }
            )
        } else {
            // Request permission
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Profile Settings", color = WhiteText) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = WhiteText
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SlateBackground)
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = SlateDarker
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            // Profile Header
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = SlateCard)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .clip(CircleShape)
                            .background(OrangePrimary.copy(alpha = 0.2f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = null,
                            tint = OrangePrimary,
                            modifier = Modifier.size(40.dp)
                        )
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = user?.name ?: "Customer",
                        style = MaterialTheme.typography.titleLarge,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    
                    // Verification Status
                    val verificationStatus = user?.verificationStatus
                    if (verificationStatus != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        val statusColor = when (verificationStatus) {
                            "verified" -> SuccessGreen
                            "pending" -> WarningYellow
                            else -> ErrorRed
                        }
                        val statusIcon = when (verificationStatus) {
                            "verified" -> Icons.Default.CheckCircle
                            "pending" -> Icons.Default.Schedule
                            else -> Icons.Default.Warning
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = statusIcon,
                                contentDescription = null,
                                tint = statusColor,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = verificationStatus.replaceFirstChar { c -> c.uppercase() },
                                color = statusColor,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                    
                    // Profile Completeness
                    val completeness = user?.profileCompleteness
                    if (completeness != null) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Column(modifier = Modifier.fillMaxWidth()) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Profile Completeness", color = WhiteTextMuted, style = MaterialTheme.typography.bodySmall)
                                Text("$completeness%", color = WhiteText, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            LinearProgressIndicator(
                                progress = { completeness.toFloat() / 100f },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(6.dp)
                                    .clip(RoundedCornerShape(3.dp)),
                                color = OrangePrimary,
                                trackColor = GlassWhite
                            )
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Profile Information Form
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = SlateCard)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Profile Information",
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Name
                    ProfileTextField(
                        label = "Full Name",
                        value = name,
                        onValueChange = { name = it },
                        icon = Icons.Default.Person
                    )
                    
                    // Phone
                    ProfileTextField(
                        label = "Phone Number",
                        value = phone,
                        onValueChange = { phone = it },
                        icon = Icons.Default.Phone,
                        keyboardType = KeyboardType.Phone
                    )
                    
                    // Email
                    ProfileTextField(
                        label = "Email (Optional)",
                        value = email,
                        onValueChange = { email = it },
                        icon = Icons.Default.Email,
                        keyboardType = KeyboardType.Email
                    )
                    
                    // UPI ID
                    ProfileTextField(
                        label = "UPI ID (for payments)",
                        value = upiId,
                        onValueChange = { upiId = it },
                        icon = Icons.Default.Payment,
                        placeholder = "yourname@upi"
                    )
                    if (upiSuggestions.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Suggested UPI IDs",
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteTextMuted
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            upiSuggestions.forEach { suggestion ->
                                AssistChip(
                                    onClick = { upiId = suggestion },
                                    label = { Text(suggestion) },
                                    colors = AssistChipDefaults.assistChipColors(
                                        containerColor = SlateBackground,
                                        labelColor = WhiteText
                                    ),
                                    border = BorderStroke(1.dp, GlassBorder)
                                )
                            }
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Address Section
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = SlateCard)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.LocationOn, null, tint = OrangePrimary)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Address Details",
                            style = MaterialTheme.typography.titleMedium,
                            color = WhiteText,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    ProfileTextField(
                        label = "Street Address",
                        value = addressStreet,
                        onValueChange = { addressStreet = it },
                        placeholder = "Door No, Street Name"
                    )
                    
                    Row(modifier = Modifier.fillMaxWidth()) {
                        ProfileTextField(
                            label = "City/Village",
                            value = addressCity,
                            onValueChange = { addressCity = it },
                            modifier = Modifier.weight(1f)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        ProfileDropdownField(
                            label = "State",
                            value = addressState,
                            onValueChange = { addressState = it },
                            options = indiaStates,
                            placeholder = "Select state",
                            modifier = Modifier.weight(1f)
                        )
                    }
                    
                    Row(modifier = Modifier.fillMaxWidth()) {
                        ProfileTextField(
                            label = "Postal Code",
                            value = addressPostalCode,
                            onValueChange = { addressPostalCode = it },
                            modifier = Modifier.weight(1f),
                            keyboardType = KeyboardType.Number
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        ProfileDropdownField(
                            label = "Country",
                            value = addressCountry,
                            onValueChange = { addressCountry = it },
                            options = countryOptions,
                            placeholder = "Select country",
                            modifier = Modifier.weight(1f)
                        )
                    }
                    
                    ProfileTextField(
                        label = "Landmark",
                        value = addressLandmark,
                        onValueChange = { addressLandmark = it },
                        placeholder = "Opposite to Government School, Blue House",
                        singleLine = false,
                        maxLines = 2
                    )
                    Text(
                        text = "Use a nearby landmark locals recognize",
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // GPS Location Section
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = SlateCard)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.MyLocation, null, tint = ProviderBlue)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "GPS Pin",
                            style = MaterialTheme.typography.titleMedium,
                            color = WhiteText,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Drop a pin with your phone GPS so shops can find you faster.",
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                    
                    // Show saved or captured location
                    val hasLocation = capturedLatitude != null && capturedLongitude != null
                    if (hasLocation) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(SuccessGreen.copy(alpha = 0.1f), RoundedCornerShape(8.dp))
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.CheckCircle, null, tint = SuccessGreen)
                            Spacer(modifier = Modifier.width(8.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Location Captured", color = SuccessGreen, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                                Text(
                                    "${String.format("%.6f", capturedLatitude)}, ${String.format("%.6f", capturedLongitude)}", 
                                    color = WhiteTextMuted, 
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                            // Clear location button
                            IconButton(onClick = { 
                                capturedLatitude = null
                                capturedLongitude = null
                            }) {
                                Icon(Icons.Default.Close, "Clear", tint = WhiteTextMuted)
                            }
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    // Capture Location Button
                    Button(
                        onClick = { requestLocation() },
                        enabled = !isCapturingLocation,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = ProviderBlue,
                            contentColor = WhiteText
                        )
                    ) {
                        if (isCapturingLocation) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                                color = WhiteText
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Capturing...")
                        } else {
                            Icon(Icons.Default.MyLocation, null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(if (hasLocation) "Update Location" else "Capture My Location")
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Save Button - calls PATCH /api/users/{id} like web
            Button(
                onClick = { 
                    isLoading = true
                    val userId = user?.id ?: return@Button
                    scope.launch {
                        customerViewModel.updateProfile(
                            userId = userId,
                            request = UpdateProfileRequest(
                                name = name.takeIf { it.isNotBlank() },
                                phone = phone.takeIf { it.isNotBlank() },
                                email = email.takeIf { it.isNotBlank() },
                                upiId = upiId.takeIf { it.isNotBlank() },
                                addressStreet = addressStreet.takeIf { it.isNotBlank() },
                                addressCity = addressCity.takeIf { it.isNotBlank() },
                                addressState = addressState.takeIf { it.isNotBlank() },
                                addressPostalCode = addressPostalCode.takeIf { it.isNotBlank() },
                                addressCountry = addressCountry.takeIf { it.isNotBlank() },
                                addressLandmark = addressLandmark.takeIf { it.isNotBlank() },
                                latitude = capturedLatitude?.let { String.format(Locale.US, "%.7f", it) },
                                longitude = capturedLongitude?.let { String.format(Locale.US, "%.7f", it) }
                            ),
                            onSuccess = {
                                isLoading = false
                                scope.launch {
                                    snackbarHostState.showSnackbar("Profile updated successfully!")
                                }
                            },
                            onError = { errorMessage ->
                                isLoading = false
                                scope.launch {
                                    snackbarHostState.showSnackbar("Error: $errorMessage")
                                }
                            }
                        )
                    }
                },
                enabled = !isLoading,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary)
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = WhiteText,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("Save Changes", fontWeight = FontWeight.Bold)
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // My Reviews Button
            OutlinedButton(
                onClick = onNavigateToReviews,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = OrangePrimary),
                border = BorderStroke(1.dp, OrangePrimary)
            ) {
                Icon(Icons.Default.RateReview, null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("My Reviews")
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Logout Button
            OutlinedButton(
                onClick = onLogout,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = ErrorRed),
                border = BorderStroke(1.dp, ErrorRed)
            ) {
                Icon(Icons.AutoMirrored.Filled.Logout, null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Logout")
            }
            
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
private fun ProfileTextField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    placeholder: String? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    singleLine: Boolean = true,
    maxLines: Int = 1
) {
    Column(modifier = modifier.padding(vertical = 6.dp)) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = WhiteTextMuted
        )
        Spacer(modifier = Modifier.height(4.dp))
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = placeholder?.let { { Text(it, color = WhiteTextMuted.copy(alpha = 0.5f)) } },
            leadingIcon = icon?.let { { Icon(it, null, tint = WhiteTextMuted) } },
            singleLine = singleLine,
            maxLines = maxLines,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = WhiteText,
                unfocusedTextColor = WhiteText,
                focusedBorderColor = OrangePrimary,
                unfocusedBorderColor = GlassWhite,
                focusedContainerColor = SlateBackground,
                unfocusedContainerColor = SlateBackground
            ),
            shape = RoundedCornerShape(10.dp)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProfileDropdownField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    options: List<String>,
    modifier: Modifier = Modifier,
    placeholder: String? = null
) {
    var expanded by remember { mutableStateOf(false) }

    Column(modifier = modifier.padding(vertical = 6.dp)) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = WhiteTextMuted
        )
        Spacer(modifier = Modifier.height(4.dp))
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = !expanded }
        ) {
            OutlinedTextField(
                value = value,
                onValueChange = {},
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                readOnly = true,
                placeholder = placeholder?.let {
                    { Text(it, color = WhiteTextMuted.copy(alpha = 0.5f)) }
                },
                trailingIcon = {
                    ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded)
                },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = WhiteText,
                    unfocusedTextColor = WhiteText,
                    focusedBorderColor = OrangePrimary,
                    unfocusedBorderColor = GlassWhite,
                    focusedContainerColor = SlateBackground,
                    unfocusedContainerColor = SlateBackground
                ),
                shape = RoundedCornerShape(10.dp)
            )
            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
                modifier = Modifier.background(SlateCard)
            ) {
                options.forEach { option ->
                    DropdownMenuItem(
                        text = {
                            Text(
                                text = option,
                                color = if (option == value) OrangePrimary else WhiteText
                            )
                        },
                        onClick = {
                            onValueChange(option)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}

private val indiaStates = listOf(
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Andaman and Nicobar Islands",
    "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Jammu and Kashmir",
    "Ladakh",
    "Lakshadweep",
    "Puducherry"
)

private val countryOptions = listOf("India")

private val upiHandles = listOf(
    "@upi",
    "@ybl",
    "@ibl",
    "@okicici",
    "@okhdfcbank",
    "@oksbi",
    "@axl",
    "@paytm",
    "@apl"
)

private fun buildUpiSuggestions(input: String): List<String> {
    val trimmed = input.trim()
    if (trimmed.isEmpty() || trimmed.contains("@")) {
        return emptyList()
    }

    val digits = trimmed.filter { it.isDigit() }
    if (digits.length != 10) {
        return emptyList()
    }

    return upiHandles.map { handle -> "$digits$handle" }
}

/**
 * Helper function to capture the current location using FusedLocationProviderClient
 */
@SuppressLint("MissingPermission")
private fun captureLocation(
    context: android.content.Context,
    onSuccess: (Double, Double) -> Unit,
    onError: (String) -> Unit
) {
    try {
        val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
        val cancellationToken = CancellationTokenSource()
        
        fusedLocationClient.getCurrentLocation(
            Priority.PRIORITY_HIGH_ACCURACY,
            cancellationToken.token
        ).addOnSuccessListener { location ->
            if (location != null) {
                onSuccess(location.latitude, location.longitude)
            } else {
                onError("Unable to get current location. Please try again.")
            }
        }.addOnFailureListener { exception ->
            onError(exception.message ?: "Failed to get location")
        }
    } catch (e: Exception) {
        onError(e.message ?: "Location capture failed")
    }
}
