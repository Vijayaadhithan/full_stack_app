package com.doorstep.tn.customer.ui.shops

import android.Manifest
import android.content.pm.PackageManager
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.doorstep.tn.auth.ui.AuthViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.common.ui.LocationFilterDropdown
import com.doorstep.tn.common.util.fetchCurrentLocation
import com.doorstep.tn.common.util.parseGeoPoint
import com.doorstep.tn.customer.data.model.Shop
import com.doorstep.tn.customer.ui.CustomerViewModel

/**
 * Shops List Screen - Browse all shops with location filter
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShopsListScreen(
    viewModel: CustomerViewModel = hiltViewModel(),
    authViewModel: AuthViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToShop: (Int) -> Unit
) {
    val shops by viewModel.shops.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val user by authViewModel.user.collectAsState()
    var searchQuery by remember { mutableStateOf("") }
    var locationCity by remember { mutableStateOf("") }
    var locationState by remember { mutableStateOf("") }
    var showLocationFilters by remember { mutableStateOf(false) }
    
    // Location filter state
    var locationRadius by remember { mutableIntStateOf(45) }
    var locationLat by remember { mutableStateOf<Double?>(null) }
    var locationLng by remember { mutableStateOf<Double?>(null) }
    var locationSource by remember { mutableStateOf<String?>(null) }

    val context = LocalContext.current
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarseGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (fineGranted || coarseGranted) {
            fetchCurrentLocation(
                context = context,
                onSuccess = { point ->
                    locationLat = point.latitude
                    locationLng = point.longitude
                    locationSource = "Device"
                },
                onError = { message ->
                    Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
                }
            )
        } else {
            Toast.makeText(context, "Location permission denied", Toast.LENGTH_SHORT).show()
        }
    }

    val requestDeviceLocation = {
        val fineGranted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        if (fineGranted || coarseGranted) {
            fetchCurrentLocation(
                context = context,
                onSuccess = { point ->
                    locationLat = point.latitude
                    locationLng = point.longitude
                    locationSource = "Device"
                },
                onError = { message ->
                    Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
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
    
    LaunchedEffect(locationLat, locationLng, locationRadius, locationCity, locationState) {
        viewModel.loadShops(
            locationCity = locationCity.takeIf { it.isNotBlank() && locationLat == null },
            locationState = locationState.takeIf { it.isNotBlank() && locationLat == null },
            latitude = locationLat,
            longitude = locationLng,
            radius = if (locationLat != null) locationRadius else null
        )
    }

    val filteredShops = remember(shops, searchQuery) {
        val query = searchQuery.trim()
        if (query.isEmpty()) {
            shops
        } else {
            val lowered = query.lowercase()
            shops.filter { shop ->
                val name = shop.shopProfile?.shopName ?: shop.name ?: ""
                val description = shop.shopProfile?.description ?: ""
                name.lowercase().contains(lowered) || description.lowercase().contains(lowered)
            }
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Browse Shops", color = WhiteText) },
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
        containerColor = SlateDarker
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // ==================== Filter Row ====================
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp)
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Search Field (compact)
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    modifier = Modifier.width(200.dp),
                    placeholder = { Text("Search shops...", color = WhiteTextSubtle, style = MaterialTheme.typography.bodySmall) },
                    leadingIcon = {
                        Icon(Icons.Default.Search, contentDescription = null, tint = WhiteTextMuted, modifier = Modifier.size(18.dp))
                    },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { 
                                searchQuery = ""
                            }) {
                                Icon(Icons.Default.Clear, contentDescription = "Clear", tint = WhiteTextMuted, modifier = Modifier.size(16.dp))
                            }
                        }
                    },
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    singleLine = true,
                    shape = RoundedCornerShape(24.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = ShopGreen,
                        unfocusedBorderColor = GlassBorder,
                        focusedContainerColor = GlassWhite,
                        unfocusedContainerColor = GlassWhite,
                        focusedTextColor = WhiteText,
                        unfocusedTextColor = WhiteText
                    ),
                    textStyle = MaterialTheme.typography.bodySmall
                )
                
                // Location Filter
                LocationFilterDropdown(
                    currentRadius = locationRadius,
                    currentLat = locationLat,
                    currentLng = locationLng,
                    onRadiusChange = { locationRadius = it },
                    onUseDeviceLocation = { requestDeviceLocation() },
                    onUseSavedLocation = {
                        val saved = parseGeoPoint(user?.latitude, user?.longitude)
                        if (saved != null) {
                            locationLat = saved.latitude
                            locationLng = saved.longitude
                            locationSource = "Profile"
                        } else {
                            Toast.makeText(
                                context,
                                "Saved location not available",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    },
                    onClear = {
                        locationLat = null
                        locationLng = null
                        locationSource = null
                    },
                    sourceLabel = locationSource
                )

                // City/State filter trigger (fallback when location is not set)
                IconButton(onClick = { showLocationFilters = true }) {
                    Icon(
                        imageVector = Icons.Default.FilterList,
                        contentDescription = "Filters",
                        tint = WhiteTextMuted
                    )
                }
            }
            
            // Location info
            if (locationLat != null && locationLng != null) {
                Text(
                    text = "Showing shops within $locationRadius km",
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                )
            }
            
            HorizontalDivider(color = GlassBorder, thickness = 1.dp)
            
            // ==================== Shops List ====================
            when {
                isLoading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = ShopGreen)
                    }
                }
                filteredShops.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Default.Storefront,
                                contentDescription = null,
                                tint = WhiteTextMuted,
                                modifier = Modifier.size(64.dp)
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text("No shops found", color = WhiteTextMuted)
                        }
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(filteredShops) { shop ->
                            ShopCard(
                                shop = shop,
                                onClick = { onNavigateToShop(shop.id) }
                            )
                        }
                    }
                }
            }
        }
    }

    if (showLocationFilters) {
        LocationFilterDialog(
            initialCity = locationCity,
            initialState = locationState,
            onApply = { city, state ->
                locationCity = city
                locationState = state
            },
            onDismiss = { showLocationFilters = false }
        )
    }
}

@Composable
private fun LocationFilterDialog(
    initialCity: String,
    initialState: String,
    onApply: (String, String) -> Unit,
    onDismiss: () -> Unit
) {
    var city by remember(initialCity) { mutableStateOf(initialCity) }
    var state by remember(initialState) { mutableStateOf(initialState) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Filter by location") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = city,
                    onValueChange = { city = it },
                    label = { Text("City") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = state,
                    onValueChange = { state = it },
                    label = { Text("State") },
                    singleLine = true
                )
                Text(
                    text = "These filters apply when nearby search is not enabled.",
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onApply(city.trim(), state.trim())
                    onDismiss()
                }
            ) {
                Text("Apply")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@Composable
private fun ShopCard(
    shop: Shop,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Shop Image
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(GlassWhite),
                contentAlignment = Alignment.Center
            ) {
                if (!shop.profileImage.isNullOrEmpty()) {
                    AsyncImage(
                        model = shop.profileImage,
                        contentDescription = shop.displayName,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.Store,
                        contentDescription = null,
                        tint = ShopGreen,
                        modifier = Modifier.size(36.dp)
                    )
                }
            }
            
            Spacer(modifier = Modifier.width(16.dp))
            
            // Shop Info
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = shop.displayName,
                    style = MaterialTheme.typography.titleMedium,
                    color = WhiteText,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                
                shop.description?.let { desc ->
                    Text(
                        text = desc,
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                
                Spacer(modifier = Modifier.height(8.dp))
                
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Location
                    if (shop.addressCity != null) {
                        Icon(
                            imageVector = Icons.Default.LocationOn,
                            contentDescription = null,
                            tint = WhiteTextSubtle,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = shop.addressCity,
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteTextSubtle
                        )
                        
                        Spacer(modifier = Modifier.width(12.dp))
                    }
                    
                    // Rating
                    val rating = shop.rating
                    if (rating != null && rating > 0) {
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = null,
                            tint = AmberSecondary,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = String.format("%.1f", shop.rating),
                            style = MaterialTheme.typography.bodySmall,
                            color = AmberSecondary
                        )
                    }
                    
                    // Open Status
                    Spacer(modifier = Modifier.weight(1f))
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = if (shop.isOpen) SuccessGreen.copy(alpha = 0.2f) 
                               else ErrorRed.copy(alpha = 0.2f)
                    ) {
                        Text(
                            text = if (shop.isOpen) "Open" else "Closed",
                            color = if (shop.isOpen) SuccessGreen else ErrorRed,
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
            }
            
            // Arrow
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = WhiteTextMuted,
                modifier = Modifier.size(24.dp)
            )
        }
    }
}
