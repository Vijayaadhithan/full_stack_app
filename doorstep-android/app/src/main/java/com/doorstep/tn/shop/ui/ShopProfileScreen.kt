package com.doorstep.tn.shop.ui

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.draw.clip
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.auth.ui.AuthViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.shop.data.model.ShopProfileUpdate
import com.doorstep.tn.shop.data.model.ShopWorkingHours
import com.doorstep.tn.shop.data.model.UpdateShopProfileRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * Shop Profile Settings Screen
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ShopProfileScreen(
    viewModel: ShopViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToPrivacyPolicy: () -> Unit,
    onNavigateToAccountDeletionHelp: () -> Unit,
    onSwitchRole: ((String) -> Unit)? = null,  // Optional callback for role switching
    onLogout: () -> Unit = {}
) {
    val authViewModel: AuthViewModel = hiltViewModel()
    val user by authViewModel.user.collectAsState()
    val shopProfile by viewModel.shopProfile.collectAsState()
    val payLaterWhitelist by viewModel.payLaterWhitelist.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()

    var isEditing by remember { mutableStateOf(false) }
    var showPayLaterDialog by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf(false) }
    var isDeleting by remember { mutableStateOf(false) }

    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    // Form state
    var ownerName by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var upiId by remember { mutableStateOf("") }

    var shopName by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var businessType by remember { mutableStateOf("") }
    var gstin by remember { mutableStateOf("") }

    var addressStreet by remember { mutableStateOf("") }
    var addressArea by remember { mutableStateOf("") }
    var addressCity by remember { mutableStateOf("") }
    var addressState by remember { mutableStateOf("") }
    var addressPostalCode by remember { mutableStateOf("") }
    var addressCountry by remember { mutableStateOf("India") }

    var pickupAvailable by remember { mutableStateOf(true) }
    var deliveryAvailable by remember { mutableStateOf(false) }
    var returnsEnabled by remember { mutableStateOf(true) }
    var catalogModeEnabled by remember { mutableStateOf(false) }
    var openOrderMode by remember { mutableStateOf(false) }
    var allowPayLater by remember { mutableStateOf(false) }
    var freeDeliveryRadiusKm by remember { mutableStateOf("") }
    var deliveryFee by remember { mutableStateOf("") }

    var shippingPolicy by remember { mutableStateOf("") }
    var returnPolicy by remember { mutableStateOf("") }

    var workingFrom by remember { mutableStateOf("09:00") }
    var workingTo by remember { mutableStateOf("18:00") }
    var workingDays by remember { mutableStateOf(setOf<String>()) }

    val upiSuggestions = remember(upiId) { buildUpiSuggestions(upiId) }

    // GPS Location state
    val context = LocalContext.current
    var capturedLatitude by remember(shopProfile, user) { 
        mutableStateOf(resolveCoordinate(shopProfile?.shopLocationLat, user?.latitude)) 
    }
    var capturedLongitude by remember(shopProfile, user) { 
        mutableStateOf(resolveCoordinate(shopProfile?.shopLocationLng, user?.longitude)) 
    }
    var isCapturingLocation by remember { mutableStateOf(false) }

    // Location permission launcher
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineLocationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarseLocationGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true

        if (fineLocationGranted || coarseLocationGranted) {
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
                onError = { errorText ->
                    isCapturingLocation = false
                    scope.launch {
                        snackbarHostState.showSnackbar("Error: $errorText")
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

    fun requestLocation() {
        isCapturingLocation = true

        val hasFineLocation = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val hasCoarseLocation = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (hasFineLocation || hasCoarseLocation) {
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
                onError = { errorText ->
                    isCapturingLocation = false
                    scope.launch {
                        snackbarHostState.showSnackbar("Error: $errorText")
                    }
                }
            )
        } else {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }

    LaunchedEffect(Unit) {
        viewModel.loadShopProfile()
        viewModel.loadPayLaterWhitelist()
    }

    LaunchedEffect(user, shopProfile, isEditing) {
        if (!isEditing) {
            ownerName = user?.name ?: ""
            phone = user?.phone ?: ""
            email = user?.email ?: ""
            upiId = user?.upiId ?: ""

            shopName = shopProfile?.shopName ?: ""
            description = shopProfile?.description ?: ""
            businessType = shopProfile?.businessType ?: ""
            gstin = shopProfile?.gstin ?: ""

            addressStreet = shopProfile?.shopAddressStreet ?: user?.addressStreet ?: ""
            addressArea = shopProfile?.shopAddressArea ?: ""
            addressCity = shopProfile?.shopAddressCity ?: user?.addressCity ?: ""
            addressState = shopProfile?.shopAddressState ?: user?.addressState ?: ""
            addressPostalCode = shopProfile?.shopAddressPincode ?: user?.addressPostalCode ?: ""
            addressCountry = user?.addressCountry ?: "India"

            pickupAvailable = user?.pickupAvailable ?: true
            deliveryAvailable = user?.deliveryAvailable ?: false
            returnsEnabled = user?.returnsEnabled ?: true
            catalogModeEnabled = shopProfile?.catalogModeEnabled ?: false
            openOrderMode = shopProfile?.openOrderMode ?: (shopProfile?.catalogModeEnabled ?: false)
            allowPayLater = shopProfile?.allowPayLater ?: false
            freeDeliveryRadiusKm = formatOptionalDecimal(shopProfile?.freeDeliveryRadiusKm)
            deliveryFee = formatOptionalDecimal(shopProfile?.deliveryFee)

            shippingPolicy = shopProfile?.shippingPolicy ?: ""
            returnPolicy = shopProfile?.returnPolicy ?: ""

            workingFrom = shopProfile?.workingHours?.from ?: "09:00"
            workingTo = shopProfile?.workingHours?.to ?: "18:00"
            workingDays = shopProfile?.workingHours?.days?.toSet() ?: emptySet()

            capturedLatitude = resolveCoordinate(shopProfile?.shopLocationLat, user?.latitude)
            capturedLongitude = resolveCoordinate(shopProfile?.shopLocationLng, user?.longitude)
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

    fun saveProfile() {
        if (ownerName.isBlank() || shopName.isBlank()) {
            scope.launch {
                snackbarHostState.showSnackbar("Please fill required fields")
            }
            return
        }

        val workingHours = ShopWorkingHours(
            from = workingFrom.trim().ifBlank { null },
            to = workingTo.trim().ifBlank { null },
            days = workingDays.toList()
        )

        val shopProfileUpdate = ShopProfileUpdate(
            shopName = shopName.trim().ifBlank { null },
            description = description.trim().ifBlank { null },
            businessType = businessType.trim().ifBlank { null },
            gstin = gstin.trim().ifBlank { null },
            workingHours = workingHours,
            shippingPolicy = shippingPolicy.trim().ifBlank { null },
            returnPolicy = returnPolicy.trim().ifBlank { null },
            freeDeliveryRadiusKm = freeDeliveryRadiusKm.trim().toDoubleOrNull(),
            deliveryFee = deliveryFee.trim().toDoubleOrNull(),
            catalogModeEnabled = catalogModeEnabled,
            openOrderMode = openOrderMode,
            allowPayLater = allowPayLater,
            shopAddressArea = addressArea.trim().ifBlank { null },
            shopLocationLat = capturedLatitude,
            shopLocationLng = capturedLongitude
        )

        val request = UpdateShopProfileRequest(
            name = ownerName.trim().ifBlank { null },
            phone = phone.trim().ifBlank { null },
            email = email.trim().ifBlank { null },
            upiId = upiId.trim().ifBlank { null },
            pickupAvailable = pickupAvailable,
            deliveryAvailable = deliveryAvailable,
            returnsEnabled = returnsEnabled,
            addressStreet = addressStreet.trim().ifBlank { null },
            addressCity = addressCity.trim().ifBlank { null },
            addressState = addressState.trim().ifBlank { null },
            addressPostalCode = addressPostalCode.trim().ifBlank { null },
            addressCountry = addressCountry.trim().ifBlank { null },
            shopProfile = shopProfileUpdate
        )

        val userId = user?.id
        if (userId == null) {
            scope.launch {
                snackbarHostState.showSnackbar("Unable to update profile: missing user")
            }
            return
        }

        viewModel.updateShopProfile(userId, request) {
            isEditing = false
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Shop Settings",
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
                    if (isEditing) {
                        IconButton(onClick = { saveProfile() }) {
                            Icon(Icons.Default.Save, contentDescription = "Save", tint = WhiteText)
                        }
                        IconButton(onClick = { isEditing = false }) {
                            Icon(Icons.Default.Close, contentDescription = "Cancel", tint = WhiteText)
                        }
                    } else {
                        IconButton(onClick = { isEditing = true }) {
                            Icon(Icons.Default.Edit, contentDescription = "Edit", tint = WhiteText)
                        }
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
        if (isLoading && shopProfile == null) {
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
                SectionCard(title = "Owner & Contact", icon = Icons.Default.Person) {
                    ProfileTextField(
                        label = "Owner Name",
                        value = ownerName,
                        onValueChange = { ownerName = it },
                        enabled = isEditing,
                        icon = Icons.Default.Person
                    )
                    ProfileTextField(
                        label = "Phone",
                        value = phone,
                        onValueChange = { phone = it.filter { c -> c.isDigit() }.take(10) },
                        enabled = isEditing,
                        icon = Icons.Default.Phone,
                        keyboardType = KeyboardType.Phone
                    )
                    ProfileTextField(
                        label = "Email",
                        value = email,
                        onValueChange = { email = it },
                        enabled = isEditing,
                        icon = Icons.Default.Email,
                        keyboardType = KeyboardType.Email
                    )
                    ProfileTextField(
                        label = "UPI ID",
                        value = upiId,
                        onValueChange = { upiId = it },
                        enabled = isEditing,
                        icon = Icons.Default.Payment,
                        placeholder = "yourname@upi"
                    )
                    if (upiSuggestions.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(6.dp))
                        Text("Suggested UPI IDs", color = WhiteTextMuted, style = MaterialTheme.typography.bodySmall)
                        Spacer(modifier = Modifier.height(6.dp))
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            upiSuggestions.forEach { suggestion ->
                                AssistChip(
                                    onClick = { if (isEditing) upiId = suggestion },
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

                SectionCard(title = "Shop Information", icon = Icons.Default.Store) {
                    ProfileTextField(
                        label = "Shop Name",
                        value = shopName,
                        onValueChange = { shopName = it },
                        enabled = isEditing
                    )
                    ProfileTextField(
                        label = "Description",
                        value = description,
                        onValueChange = { description = it },
                        enabled = isEditing,
                        singleLine = false,
                        maxLines = 3
                    )
                    ProfileTextField(
                        label = "Business Type",
                        value = businessType,
                        onValueChange = { businessType = it },
                        enabled = isEditing
                    )
                    ProfileTextField(
                        label = "GSTIN (optional)",
                        value = gstin,
                        onValueChange = { gstin = it },
                        enabled = isEditing
                    )
                }

                SectionCard(title = "Working Hours", icon = Icons.Default.Schedule) {
                    ProfileTextField(
                        label = "Open From (HH:mm)",
                        value = workingFrom,
                        onValueChange = { workingFrom = it },
                        enabled = isEditing,
                        keyboardType = KeyboardType.Number
                    )
                    ProfileTextField(
                        label = "Open To (HH:mm)",
                        value = workingTo,
                        onValueChange = { workingTo = it },
                        enabled = isEditing,
                        keyboardType = KeyboardType.Number
                    )

                    Text(
                        text = "Working Days",
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        daysOfWeek.forEach { day ->
                            FilterChip(
                                selected = day in workingDays,
                                onClick = {
                                    if (isEditing) {
                                        workingDays = if (day in workingDays) {
                                            workingDays - day
                                        } else {
                                            workingDays + day
                                        }
                                    }
                                },
                                label = { Text(day.take(3)) }
                            )
                        }
                    }
                }

                SectionCard(title = "Address", icon = Icons.Default.LocationOn) {
                    ProfileTextField(
                        label = "Street Address",
                        value = addressStreet,
                        onValueChange = { addressStreet = it },
                        enabled = isEditing
                    )
                    ProfileTextField(
                        label = "Area / Locality",
                        value = addressArea,
                        onValueChange = { addressArea = it },
                        enabled = isEditing
                    )
                    Row(modifier = Modifier.fillMaxWidth()) {
                        ProfileTextField(
                            label = "City",
                            value = addressCity,
                            onValueChange = { addressCity = it },
                            enabled = isEditing,
                            modifier = Modifier.weight(1f)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        ProfileDropdownField(
                            label = "State",
                            value = addressState,
                            onValueChange = { addressState = it },
                            options = indiaStates,
                            enabled = isEditing,
                            placeholder = "Select state",
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Row(modifier = Modifier.fillMaxWidth()) {
                        ProfileTextField(
                            label = "Postal Code",
                            value = addressPostalCode,
                            onValueChange = { addressPostalCode = it.filter { c -> c.isDigit() }.take(6) },
                            enabled = isEditing,
                            keyboardType = KeyboardType.Number,
                            modifier = Modifier.weight(1f)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        ProfileDropdownField(
                            label = "Country",
                            value = addressCountry,
                            onValueChange = { addressCountry = it },
                            options = countryOptions,
                            enabled = isEditing,
                            placeholder = "Select country",
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                SectionCard(title = "Operational Settings", icon = Icons.Default.Settings) {
                    ProfileSwitchRow(
                        label = "Pickup Available",
                        checked = pickupAvailable,
                        onCheckedChange = { pickupAvailable = it },
                        enabled = isEditing
                    )
                    ProfileSwitchRow(
                        label = "Delivery Available",
                        checked = deliveryAvailable,
                        onCheckedChange = { deliveryAvailable = it },
                        enabled = isEditing
                    )
                    ProfileTextField(
                        label = "Free Delivery Radius (km)",
                        value = freeDeliveryRadiusKm,
                        onValueChange = {
                            freeDeliveryRadiusKm = it.filter { ch -> ch.isDigit() || ch == '.' }
                        },
                        enabled = isEditing && deliveryAvailable,
                        keyboardType = KeyboardType.Decimal
                    )
                    ProfileTextField(
                        label = "Delivery Fee beyond radius (₹)",
                        value = deliveryFee,
                        onValueChange = {
                            deliveryFee = it.filter { ch -> ch.isDigit() || ch == '.' }
                        },
                        enabled = isEditing && deliveryAvailable,
                        keyboardType = KeyboardType.Decimal
                    )
                    ProfileSwitchRow(
                        label = "Returns Enabled",
                        checked = returnsEnabled,
                        onCheckedChange = { returnsEnabled = it },
                        enabled = isEditing
                    )
                    ProfileSwitchRow(
                        label = "Catalog Mode",
                        checked = catalogModeEnabled,
                        onCheckedChange = { catalogModeEnabled = it },
                        enabled = isEditing
                    )
                    ProfileSwitchRow(
                        label = "Open Order Mode",
                        checked = openOrderMode,
                        onCheckedChange = { openOrderMode = it },
                        enabled = isEditing
                    )
                    ProfileSwitchRow(
                        label = "Allow Pay Later",
                        checked = allowPayLater,
                        onCheckedChange = { allowPayLater = it },
                        enabled = isEditing
                    )
                }

                SectionCard(title = "Policies", icon = Icons.Default.Policy) {
                    ProfileTextField(
                        label = "Shipping Policy",
                        value = shippingPolicy,
                        onValueChange = { shippingPolicy = it },
                        enabled = isEditing,
                        singleLine = false,
                        maxLines = 4
                    )
                    ProfileTextField(
                        label = "Return Policy",
                        value = returnPolicy,
                        onValueChange = { returnPolicy = it },
                        enabled = isEditing,
                        singleLine = false,
                        maxLines = 4
                    )
                }

                SectionCard(title = "Location", icon = Icons.Default.Map) {
                    val latText = capturedLatitude?.let { String.format(Locale.US, "%.6f", it) } ?: "Not set"
                    val lngText = capturedLongitude?.let { String.format(Locale.US, "%.6f", it) } ?: "Not set"

                    ProfileField(label = "Latitude", value = latText)
                    ProfileField(label = "Longitude", value = lngText)

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = { if (!isCapturingLocation) requestLocation() },
                            enabled = isEditing && !isCapturingLocation,
                            colors = ButtonDefaults.buttonColors(containerColor = ShopGreen),
                            modifier = Modifier.weight(1f)
                        ) {
                            if (isCapturingLocation) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    strokeWidth = 2.dp,
                                    color = WhiteText
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                            }
                            Text("Capture Location")
                        }
                        OutlinedButton(
                            onClick = {
                                if (isEditing) {
                                    capturedLatitude = null
                                    capturedLongitude = null
                                }
                            },
                            enabled = isEditing,
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Clear")
                        }
                    }
                }

                // Pay Later Whitelist Section
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.CreditCard,
                                    contentDescription = null,
                                    tint = ShopGreen
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Pay Later Customers",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = WhiteText,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            TextButton(onClick = { showPayLaterDialog = true }) {
                                Icon(Icons.Default.Add, contentDescription = null)
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Add")
                            }
                        }

                        HorizontalDivider(
                            modifier = Modifier.padding(vertical = 8.dp),
                            color = GlassWhite
                        )

                        val customers = payLaterWhitelist?.customers ?: emptyList()
                        if (customers.isEmpty()) {
                            Text(
                                text = "No customers added yet",
                                style = MaterialTheme.typography.bodySmall,
                                color = WhiteTextMuted
                            )
                        } else {
                            customers.forEach { customer ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text(
                                            text = customer.name ?: "Unknown",
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = WhiteText
                                        )
                                        Text(
                                            text = customer.phone ?: "No phone",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = WhiteTextMuted
                                        )
                                    }
                                    IconButton(
                                        onClick = { viewModel.removeFromPayLaterWhitelist(customer.id) }
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Remove,
                                            contentDescription = "Remove",
                                            tint = ErrorRed
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                if (isEditing) {
                    Button(
                        onClick = { saveProfile() },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = ShopGreen)
                    ) {
                        Icon(Icons.Default.Save, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Save Changes")
                    }
                }

                // Role Switching Section
                if (onSwitchRole != null) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = SlateCard)
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp)
                        ) {
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
                            
                            val currentRole = user?.role ?: "shop"
                            val hasCustomerProfile = true // All users can be customers
                            val hasProviderProfile = user?.hasProviderProfile == true
                            
                            ShopRoleSwitchDropdown(
                                currentRole = currentRole,
                                hasProviderProfile = hasProviderProfile,
                                onSwitchRole = onSwitchRole
                            )
                        }
                    }
                }

                OutlinedButton(
                    onClick = onNavigateToPrivacyPolicy,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = OrangePrimary),
                    border = BorderStroke(1.dp, OrangePrimary)
                ) {
                    Icon(Icons.Default.Policy, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Privacy Policy")
                }

                OutlinedButton(
                    onClick = onNavigateToAccountDeletionHelp,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = OrangePrimary),
                    border = BorderStroke(1.dp, OrangePrimary)
                ) {
                    Icon(Icons.Default.DeleteForever, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Account Deletion Help")
                }

                OutlinedButton(
                    onClick = onLogout,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = ErrorRed)
                ) {
                    Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Logout")
                }

                Button(
                    onClick = { showDeleteDialog = true },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = ErrorRed)
                ) {
                    Icon(Icons.Default.Delete, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Delete Account", fontWeight = FontWeight.Bold)
                }

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }

    if (showPayLaterDialog) {
        AddPayLaterCustomerDialog(
            onDismiss = { showPayLaterDialog = false },
            onConfirm = { phoneNumber ->
                viewModel.addToPayLaterWhitelist(phoneNumber) {
                    showPayLaterDialog = false
                }
            }
        )
    }

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
                        viewModel.deleteAccount(
                            onSuccess = {
                                isDeleting = false
                                showDeleteDialog = false
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
}

@Composable
private fun SectionCard(
    title: String,
    icon: ImageVector,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(imageVector = icon, contentDescription = null, tint = ShopGreen)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    color = WhiteText,
                    fontWeight = FontWeight.Bold
                )
            }
            HorizontalDivider(
                modifier = Modifier.padding(vertical = 8.dp),
                color = GlassWhite
            )
            content()
        }
    }
}

@Composable
private fun ProfileField(
    label: String,
    value: String
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = WhiteTextMuted
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = WhiteText
        )
    }
}

@Composable
private fun ProfileTextField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    placeholder: String? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    singleLine: Boolean = true,
    maxLines: Int = 1
) {
    Column(modifier = modifier.padding(vertical = 6.dp)) {
        Text(text = label, style = MaterialTheme.typography.bodySmall, color = WhiteTextMuted)
        Spacer(modifier = Modifier.height(4.dp))
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = placeholder?.let { { Text(it, color = WhiteTextMuted.copy(alpha = 0.5f)) } },
            leadingIcon = icon?.let { { Icon(it, null, tint = WhiteTextMuted) } },
            singleLine = singleLine,
            maxLines = maxLines,
            enabled = enabled,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = WhiteText,
                unfocusedTextColor = WhiteText,
                focusedBorderColor = OrangePrimary,
                unfocusedBorderColor = GlassWhite,
                focusedContainerColor = SlateBackground,
                unfocusedContainerColor = SlateBackground,
                disabledTextColor = WhiteTextMuted,
                disabledBorderColor = GlassWhite,
                disabledContainerColor = SlateBackground
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
    enabled: Boolean,
    modifier: Modifier = Modifier,
    placeholder: String? = null
) {
    var expanded by remember { mutableStateOf(false) }

    Column(modifier = modifier.padding(vertical = 6.dp)) {
        Text(text = label, style = MaterialTheme.typography.bodySmall, color = WhiteTextMuted)
        Spacer(modifier = Modifier.height(4.dp))
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { if (enabled) expanded = !expanded }
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
                enabled = enabled,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = WhiteText,
                    unfocusedTextColor = WhiteText,
                    focusedBorderColor = OrangePrimary,
                    unfocusedBorderColor = GlassWhite,
                    focusedContainerColor = SlateBackground,
                    unfocusedContainerColor = SlateBackground,
                    disabledTextColor = WhiteTextMuted,
                    disabledBorderColor = GlassWhite,
                    disabledContainerColor = SlateBackground
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

@Composable
private fun ProfileSwitchRow(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    enabled: Boolean
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = label, style = MaterialTheme.typography.bodyMedium, color = WhiteText)
        Switch(
            checked = checked,
            onCheckedChange = { if (enabled) onCheckedChange(it) },
            enabled = enabled,
            colors = SwitchDefaults.colors(
                checkedThumbColor = WhiteText,
                checkedTrackColor = ShopGreen
            )
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddPayLaterCustomerDialog(
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var phone by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Pay Later Customer") },
        text = {
            OutlinedTextField(
                value = phone,
                onValueChange = { phone = it.filter { c -> c.isDigit() }.take(10) },
                label = { Text("Phone Number") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        },
        confirmButton = {
            TextButton(
                onClick = { if (phone.length == 10) onConfirm(phone) },
                enabled = phone.length == 10
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

private val daysOfWeek = listOf(
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
)

private fun formatOptionalDecimal(value: Double?): String {
    if (value == null) return ""
    return if (value % 1.0 == 0.0) {
        value.toInt().toString()
    } else {
        String.format(Locale.US, "%.2f", value)
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

private fun parseCoordinate(value: Any?): Double? = when (value) {
    is Number -> value.toDouble()
    is String -> value.toDoubleOrNull()
    else -> null
}

private fun resolveCoordinate(primary: Any?, fallback: Any?): Double? {
    return parseCoordinate(primary) ?: parseCoordinate(fallback)
}

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
        onError(e.message ?: "Location error")
    }
}

// ─── Role Switcher ──────────────────────────────────────────────────────────

private data class ShopRoleOption(
    val key: String,
    val label: String,
    val color: androidx.compose.ui.graphics.Color,
    val icon: ImageVector,
    val available: Boolean
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ShopRoleSwitchDropdown(
    currentRole: String,
    hasProviderProfile: Boolean,
    onSwitchRole: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    val roles = listOf(
        ShopRoleOption(
            key = "customer",
            label = "Customer",
            color = OrangePrimary,
            icon = Icons.Default.PersonOutline,
            available = true
        ),
        ShopRoleOption(
            key = "shop",
            label = "Shop Owner",
            color = ShopGreen,
            icon = Icons.Default.Store,
            available = true  // Already in shop
        ),
        ShopRoleOption(
            key = "provider",
            label = "Service Provider",
            color = ProviderBlue,
            icon = Icons.Default.Build,
            available = hasProviderProfile
        )
    )

    val selected = roles.find { it.key == currentRole } ?: roles[1]  // Default to shop

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
                                style = MaterialTheme.typography.bodyLarge,
                                color = if (role.available) WhiteText else WhiteTextMuted
                            )
                            if (!role.available && role.key != "shop") {
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "(Not set up)",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = WhiteTextMuted
                                )
                            }
                        }
                    },
                    onClick = {
                        if (role.available && role.key != currentRole) {
                            expanded = false
                            onSwitchRole(role.key)
                        }
                    },
                    enabled = role.available && role.key != currentRole,
                    modifier = Modifier.background(SlateCard)
                )
            }
        }
    }
}
