package com.doorstep.tn.shop.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.shop.data.model.ActiveBoardOrder
import com.doorstep.tn.shop.data.model.ReturnRequest
import com.doorstep.tn.shop.data.model.ShopOrder

/**
 * Shop Orders Screen with board, list, returns, and pay-later management
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShopOrdersScreen(
    viewModel: ShopViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToDetail: (Int) -> Unit = {}
) {
    val activeBoard by viewModel.activeBoard.collectAsState()
    val orders by viewModel.orders.collectAsState()
    val returnRequests by viewModel.returnRequests.collectAsState()
    val payLaterWhitelist by viewModel.payLaterWhitelist.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()

    var selectedTab by remember { mutableStateOf(0) }
    var statusFilter by remember { mutableStateOf("all") }
    var showBoardStatusDialog by remember { mutableStateOf<ActiveBoardOrder?>(null) }
    var showOrderStatusDialog by remember { mutableStateOf<ShopOrder?>(null) }
    var showPayLaterDialog by remember { mutableStateOf(false) }
    var quoteTotals by remember { mutableStateOf<Map<Int, String>>(emptyMap()) }

    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) {
        viewModel.loadActiveOrdersBoard()
        viewModel.loadOrders()
        viewModel.loadReturnRequests()
        viewModel.loadPayLaterWhitelist()
    }

    LaunchedEffect(statusFilter) {
        viewModel.loadOrders(statusFilter.takeIf { it != "all" })
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
                        text = "Orders",
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
                    IconButton(onClick = {
                        viewModel.loadActiveOrdersBoard()
                        viewModel.loadOrders(statusFilter.takeIf { it != "all" })
                        viewModel.loadReturnRequests()
                        viewModel.loadPayLaterWhitelist()
                    }) {
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
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = SlateDarker
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = SlateBackground,
                contentColor = ShopGreen
            ) {
                Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }, text = { Text("Orders") })
                Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }, text = { Text("Returns") })
                Tab(selected = selectedTab == 2, onClick = { selectedTab = 2 }, text = { Text("Khata") })
            }

            when (selectedTab) {
                0 -> {
                    OrderListView(
                        orders = orders,
                        statusFilter = statusFilter,
                        onStatusFilterChange = { statusFilter = it },
                        quoteTotals = quoteTotals,
                        onQuoteChange = { orderId, value ->
                            quoteTotals = quoteTotals + (orderId to value)
                        },
                        onSendQuote = { orderId, total ->
                            viewModel.quoteTextOrder(orderId, total) {
                                quoteTotals = quoteTotals - orderId
                            }
                        },
                        onUpdateStatus = { showOrderStatusDialog = it },
                        onConfirmPayment = { viewModel.confirmPayment(it) },
                        onApprovePayLater = { viewModel.approvePayLater(it) },
                        onOpenDetails = { onNavigateToDetail(it) }
                    )
                }
                1 -> {
                    ReturnsListView(
                        requests = returnRequests,
                        onApprove = { id -> viewModel.approveReturnRequest(id) },
                        onReject = { id -> viewModel.rejectReturnRequest(id) }
                    )
                }
                else -> {
                    PayLaterListView(
                        whitelist = payLaterWhitelist?.customers ?: emptyList(),
                        onAdd = { showPayLaterDialog = true },
                        onRemove = { viewModel.removeFromPayLaterWhitelist(it) }
                    )
                }
            }
        }
    }

    showBoardStatusDialog?.let { order ->
        StatusUpdateDialog(
            orderId = order.id,
            currentStatus = order.status,
            onDismiss = { showBoardStatusDialog = null },
            onUpdate = { status, comments, trackingInfo ->
                viewModel.updateOrderStatus(order.id, status, comments, trackingInfo) {
                    showBoardStatusDialog = null
                }
            }
        )
    }

    showOrderStatusDialog?.let { order ->
        StatusUpdateDialog(
            orderId = order.id,
            currentStatus = order.status,
            onDismiss = { showOrderStatusDialog = null },
            onUpdate = { status, comments, trackingInfo ->
                viewModel.updateOrderStatus(order.id, status, comments, trackingInfo) {
                    showOrderStatusDialog = null
                }
            }
        )
    }

    if (showPayLaterDialog) {
        AddPayLaterCustomerDialog(
            onDismiss = { showPayLaterDialog = false },
            onConfirm = { phone ->
                viewModel.addToPayLaterWhitelist(phone) {
                    showPayLaterDialog = false
                }
            }
        )
    }
}

@Composable
private fun OrderColumn(
    title: String,
    orders: List<ActiveBoardOrder>,
    color: Color,
    onOrderClick: (ActiveBoardOrder) -> Unit,
    onStatusChange: (ActiveBoardOrder, String) -> Unit
) {
    Column(
        modifier = Modifier
            .width(280.dp)
            .fillMaxHeight()
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp, bottomStart = 0.dp, bottomEnd = 0.dp),
            colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.2f))
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    color = color,
                    fontWeight = FontWeight.Bold
                )
                Badge(containerColor = color) { Text("${orders.size}") }
            }
        }

        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .clip(RoundedCornerShape(bottomStart = 12.dp, bottomEnd = 12.dp))
                .background(SlateCard.copy(alpha = 0.5f)),
            contentPadding = PaddingValues(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (orders.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No orders",
                            color = WhiteTextMuted,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            } else {
                items(orders) { order ->
                    BoardOrderCard(order = order, accentColor = color, onClick = { onOrderClick(order) })
                }
            }
        }
    }
}

@Composable
private fun BoardOrderCard(
    order: ActiveBoardOrder,
    accentColor: Color,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "#${order.id}",
                    style = MaterialTheme.typography.titleSmall,
                    color = WhiteText,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = order.displayTotal,
                    style = MaterialTheme.typography.bodyMedium,
                    color = accentColor,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = order.customerName,
                style = MaterialTheme.typography.bodyMedium,
                color = WhiteText
            )

            Text(
                text = "${order.items.size} items",
                style = MaterialTheme.typography.bodySmall,
                color = WhiteTextMuted
            )

            order.items.take(2).forEach { item ->
                Text(
                    text = "• ${item.quantity}x ${item.name}",
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            if (order.items.size > 2) {
                Text(
                    text = "+${order.items.size - 2} more",
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            if (order.paymentStatus != null) {
                PaymentStatusChip(status = order.paymentStatus)
            }
        }
    }
}

@Composable
private fun OrderListView(
    orders: List<ShopOrder>,
    statusFilter: String,
    onStatusFilterChange: (String) -> Unit,
    quoteTotals: Map<Int, String>,
    onQuoteChange: (Int, String) -> Unit,
    onSendQuote: (Int, String) -> Unit,
    onUpdateStatus: (ShopOrder) -> Unit,
    onConfirmPayment: (Int) -> Unit,
    onApprovePayLater: (Int) -> Unit,
    onOpenDetails: (Int) -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        StatusFilterRow(
            selected = statusFilter,
            onSelected = onStatusFilterChange
        )

        if (orders.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No orders found", color = WhiteTextMuted)
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(orders) { order ->
                    OrderListCard(
                        order = order,
                        quoteValue = quoteTotals[order.id] ?: "",
                        onQuoteChange = { onQuoteChange(order.id, it) },
                        onSendQuote = { total -> onSendQuote(order.id, total) },
                        onUpdateStatus = { onUpdateStatus(order) },
                        onConfirmPayment = { onConfirmPayment(order.id) },
                        onApprovePayLater = { onApprovePayLater(order.id) },
                        onOpenDetails = { onOpenDetails(order.id) }
                    )
                }
            }
        }
    }
}

@Composable
private fun StatusFilterRow(
    selected: String,
    onSelected: (String) -> Unit
) {
    val options = listOf(
        "all" to "All",
        "pending" to "Pending",
        "awaiting_customer_agreement" to "Awaiting Agreement",
        "confirmed" to "Confirmed",
        "processing" to "Processing",
        "packed" to "Packed",
        "dispatched" to "Dispatched",
        "shipped" to "Shipped",
        "delivered" to "Delivered",
        "cancelled" to "Cancelled"
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        options.forEach { (value, label) ->
            FilterChip(
                selected = selected == value,
                onClick = { onSelected(value) },
                label = { Text(label) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = ShopGreen,
                    selectedLabelColor = WhiteText
                )
            )
        }
    }
}

@Composable
private fun OrderListCard(
    order: ShopOrder,
    quoteValue: String,
    onQuoteChange: (String) -> Unit,
    onSendQuote: (String) -> Unit,
    onUpdateStatus: () -> Unit,
    onConfirmPayment: () -> Unit,
    onApprovePayLater: () -> Unit,
    onOpenDetails: () -> Unit
) {
    val canQuoteOrder = order.orderType == "text_order" &&
        listOf("pending", "awaiting_customer_agreement").contains(order.status)

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Order #${order.id}",
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = order.customerName,
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted
                    )
                }
                StatusBadge(status = order.status)
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(order.displayTotal, color = ShopGreen, fontWeight = FontWeight.Bold)
                if (order.paymentStatus != null) {
                    PaymentStatusChip(status = order.paymentStatus)
                }
            }

            if (order.orderType == "text_order") {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = order.orderText ?: "No order text provided",
                    color = WhiteTextMuted,
                    style = MaterialTheme.typography.bodySmall
                )
            }

            if (canQuoteOrder) {
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = quoteValue,
                        onValueChange = onQuoteChange,
                        label = { Text("Final bill (₹)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    Button(
                        onClick = { if (quoteValue.isNotBlank()) onSendQuote(quoteValue) },
                        enabled = quoteValue.isNotBlank()
                    ) {
                        Text(if (order.status == "awaiting_customer_agreement") "Update bill" else "Send bill")
                    }
                }
            }

            if (order.paymentMethod == "pay_later" &&
                order.paymentStatus == "pending" &&
                order.status == "confirmed"
            ) {
                Spacer(modifier = Modifier.height(12.dp))
                Button(onClick = onApprovePayLater) {
                    Text("Approve Credit")
                }
            }

            if ((order.paymentStatus == "verifying" ||
                (order.paymentMethod == "cash" && order.paymentStatus == "pending")) &&
                order.status == "confirmed"
            ) {
                Spacer(modifier = Modifier.height(12.dp))
                Button(onClick = onConfirmPayment) {
                    Text("Confirm Payment")
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                TextButton(onClick = onUpdateStatus) { Text("Update Status") }
                Spacer(modifier = Modifier.width(8.dp))
                TextButton(onClick = onOpenDetails) { Text("Details") }
            }
        }
    }
}

@Composable
private fun ReturnsListView(
    requests: List<ReturnRequest>,
    onApprove: (Int) -> Unit,
    onReject: (Int) -> Unit
) {
    if (requests.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No return requests", color = WhiteTextMuted)
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(requests) { request ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = SlateCard)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Return #${request.id} (Order #${request.orderId ?: "-"})",
                        style = MaterialTheme.typography.titleMedium,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Status: ${request.status ?: "pending"}",
                        color = WhiteTextMuted,
                        style = MaterialTheme.typography.bodySmall
                    )
                    request.reason?.let {
                        Text(
                            text = "Reason: $it",
                            color = WhiteTextMuted,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    request.description?.let {
                        Text(
                            text = it,
                            color = WhiteTextMuted,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    if (request.status == "pending" || request.status == "requested") {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = { onApprove(request.id) }) { Text("Approve") }
                            OutlinedButton(onClick = { onReject(request.id) }) { Text("Reject") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PayLaterListView(
    whitelist: List<com.doorstep.tn.shop.data.model.PayLaterCustomer>,
    onAdd: () -> Unit,
    onRemove: (Int) -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Khata Customers",
                style = MaterialTheme.typography.titleMedium,
                color = WhiteText,
                fontWeight = FontWeight.Bold
            )
            Button(onClick = onAdd) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(4.dp))
                Text("Add")
            }
        }

        if (whitelist.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No customers added", color = WhiteTextMuted)
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(whitelist) { customer ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        colors = CardDefaults.cardColors(containerColor = SlateCard)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(customer.name ?: "Unknown", color = WhiteText)
                                Text(customer.phone ?: "No phone", color = WhiteTextMuted, style = MaterialTheme.typography.bodySmall)
                            }
                            IconButton(onClick = { onRemove(customer.id) }) {
                                Icon(Icons.Default.Remove, contentDescription = "Remove", tint = ErrorRed)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PaymentStatusChip(status: String) {
    val (bgColor, textColor) = when (status) {
        "paid" -> ShopGreen.copy(alpha = 0.2f) to ShopGreen
        "pending" -> WarningYellow.copy(alpha = 0.2f) to WarningYellow
        "verifying" -> OrangePrimary.copy(alpha = 0.2f) to OrangePrimary
        "failed" -> ErrorRed.copy(alpha = 0.2f) to ErrorRed
        else -> GlassWhite to WhiteTextMuted
    }

    Surface(
        shape = RoundedCornerShape(4.dp),
        color = bgColor
    ) {
        Text(
            text = status.replaceFirstChar { it.uppercase() },
            style = MaterialTheme.typography.labelSmall,
            color = textColor,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
        )
    }
}

@Composable
private fun StatusBadge(status: String) {
    val (color, label) = when (status.lowercase()) {
        "pending" -> OrangePrimary to "Pending"
        "awaiting_customer_agreement" -> WarningYellow to "Awaiting"
        "confirmed" -> ProviderBlue to "Confirmed"
        "processing" -> ProviderBlue to "Processing"
        "packed" -> WarningYellow to "Packed"
        "dispatched", "shipped" -> ShopGreen to "Dispatched"
        "delivered" -> ShopGreen to "Delivered"
        "cancelled" -> ErrorRed to "Cancelled"
        else -> WhiteTextMuted to status
    }

    Surface(shape = RoundedCornerShape(8.dp), color = color.copy(alpha = 0.2f)) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = color,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun StatusUpdateDialog(
    orderId: Int,
    currentStatus: String,
    onDismiss: () -> Unit,
    onUpdate: (String, String?, String?) -> Unit
) {
    var selectedStatus by remember { mutableStateOf(currentStatus) }
    var comments by remember { mutableStateOf("") }
    var trackingInfo by remember { mutableStateOf("") }

    val statuses = listOf(
        "pending",
        "awaiting_customer_agreement",
        "confirmed",
        "processing",
        "packed",
        "dispatched",
        "shipped",
        "delivered",
        "cancelled"
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Update Order #$orderId") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                ExposedDropdownMenuBox(
                    expanded = false,
                    onExpandedChange = {}
                ) {
                    OutlinedTextField(
                        value = selectedStatus,
                        onValueChange = { selectedStatus = it },
                        label = { Text("Status") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    statuses.forEach { status ->
                        TextButton(
                            onClick = { selectedStatus = status },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = status.replaceFirstChar { it.uppercase() },
                                color = if (selectedStatus == status) ShopGreen else WhiteText
                            )
                        }
                    }
                }
                OutlinedTextField(
                    value = comments,
                    onValueChange = { comments = it },
                    label = { Text("Comments (optional)") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = trackingInfo,
                    onValueChange = { trackingInfo = it },
                    label = { Text("Tracking Info (optional)") },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onUpdate(selectedStatus, comments.ifBlank { null }, trackingInfo.ifBlank { null }) }) {
                Text("Update")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
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
