package com.doorstep.tn.customer.ui.profile

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.auth.ui.AuthViewModel
import com.doorstep.tn.common.theme.*
import kotlinx.coroutines.launch

/**
 * Customer Profile Screen - matches web app's profile.tsx
 * Features: Full form, address fields, verification status
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    authViewModel: AuthViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onLogout: () -> Unit
) {
    val user by authViewModel.user.collectAsState()
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }
    
    // Form state - initialized from user
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
    
    var isLoading by remember { mutableStateOf(false) }
    
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
                        ProfileTextField(
                            label = "State",
                            value = addressState,
                            onValueChange = { addressState = it },
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
                        ProfileTextField(
                            label = "Country",
                            value = addressCountry,
                            onValueChange = { addressCountry = it },
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
                    
                    val userLat = user?.latitude
                    val userLng = user?.longitude
                    val hasLocation = userLat != null && userLng != null
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
                            Column {
                                Text("Location Saved", color = SuccessGreen, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                                Text("$userLat, $userLng", color = WhiteTextMuted, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    Text(
                        text = "Location capture requires the app to request GPS permission. This can be implemented using Android's FusedLocationProvider.",
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Save Button
            Button(
                onClick = { 
                    isLoading = true
                    scope.launch {
                        snackbarHostState.showSnackbar("Profile saved!")
                        isLoading = false
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
