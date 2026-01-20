package com.doorstep.tn.provider.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.provider.data.model.ProviderBooking

/**
 * Provider Bookings Screen - View and manage all bookings
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProviderBookingsScreen(
    viewModel: ProviderViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val pendingBookings by viewModel.pendingBookings.collectAsState()
    val allBookings by viewModel.bookings.collectAsState()
    val isLoadingPending by viewModel.isLoadingPendingBookings.collectAsState()
    val isLoadingAll by viewModel.isLoadingBookings.collectAsState()
    val error by viewModel.error.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()
    
    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("Pending", "Upcoming", "Completed", "All")
    
    // Action dialog state
    var showActionDialog by remember { mutableStateOf(false) }
    var actionBooking by remember { mutableStateOf<ProviderBooking?>(null) }
    var isAcceptAction by remember { mutableStateOf(true) }
    var comments by remember { mutableStateOf("") }
    
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
    
    // Load bookings based on selected tab
    LaunchedEffect(selectedTab) {
        viewModel.loadPendingBookings()
        when (selectedTab) {
            1 -> viewModel.loadAllBookings("confirmed")
            2 -> viewModel.loadAllBookings("completed")
            3 -> viewModel.loadAllBookings(null)
        }
    }
    
    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { 
                    Text(
                        "Bookings",
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
        containerColor = SlateDarker
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Tabs
            ScrollableTabRow(
                selectedTabIndex = selectedTab,
                edgePadding = 16.dp,
                containerColor = SlateBackground,
                contentColor = WhiteText
            ) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        text = { 
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(title)
                                if (index == 0 && pendingBookings.isNotEmpty()) {
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Badge { Text(pendingBookings.size.toString()) }
                                }
                            }
                        },
                        selectedContentColor = OrangePrimary,
                        unselectedContentColor = WhiteTextMuted
                    )
                }
            }
            
            // Content based on tab
            val bookingsToShow = when (selectedTab) {
                0 -> pendingBookings
                1 -> allBookings.filter { it.isConfirmed }
                2 -> allBookings.filter { it.isCompleted }
                else -> allBookings
            }
            
            val isLoading = when (selectedTab) {
                0 -> isLoadingPending
                else -> isLoadingAll
            }
            
            if (isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = ProviderBlue)
                }
            } else if (bookingsToShow.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            imageVector = Icons.Default.EventBusy,
                            contentDescription = null,
                            tint = WhiteTextMuted,
                            modifier = Modifier.size(64.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = when (selectedTab) {
                                0 -> "No pending requests"
                                1 -> "No upcoming bookings"
                                2 -> "No completed bookings"
                                else -> "No bookings yet"
                            },
                            style = MaterialTheme.typography.titleMedium,
                            color = WhiteText
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(bookingsToShow) { booking ->
                        BookingCard(
                            booking = booking,
                            showActions = booking.isPending,
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
                            },
                            onComplete = {
                                viewModel.completeBooking(booking.id)
                            }
                        )
                    }
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
private fun BookingCard(
    booking: ProviderBooking,
    showActions: Boolean,
    onAccept: () -> Unit,
    onReject: () -> Unit,
    onComplete: () -> Unit
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
                        text = booking.serviceName,
                        style = MaterialTheme.typography.titleMedium,
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
                }
                
                // Status badge
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = when {
                        booking.isPending -> OrangePrimary.copy(alpha = 0.2f)
                        booking.isConfirmed -> ProviderBlue.copy(alpha = 0.2f)
                        booking.isCompleted -> SuccessGreen.copy(alpha = 0.2f)
                        booking.isCancelled -> ErrorRed.copy(alpha = 0.2f)
                        else -> GlassWhite
                    }
                ) {
                    Text(
                        text = booking.status.replace("_", " ").replaceFirstChar { it.uppercase() },
                        style = MaterialTheme.typography.labelSmall,
                        color = when {
                            booking.isPending -> OrangePrimary
                            booking.isConfirmed -> ProviderBlue
                            booking.isCompleted -> SuccessGreen
                            booking.isCancelled -> ErrorRed
                            else -> WhiteTextMuted
                        },
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // Date, Time, Price row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.CalendarMonth,
                        contentDescription = null,
                        tint = OrangePrimary,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = booking.scheduledDate ?: "TBD",
                        style = MaterialTheme.typography.bodySmall,
                        color = OrangePrimary
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Icon(
                        imageVector = Icons.Default.Schedule,
                        contentDescription = null,
                        tint = WhiteTextMuted,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = booking.scheduledTime ?: "TBD",
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                }
                
                Text(
                    text = booking.displayPrice,
                    style = MaterialTheme.typography.titleMedium,
                    color = SuccessGreen,
                    fontWeight = FontWeight.Bold
                )
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // Address
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.LocationOn,
                    contentDescription = null,
                    tint = WhiteTextSubtle,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = booking.formattedAddress,
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextSubtle,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
            
            // Customer phone
            booking.customer?.phone?.let { phone ->
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Phone,
                        contentDescription = null,
                        tint = WhiteTextSubtle,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = phone,
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextSubtle
                    )
                }
            }
            
            // Actions
            if (showActions) {
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
            } else if (booking.isConfirmed) {
                // Show complete button for confirmed bookings
                Spacer(modifier = Modifier.height(12.dp))
                Button(
                    onClick = onComplete,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = ProviderBlue
                    )
                ) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Mark as Completed")
                }
            }
        }
    }
}
