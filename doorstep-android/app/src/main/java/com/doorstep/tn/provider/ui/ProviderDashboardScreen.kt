package com.doorstep.tn.provider.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.EventNote
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.provider.data.model.ProviderBooking

/**
 * Service Provider Dashboard Screen with real API integration
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProviderDashboardScreen(
    viewModel: ProviderViewModel = hiltViewModel(),
    onNavigateToServices: () -> Unit,
    onNavigateToBookings: () -> Unit,
    onNavigateToEarnings: () -> Unit,
    onNavigateToProfile: () -> Unit,
    onLogout: () -> Unit
) {
    val isAvailable by viewModel.isAvailable.collectAsState()
    val pendingBookings by viewModel.pendingBookings.collectAsState()
    val isLoadingPendingBookings by viewModel.isLoadingPendingBookings.collectAsState()
    val services by viewModel.services.collectAsState()
    val error by viewModel.error.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()
    val stats by viewModel.stats.collectAsState()
    
    // Show snackbar for messages
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
    
    // Accept/Reject dialog state
    var showActionDialog by remember { mutableStateOf(false) }
    var actionBooking by remember { mutableStateOf<ProviderBooking?>(null) }
    var isAcceptAction by remember { mutableStateOf(true) }
    var comments by remember { mutableStateOf("") }
    
    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Provider Dashboard",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = ProviderBlue
                        )
                        Text(
                            text = "Manage your services",
                            style = MaterialTheme.typography.bodySmall,
                            color = WhiteTextMuted
                        )
                    }
                },
                actions = {
                    IconButton(onClick = onNavigateToProfile) {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = "Settings",
                            tint = WhiteText
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = SlateBackground
                )
            )
        },
        containerColor = SlateDarker
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            // Availability Toggle
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (isAvailable) 
                            SuccessGreen.copy(alpha = 0.1f) 
                        else 
                            ErrorRed.copy(alpha = 0.1f)
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = if (isAvailable) "You're Online" else "You're Offline",
                                style = MaterialTheme.typography.titleMedium,
                                color = if (isAvailable) SuccessGreen else ErrorRed,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = if (isAvailable) 
                                    "Accepting new bookings" 
                                else 
                                    "Not accepting bookings",
                                style = MaterialTheme.typography.bodySmall,
                                color = WhiteTextMuted
                            )
                        }
                        Switch(
                            checked = isAvailable,
                            onCheckedChange = { viewModel.toggleAvailability() },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = WhiteText,
                                checkedTrackColor = SuccessGreen,
                                uncheckedThumbColor = WhiteText,
                                uncheckedTrackColor = SlateCard
                            )
                        )
                    }
                }
            }
            
            // Stats
            item {
                Text(
                    text = "Today's Overview",
                    style = MaterialTheme.typography.titleMedium,
                    color = WhiteText,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(12.dp))
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    ProviderStatCard(
                        title = "Bookings",
                        value = stats.pendingBookings.toString(),
                        subtitle = "pending",
                        icon = Icons.Default.CalendarMonth,
                        color = ProviderBlue,
                        modifier = Modifier.weight(1f)
                    )
                    ProviderStatCard(
                        title = "Services",
                        value = services.size.toString(),
                        subtitle = "active",
                        icon = Icons.Default.Build,
                        color = SuccessGreen,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
            
            // Quick Actions
            item {
                Text(
                    text = "Quick Actions",
                    style = MaterialTheme.typography.titleMedium,
                    color = WhiteText,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(12.dp))
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    ProviderActionCard(
                        icon = Icons.Default.Build,
                        label = "My Services",
                        color = ProviderBlue,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToServices
                    )
                    ProviderActionCard(
                        icon = Icons.AutoMirrored.Filled.EventNote,
                        label = "Bookings",
                        color = OrangePrimary,
                        badge = if (stats.pendingBookings > 0) stats.pendingBookings.toString() else null,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToBookings
                    )
                }
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    ProviderActionCard(
                        icon = Icons.Default.AccountBalanceWallet,
                        label = "Earnings",
                        color = SuccessGreen,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToEarnings
                    )
                    ProviderActionCard(
                        icon = Icons.Default.Schedule,
                        label = "Availability",
                        color = AmberSecondary,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToProfile
                    )
                }
            }
            
            // Pending Bookings
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Pending Requests",
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    TextButton(onClick = onNavigateToBookings) {
                        Text("View All", color = OrangePrimary)
                    }
                }
            }
            
            if (isLoadingPendingBookings) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = ProviderBlue)
                    }
                }
            } else if (pendingBookings.isEmpty()) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = SlateCard)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Default.EventAvailable,
                                contentDescription = null,
                                tint = WhiteTextMuted,
                                modifier = Modifier.size(48.dp)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "No pending requests",
                                style = MaterialTheme.typography.bodyMedium,
                                color = WhiteTextMuted
                            )
                        }
                    }
                }
            } else {
                items(pendingBookings.take(3)) { booking ->
                    BookingRequestCard(
                        booking = booking,
                        onAccept = {
                            actionBooking = booking
                            isAcceptAction = true
                            comments = ""
                            showActionDialog = true
                        },
                        onReject = {
                            actionBooking = booking
                            isAcceptAction = false
                            comments = ""
                            showActionDialog = true
                        }
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
            
            // Logout
            item {
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedButton(
                    onClick = onLogout,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = ErrorRed
                    )
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Logout,
                        contentDescription = null
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Logout")
                }
            }
        }
    }
    
    // Accept/Reject Dialog
    if (showActionDialog && actionBooking != null) {
        AlertDialog(
            onDismissRequest = { showActionDialog = false },
            title = {
                Text(
                    text = if (isAcceptAction) "Accept Booking" else "Reject Booking",
                    color = WhiteText
                )
            },
            text = {
                Column {
                    Text(
                        text = "${actionBooking?.serviceName} for ${actionBooking?.customerName}",
                        color = WhiteTextMuted
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    OutlinedTextField(
                        value = comments,
                        onValueChange = { comments = it },
                        label = { Text("Comments (optional)") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = if (isAcceptAction) SuccessGreen else ErrorRed,
                            unfocusedBorderColor = GlassBorder
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        actionBooking?.let {
                            if (isAcceptAction) {
                                viewModel.acceptBooking(it.id, comments.ifBlank { null })
                            } else {
                                viewModel.rejectBooking(it.id, comments.ifBlank { null })
                            }
                        }
                        showActionDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isAcceptAction) SuccessGreen else ErrorRed
                    )
                ) {
                    Text(if (isAcceptAction) "Accept" else "Reject")
                }
            },
            dismissButton = {
                TextButton(onClick = { showActionDialog = false }) {
                    Text("Cancel", color = WhiteTextMuted)
                }
            },
            containerColor = SlateCard
        )
    }
}

@Composable
private fun ProviderStatCard(
    title: String,
    value: String,
    subtitle: String,
    icon: ImageVector,
    color: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = GlassWhite)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyMedium,
                    color = WhiteTextMuted
                )
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = color,
                    modifier = Modifier.size(20.dp)
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.headlineSmall,
                color = WhiteText,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = color
            )
        }
    }
}

@Composable
private fun ProviderActionCard(
    icon: ImageVector,
    label: String,
    color: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier,
    badge: String? = null,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier
            .height(80.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(color),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = WhiteText,
                    modifier = Modifier.size(20.dp)
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = WhiteText,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.weight(1f)
            )
            badge?.let {
                Badge { Text(it) }
            }
        }
    }
}

@Composable
private fun BookingRequestCard(
    booking: ProviderBooking,
    onAccept: () -> Unit,
    onReject: () -> Unit
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
                        text = booking.serviceName,
                        style = MaterialTheme.typography.titleSmall,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = booking.customerName,
                        style = MaterialTheme.typography.bodyMedium,
                        color = WhiteTextMuted
                    )
                    Row {
                        Text(
                            text = "${booking.scheduledDate ?: "TBD"} • ${booking.scheduledTime ?: "TBD"}",
                            style = MaterialTheme.typography.bodySmall,
                            color = OrangePrimary
                        )
                    }
                    Text(
                        text = booking.formattedAddress,
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextSubtle,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                Text(
                    text = booking.displayPrice,
                    style = MaterialTheme.typography.titleMedium,
                    color = SuccessGreen,
                    fontWeight = FontWeight.Bold
                )
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = onReject,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = ErrorRed
                    )
                ) {
                    Text("Reject")
                }
                Button(
                    onClick = onAccept,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = SuccessGreen
                    )
                ) {
                    Text("Accept")
                }
            }
        }
    }
}
