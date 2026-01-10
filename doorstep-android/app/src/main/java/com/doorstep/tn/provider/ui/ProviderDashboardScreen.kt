package com.doorstep.tn.provider.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.unit.dp
import com.doorstep.tn.common.theme.*

/**
 * Service Provider Dashboard Screen
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProviderDashboardScreen(
    onNavigateToServices: () -> Unit,
    onNavigateToBookings: () -> Unit,
    onNavigateToEarnings: () -> Unit,
    onNavigateToProfile: () -> Unit,
    onLogout: () -> Unit
) {
    var isAvailable by remember { mutableStateOf(true) }
    
    Scaffold(
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
                            onCheckedChange = { isAvailable = it },
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
                        value = "5",
                        subtitle = "2 pending",
                        icon = Icons.Default.CalendarMonth,
                        color = ProviderBlue,
                        modifier = Modifier.weight(1f)
                    )
                    ProviderStatCard(
                        title = "Earnings",
                        value = "₹2,800",
                        subtitle = "This week",
                        icon = Icons.Default.CurrencyRupee,
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
                        badge = "2",
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
                Spacer(modifier = Modifier.height(8.dp))
                
                BookingRequestCard(
                    serviceName = "AC Repair",
                    customerName = "Ramesh Kumar",
                    date = "Tomorrow",
                    time = "Morning",
                    location = "Customer location",
                    price = "₹500",
                    onClick = onNavigateToBookings
                )
                Spacer(modifier = Modifier.height(8.dp))
                BookingRequestCard(
                    serviceName = "AC Repair",
                    customerName = "Priya S",
                    date = "Today",
                    time = "Evening",
                    location = "Customer location",
                    price = "₹500",
                    onClick = onNavigateToBookings
                )
            }
            
            // Today's Schedule
            item {
                Text(
                    text = "Today's Schedule",
                    style = MaterialTheme.typography.titleMedium,
                    color = WhiteText,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(12.dp))
                
                ScheduleCard(
                    time = "10:00 AM",
                    serviceName = "Plumbing Repair",
                    customerName = "Venkat R",
                    address = "12, Gandhi Street, Coimbatore",
                    status = "Confirmed"
                )
                Spacer(modifier = Modifier.height(8.dp))
                ScheduleCard(
                    time = "2:00 PM",
                    serviceName = "AC Service",
                    customerName = "Lakshmi N",
                    address = "45, Anna Nagar, Chennai",
                    status = "Confirmed"
                )
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
    serviceName: String,
    customerName: String,
    date: String,
    time: String,
    location: String,
    price: String,
    onClick: () -> Unit
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
                        text = serviceName,
                        style = MaterialTheme.typography.titleSmall,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = customerName,
                        style = MaterialTheme.typography.bodyMedium,
                        color = WhiteTextMuted
                    )
                    Row {
                        Text(
                            text = "$date • $time",
                            style = MaterialTheme.typography.bodySmall,
                            color = OrangePrimary
                        )
                    }
                    Text(
                        text = location,
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextSubtle
                    )
                }
                Text(
                    text = price,
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
                    onClick = onClick,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = ErrorRed
                    )
                ) {
                    Text("Reject")
                }
                Button(
                    onClick = onClick,
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

@Composable
private fun ScheduleCard(
    time: String,
    serviceName: String,
    customerName: String,
    address: String,
    status: String
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = GlassWhite)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Time
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = time,
                    style = MaterialTheme.typography.titleSmall,
                    color = ProviderBlue,
                    fontWeight = FontWeight.Bold
                )
            }
            
            Spacer(modifier = Modifier.width(16.dp))
            
            // Divider
            Box(
                modifier = Modifier
                    .width(2.dp)
                    .height(50.dp)
                    .background(ProviderBlue)
            )
            
            Spacer(modifier = Modifier.width(16.dp))
            
            // Details
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = serviceName,
                    style = MaterialTheme.typography.titleSmall,
                    color = WhiteText,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = customerName,
                    style = MaterialTheme.typography.bodyMedium,
                    color = WhiteTextMuted
                )
                Text(
                    text = address,
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextSubtle,
                    maxLines = 1
                )
            }
            
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = SuccessGreen.copy(alpha = 0.2f)
            ) {
                Text(
                    text = status,
                    color = SuccessGreen,
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }
        }
    }
}
