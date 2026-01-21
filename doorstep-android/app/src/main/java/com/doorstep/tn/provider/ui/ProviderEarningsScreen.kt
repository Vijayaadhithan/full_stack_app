package com.doorstep.tn.provider.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.provider.data.model.ProviderBooking
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProviderEarningsScreen(
    viewModel: ProviderViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val bookings by viewModel.bookings.collectAsState()
    val isLoading by viewModel.isLoadingBookings.collectAsState()
    val error by viewModel.error.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }

    var searchTerm by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        viewModel.loadAllBookings()
    }

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

    val summary = remember(bookings) { buildEarningsSummary(bookings) }
    val filteredCustomers = remember(summary.customers, searchTerm) {
        val trimmed = searchTerm.trim().lowercase(Locale.US)
        if (trimmed.isEmpty()) {
            summary.customers
        } else {
            summary.customers.filter { customer ->
                customer.name.lowercase(Locale.US).contains(trimmed) ||
                    customer.phone?.contains(trimmed) == true
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Earnings", color = WhiteText, fontWeight = FontWeight.Bold) },
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
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            EarningsSummaryGrid(summary = summary)

            OutlinedTextField(
                value = searchTerm,
                onValueChange = { searchTerm = it },
                label = { Text("Search customers") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = ProviderBlue,
                    unfocusedBorderColor = GlassBorder,
                    focusedTextColor = WhiteText,
                    unfocusedTextColor = WhiteText
                )
            )

            when {
                isLoading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = ProviderBlue)
                    }
                }
                filteredCustomers.isEmpty() -> {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = SlateCard)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = if (summary.customers.isEmpty()) {
                                    "No earnings yet"
                                } else {
                                    "No customers match this search"
                                },
                                color = WhiteTextMuted
                            )
                        }
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(filteredCustomers) { customer ->
                            EarningsCustomerRow(customer = customer)
                        }
                    }
                }
            }
        }
    }
}

private data class EarningsCustomer(
    val name: String,
    val phone: String?,
    val total: Double,
    val count: Int,
    val lastJobDate: String?
)

private data class EarningsScreenSummary(
    val todayTotal: Double,
    val monthTotal: Double,
    val allTimeTotal: Double,
    val customers: List<EarningsCustomer>
)

@Composable
private fun EarningsSummaryGrid(summary: EarningsScreenSummary) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            EarningsMetricCard(
                title = "Today",
                value = formatRupees(summary.todayTotal),
                modifier = Modifier.weight(1f)
            )
            EarningsMetricCard(
                title = "This month",
                value = formatRupees(summary.monthTotal),
                modifier = Modifier.weight(1f)
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            EarningsMetricCard(
                title = "Total",
                value = formatRupees(summary.allTimeTotal),
                modifier = Modifier.weight(1f),
                highlightColor = SuccessGreen
            )
            EarningsMetricCard(
                title = "Customers",
                value = summary.customers.size.toString(),
                modifier = Modifier.weight(1f),
                highlightColor = ProviderBlue
            )
        }
    }
}

@Composable
private fun EarningsMetricCard(
    title: String,
    value: String,
    modifier: Modifier = Modifier,
    highlightColor: androidx.compose.ui.graphics.Color = WhiteText
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(text = title, style = MaterialTheme.typography.bodySmall, color = WhiteTextMuted)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.AccountBalanceWallet,
                    contentDescription = null,
                    tint = highlightColor
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = value,
                    style = MaterialTheme.typography.titleMedium,
                    color = highlightColor,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun EarningsCustomerRow(customer: EarningsCustomer) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = customer.name,
                    style = MaterialTheme.typography.bodyMedium,
                    color = WhiteText,
                    fontWeight = FontWeight.SemiBold
                )
                customer.phone?.let {
                    Text(text = it, style = MaterialTheme.typography.bodySmall, color = WhiteTextMuted)
                }
                Text(
                    text = "${customer.count} job${if (customer.count == 1) "" else "s"}",
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted
                )
                Text(
                    text = customer.lastJobDate?.let { formatDateShort(it) } ?: "Last job: N/A",
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted
                )
            }
            Text(
                text = formatRupees(customer.total),
                style = MaterialTheme.typography.titleMedium,
                color = SuccessGreen,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

private fun buildEarningsSummary(bookings: List<ProviderBooking>): EarningsScreenSummary {
    val todayKey = currentIndianDayKey()
    val monthKey = currentIndianMonthKey()

    var todayTotal = 0.0
    var monthTotal = 0.0
    var allTimeTotal = 0.0
    val totalsByCustomer = mutableMapOf<String, EarningsCustomer>()

    bookings.forEach { booking ->
        if (booking.status !in setOf("completed", "awaiting_payment")) return@forEach
        val amount = booking.service?.price?.toDoubleOrNull() ?: return@forEach

        allTimeTotal += amount

        val bookingDay = bookingDayKey(booking.bookingDate)
        val bookingMonth = bookingMonthKey(booking.bookingDate)

        if (bookingDay != null && bookingDay == todayKey) {
            todayTotal += amount
        }
        if (bookingMonth != null && bookingMonth == monthKey) {
            monthTotal += amount
        }

        val name = booking.customer?.name?.takeIf { it.isNotBlank() } ?: "Customer"
        val key = booking.customer?.id?.let { "customer-$it" } ?: "booking-${booking.id}"
        val current = totalsByCustomer[key] ?: EarningsCustomer(
            name = name,
            phone = booking.customer?.phone,
            total = 0.0,
            count = 0,
            lastJobDate = null
        )

        val latestDate = if (booking.bookingDate != null) {
            val currentDate = current.lastJobDate?.let { parseBookingInstant(it)?.toEpochMilli() } ?: 0L
            val nextDate = parseBookingInstant(booking.bookingDate)?.toEpochMilli() ?: 0L
            if (nextDate > currentDate) booking.bookingDate else current.lastJobDate
        } else {
            current.lastJobDate
        }

        totalsByCustomer[key] = current.copy(
            total = current.total + amount,
            count = current.count + 1,
            lastJobDate = latestDate
        )
    }

    val customers = totalsByCustomer.values.sortedByDescending { it.total }

    return EarningsScreenSummary(
        todayTotal = todayTotal,
        monthTotal = monthTotal,
        allTimeTotal = allTimeTotal,
        customers = customers
    )
}

private fun currentIndianDayKey(): String {
    return LocalDate.now(ZoneId.of("Asia/Kolkata")).toString()
}

private fun currentIndianMonthKey(): String {
    return YearMonth.now(ZoneId.of("Asia/Kolkata")).toString()
}

private fun bookingDayKey(dateStr: String?): String? {
    val instant = parseBookingInstant(dateStr) ?: return null
    return instant.atZone(ZoneId.of("Asia/Kolkata")).toLocalDate().toString()
}

private fun bookingMonthKey(dateStr: String?): String? {
    val instant = parseBookingInstant(dateStr) ?: return null
    return YearMonth.from(instant.atZone(ZoneId.of("Asia/Kolkata"))).toString()
}

private fun parseBookingInstant(dateStr: String?): Instant? {
    if (dateStr.isNullOrBlank()) return null
    return try {
        val clean = dateStr.substringBefore("[").trim()
        Instant.parse(if (clean.endsWith("Z")) clean else "${clean}Z")
    } catch (_: Exception) {
        null
    }
}

private fun formatDateShort(dateStr: String): String {
    val instant = parseBookingInstant(dateStr) ?: return dateStr.take(10)
    val localDate = instant.atZone(ZoneId.of("Asia/Kolkata")).toLocalDate()
    return localDate.format(DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH))
}

private fun formatRupees(amount: Double): String {
    val formatter = NumberFormat.getNumberInstance(Locale("en", "IN")).apply {
        maximumFractionDigits = 0
    }
    return "₹${formatter.format(amount)}"
}
