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
 * Uses PATCH /api/users/{id} for profile fields and /api/profile/location for GPS pin
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    authViewModel: AuthViewModel = hiltViewModel(),
    customerViewModel: CustomerViewModel = hiltViewModel(),
    profileTitle: String = "Profile Settings",
    reviewsLabel: String = "My Reviews",
    onNavigateBack: () -> Unit,
    onNavigateToReviews: () -> Unit,
    onSwitchRole: ((String) -> Unit)? = null,  // Optional callback for role switching
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
    var profileBio by remember(user) { mutableStateOf(user?.bio ?: "") }
    var profileQualifications by remember(user) { mutableStateOf(user?.qualifications ?: "") }
    var profileExperience by remember(user) { mutableStateOf(user?.experience ?: "") }
    var profileWorkingHours by remember(user) { mutableStateOf(user?.workingHours ?: "") }
    var profileLanguages by remember(user) { mutableStateOf(user?.languages ?: "") }

    val upiSuggestions = remember(upiId) { buildUpiSuggestions(upiId) }
    
    var isLoading by remember { mutableStateOf(false) }

    var showCreateShopDialog by remember { mutableStateOf(false) }
    var showCreateProviderDialog by remember { mutableStateOf(false) }
    var shopName by remember { mutableStateOf("") }
    var shopDescription by remember { mutableStateOf("") }
    var providerBio by remember { mutableStateOf("") }
    var isCreatingShop by remember { mutableStateOf(false) }
    var isCreatingProvider by remember { mutableStateOf(false) }
    
    // GPS Location state
    val context = LocalContext.current
    var capturedLatitude by remember(user) { mutableStateOf(user?.latitude?.toDoubleOrNull()) }
    var capturedLongitude by remember(user) { mutableStateOf(user?.longitude?.toDoubleOrNull()) }
    var isCapturingLocation by remember { mutableStateOf(false) }
    var isSavingLocation by remember { mutableStateOf(false) }
    
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
                title = { Text(profileTitle, color = WhiteText) },
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

                    Spacer(modifier = Modifier.height(12.dp))

                    Button(
                        onClick = {
                            val lat = capturedLatitude
                            val lng = capturedLongitude
                            if (lat == null || lng == null) {
                                scope.launch {
                                    snackbarHostState.showSnackbar("Capture a location before saving.")
                                }
                                return@Button
                            }
                            isSavingLocation = true
                            customerViewModel.updateProfileLocation(
                                latitude = String.format(Locale.US, "%.7f", lat),
                                longitude = String.format(Locale.US, "%.7f", lng),
                                onSuccess = {
                                    isSavingLocation = false
                                    scope.launch {
                                        snackbarHostState.showSnackbar("Location saved successfully!")
                                    }
                                },
                                onError = { errorMessage ->
                                    isSavingLocation = false
                                    scope.launch {
                                        snackbarHostState.showSnackbar("Error: $errorMessage")
                                    }
                                }
                            )
                        },
                        enabled = hasLocation && !isSavingLocation,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary)
                    ) {
                        if (isSavingLocation) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                                color = WhiteText
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Saving...")
                        } else {
                            Icon(Icons.Default.Check, null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Save Location")
                        }
                    }
                }
            }

            val showProviderSection = user?.role == "provider" || user?.hasProviderProfile == true
            if (showProviderSection) {
                Spacer(modifier = Modifier.height(16.dp))

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Build, null, tint = ProviderBlue)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Provider Details",
                                style = MaterialTheme.typography.titleMedium,
                                color = WhiteText,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(modifier = Modifier.height(12.dp))

                        ProfileTextField(
                            label = "Bio",
                            value = profileBio,
                            onValueChange = { profileBio = it },
                            placeholder = "Tell customers about your services",
                            singleLine = false,
                            maxLines = 3
                        )

                        ProfileTextField(
                            label = "Qualifications",
                            value = profileQualifications,
                            onValueChange = { profileQualifications = it },
                            placeholder = "Certifications or training",
                            singleLine = false,
                            maxLines = 3
                        )

                        ProfileTextField(
                            label = "Experience",
                            value = profileExperience,
                            onValueChange = { profileExperience = it },
                            placeholder = "Years of experience",
                            singleLine = false,
                            maxLines = 2
                        )

                        ProfileTextField(
                            label = "Working Hours",
                            value = profileWorkingHours,
                            onValueChange = { profileWorkingHours = it },
                            placeholder = "Mon-Sat, 9 AM - 6 PM"
                        )

                        ProfileTextField(
                            label = "Languages",
                            value = profileLanguages,
                            onValueChange = { profileLanguages = it },
                            placeholder = "English, Tamil",
                            singleLine = false,
                            maxLines = 2
                        )
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Save Button - calls PATCH /api/users/{id} like web (location saved separately)
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
                                bio = profileBio.takeIf { it.isNotBlank() },
                                qualifications = profileQualifications.takeIf { it.isNotBlank() },
                                experience = profileExperience.takeIf { it.isNotBlank() },
                                workingHours = profileWorkingHours.takeIf { it.isNotBlank() },
                                languages = profileLanguages.takeIf { it.isNotBlank() },
                                addressStreet = addressStreet.takeIf { it.isNotBlank() },
                                addressCity = addressCity.takeIf { it.isNotBlank() },
                                addressState = addressState.takeIf { it.isNotBlank() },
                                addressPostalCode = addressPostalCode.takeIf { it.isNotBlank() },
                                addressCountry = addressCountry.takeIf { it.isNotBlank() },
                                addressLandmark = addressLandmark.takeIf { it.isNotBlank() }
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
                Text(reviewsLabel)
            }
            
            // Role Switching Section (if callback is provided)
            if (onSwitchRole != null) {
                Spacer(modifier = Modifier.height(16.dp))
                
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.SwapHoriz, null, tint = ProviderBlue)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Switch Role",
                                style = MaterialTheme.typography.titleMedium,
                                color = WhiteText,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Change your app role to access different features",
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteTextMuted
                        )
                        
                        Spacer(modifier = Modifier.height(12.dp))
                        
                        val currentRole = user?.role ?: "customer"
                        val hasShopProfile = user?.hasShopProfile == true
                        val hasProviderProfile = user?.hasProviderProfile == true
                        
                        RoleSwitchDropdown(
                            currentRole = currentRole,
                            hasShopProfile = hasShopProfile,
                            hasProviderProfile = hasProviderProfile,
                            onSwitchRole = onSwitchRole,
                            onCreateShop = { showCreateShopDialog = true },
                            onCreateProvider = { showCreateProviderDialog = true }
                        )
                    }
                }
            }

            if (showCreateShopDialog) {
                CreateShopDialog(
                    shopName = shopName,
                    shopDescription = shopDescription,
                    isCreating = isCreatingShop,
                    onShopNameChange = { shopName = it },
                    onShopDescriptionChange = { shopDescription = it },
                    onConfirm = {
                        val trimmedName = shopName.trim()
                        if (trimmedName.isEmpty()) {
                            return@CreateShopDialog
                        }
                        isCreatingShop = true
                        authViewModel.createShopProfile(
                            shopName = trimmedName,
                            description = shopDescription.trim().ifEmpty { null },
                            onSuccess = {
                                isCreatingShop = false
                                showCreateShopDialog = false
                                shopName = ""
                                shopDescription = ""
                                onSwitchRole?.invoke("shop")
                            },
                            onError = { errorMessage ->
                                isCreatingShop = false
                                scope.launch {
                                    snackbarHostState.showSnackbar("Error: $errorMessage")
                                }
                            }
                        )
                    },
                    onDismiss = {
                        if (!isCreatingShop) {
                            showCreateShopDialog = false
                        }
                    }
                )
            }

            if (showCreateProviderDialog) {
                CreateProviderDialog(
                    bio = providerBio,
                    isCreating = isCreatingProvider,
                    onBioChange = { providerBio = it },
                    onConfirm = {
                        isCreatingProvider = true
                        authViewModel.createProviderProfile(
                            bio = providerBio.trim().ifEmpty { null },
                            onSuccess = {
                                isCreatingProvider = false
                                showCreateProviderDialog = false
                                providerBio = ""
                                onSwitchRole?.invoke("provider")
                            },
                            onError = { errorMessage ->
                                isCreatingProvider = false
                                scope.launch {
                                    snackbarHostState.showSnackbar("Error: $errorMessage")
                                }
                            }
                        )
                    },
                    onDismiss = {
                        if (!isCreatingProvider) {
                            showCreateProviderDialog = false
                        }
                    }
                )
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
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Danger Zone - Delete Account (matches web's profile.tsx)
            var showDeleteDialog by remember { mutableStateOf(false) }
            var isDeleting by remember { mutableStateOf(false) }
            
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = SlateCard),
                border = BorderStroke(1.dp, ErrorRed.copy(alpha = 0.3f))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Warning,
                            contentDescription = null,
                            tint = ErrorRed
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Danger Zone",
                            style = MaterialTheme.typography.titleMedium,
                            color = ErrorRed,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    Button(
                        onClick = { showDeleteDialog = true },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = ErrorRed)
                    ) {
                        Icon(Icons.Default.Delete, null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Delete Account", fontWeight = FontWeight.Bold)
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Permanently delete your account and all associated data. This action is irreversible.",
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                }
            }
            
            // Delete Confirmation Dialog
            if (showDeleteDialog) {
                AlertDialog(
                    onDismissRequest = { if (!isDeleting) showDeleteDialog = false },
                    containerColor = SlateCard,
                    title = {
                        Text(
                            "Are you absolutely sure?",
                            color = WhiteText,
                            fontWeight = FontWeight.Bold
                        )
                    },
                    text = {
                        Text(
                            "This action cannot be undone. This will permanently delete your account and remove all your data from our servers.",
                            color = WhiteTextMuted
                        )
                    },
                    confirmButton = {
                        Button(
                            onClick = {
                                isDeleting = true
                                customerViewModel.deleteAccount(
                                    onSuccess = {
                                        isDeleting = false
                                        showDeleteDialog = false
                                        // Logout and navigate to auth screen
                                        onLogout()
                                    },
                                    onError = { errorMessage ->
                                        isDeleting = false
                                        scope.launch {
                                            snackbarHostState.showSnackbar("Error: $errorMessage")
                                        }
                                    }
                                )
                            },
                            enabled = !isDeleting,
                            colors = ButtonDefaults.buttonColors(containerColor = ErrorRed)
                        ) {
                            if (isDeleting) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(18.dp),
                                    strokeWidth = 2.dp,
                                    color = WhiteText
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                            }
                            Text("Yes, delete my account")
                        }
                    },
                    dismissButton = {
                        OutlinedButton(
                            onClick = { showDeleteDialog = false },
                            enabled = !isDeleting
                        ) {
                            Text("Cancel", color = WhiteText)
                        }
                    }
                )
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

private data class RoleOption(
    val key: String,
    val label: String,
    val color: androidx.compose.ui.graphics.Color,
    val icon: ImageVector,
    val available: Boolean
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RoleSwitchDropdown(
    currentRole: String,
    hasShopProfile: Boolean,
    hasProviderProfile: Boolean,
    onSwitchRole: (String) -> Unit,
    onCreateShop: () -> Unit,
    onCreateProvider: () -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    val roles = listOf(
        RoleOption(
            key = "customer",
            label = "Customer",
            color = OrangePrimary,
            icon = Icons.Default.PersonOutline,
            available = true
        ),
        RoleOption(
            key = "shop",
            label = "Shop Owner",
            color = SuccessGreen,
            icon = Icons.Default.Store,
            available = hasShopProfile
        ),
        RoleOption(
            key = "provider",
            label = "Service Provider",
            color = ProviderBlue,
            icon = Icons.Default.Build,
            available = hasProviderProfile
        )
    )

    val selected = roles.find { it.key == currentRole } ?: roles.first()

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it }
    ) {
        OutlinedTextField(
            value = selected.label,
            onValueChange = {},
            readOnly = true,
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(MenuAnchorType.PrimaryNotEditable),
            leadingIcon = {
                Box(
                    modifier = Modifier
                        .size(34.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(selected.color),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = selected.icon,
                        contentDescription = null,
                        tint = WhiteText,
                        modifier = Modifier.size(18.dp)
                    )
                }
            },
            trailingIcon = {
                ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded)
            },
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = WhiteText,
                unfocusedTextColor = WhiteText,
                focusedBorderColor = selected.color,
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
            roles.forEach { role ->
                DropdownMenuItem(
                    text = {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(28.dp)
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(role.color),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = role.icon,
                                    contentDescription = null,
                                    tint = WhiteText,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = role.label,
                                style = MaterialTheme.typography.bodyMedium,
                                color = WhiteText,
                                fontWeight = if (role.key == currentRole) FontWeight.Bold else FontWeight.Normal
                            )
                            if (role.key != "customer" && !role.available) {
                                Spacer(modifier = Modifier.weight(1f))
                                Text(
                                    text = "Create",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = WhiteTextMuted
                                )
                            } else if (role.key == currentRole) {
                                Spacer(modifier = Modifier.weight(1f))
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = null,
                                    tint = role.color,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                    },
                    onClick = {
                        expanded = false
                        when (role.key) {
                            "customer" -> onSwitchRole("customer")
                            "shop" -> if (role.available) onSwitchRole("shop") else onCreateShop()
                            "provider" -> if (role.available) onSwitchRole("provider") else onCreateProvider()
                        }
                    }
                )
            }
        }
    }
}

@Composable
private fun CreateShopDialog(
    shopName: String,
    shopDescription: String,
    isCreating: Boolean,
    onShopNameChange: (String) -> Unit,
    onShopDescriptionChange: (String) -> Unit,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SlateCard,
        title = {
            Text(
                text = "Create Shop Profile",
                color = WhiteText,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column {
                ProfileTextField(
                    label = "Shop Name *",
                    value = shopName,
                    onValueChange = onShopNameChange,
                    placeholder = "Enter your shop name"
                )
                ProfileTextField(
                    label = "Description (Optional)",
                    value = shopDescription,
                    onValueChange = onShopDescriptionChange,
                    placeholder = "What do you sell?",
                    singleLine = false,
                    maxLines = 2
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                enabled = shopName.trim().isNotEmpty() && !isCreating,
                colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen)
            ) {
                if (isCreating) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = WhiteText
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text("Create Shop")
            }
        },
        dismissButton = {
            OutlinedButton(
                onClick = onDismiss,
                enabled = !isCreating
            ) {
                Text("Cancel", color = WhiteText)
            }
        }
    )
}

@Composable
private fun CreateProviderDialog(
    bio: String,
    isCreating: Boolean,
    onBioChange: (String) -> Unit,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SlateCard,
        title = {
            Text(
                text = "Create Provider Profile",
                color = WhiteText,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column {
                ProfileTextField(
                    label = "About You (Optional)",
                    value = bio,
                    onValueChange = onBioChange,
                    placeholder = "Tell customers about your services",
                    singleLine = false,
                    maxLines = 3
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                enabled = !isCreating,
                colors = ButtonDefaults.buttonColors(containerColor = ProviderBlue)
            ) {
                if (isCreating) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = WhiteText
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text("Create Provider")
            }
        },
        dismissButton = {
            OutlinedButton(
                onClick = onDismiss,
                enabled = !isCreating
            ) {
                Text("Cancel", color = WhiteText)
            }
        }
    )
}
