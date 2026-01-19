package com.doorstep.tn.customer.ui.cart

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.customer.data.model.CartItem
import com.doorstep.tn.customer.ui.CustomerViewModel

/**
 * Cart Screen - Matches web app's /customer/cart page exactly
 * 
 * Features:
 * 1. Cart items list with quantity controls (+/-)
 * 2. Available Promotions section
 * 3. Delivery Method selector (Pickup / Delivery)
 * 4. Payment Method selector (UPI / Cash / Pay Later)
 * 5. Order Summary (Subtotal, Total)
 * 6. Place Order button
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CartScreen(
    viewModel: CustomerViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToProducts: () -> Unit,
    onOrderComplete: () -> Unit
) {
    val cartItems by viewModel.cartItems.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val userId by viewModel.userId.collectAsState()
    
    val activePromotions by viewModel.activePromotions.collectAsState()
    val selectedPromotion by viewModel.selectedPromotion.collectAsState()

    // Shop info state - fetched to check delivery options
    var shopInfo by remember { mutableStateOf<com.doorstep.tn.customer.data.model.Shop?>(null) }
    var isLoadingShop by remember { mutableStateOf(false) }
    
    // Delivery and Payment method state - matches web defaults
    var deliveryMethod by remember { mutableStateOf("pickup") } // "pickup" or "delivery"
    var paymentMethod by remember { mutableStateOf("upi") } // "upi", "cash", "pay_later"
    var isPlacingOrder by remember { mutableStateOf(false) }
    
    // Calculate totals
    val subtotal = cartItems.sumOf { 
        (it.product.price.toDoubleOrNull() ?: 0.0) * it.quantity 
    }
    
    // Calculate Discount
    val discountAmount = remember(subtotal, selectedPromotion) {
        val promo = selectedPromotion
        if (promo != null) {
            // Check min order amount
            if (promo.minOrderAmount != null && subtotal < promo.minOrderAmount) {
                0.0
            } else {
                if (promo.type == "percentage") {
                    val calculated = subtotal * (promo.value / 100.0)
                    if (promo.maxDiscount != null) {
                        minOf(calculated, promo.maxDiscount)
                    } else {
                        calculated
                    }
                } else {
                    // Fixed amount
                    promo.value
                }
            }
        } else {
            0.0
        }
    }
    
    val total = if (subtotal > 0) (subtotal - discountAmount).coerceAtLeast(0.0) else 0.0
    
    // Load cart on first composition
    LaunchedEffect(Unit) {
        viewModel.loadCart()
    }
    
    // Fetch shop info and promotions when cart items are loaded
    LaunchedEffect(cartItems) {
        if (cartItems.isNotEmpty()) {
            val shopId = cartItems.firstOrNull()?.product?.shopId
            if (shopId != null) {
                // Load Promotions
                viewModel.loadActivePromotions(shopId)
                
                if (shopInfo?.id != shopId) {
                    isLoadingShop = true
                    viewModel.getShopById(shopId) { shop ->
                        shopInfo = shop
                        isLoadingShop = false
                        // Reset delivery method based on shop availability (like web)
                        if (shop != null) {
                            if (shop.pickupAvailable && !shop.deliveryAvailable) {
                                deliveryMethod = "pickup"
                            } else if (!shop.pickupAvailable && shop.deliveryAvailable) {
                                deliveryMethod = "delivery"
                            }
                        }
                    }
                }
            }
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Shopping Cart", color = WhiteText) },
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
        if (isLoading) {
            Box(
                modifier = Modifier.fillMaxSize().padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = OrangePrimary)
            }
        } else if (cartItems.isEmpty()) {
            // Empty Cart State
            Box(
                modifier = Modifier.fillMaxSize().padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Default.ShoppingCart,
                        contentDescription = null,
                        tint = WhiteTextMuted,
                        modifier = Modifier.size(64.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Your cart is empty",
                        style = MaterialTheme.typography.titleLarge,
                        color = WhiteText
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Add products to start shopping",
                        style = MaterialTheme.typography.bodyMedium,
                        color = WhiteTextMuted
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(
                        onClick = onNavigateToProducts,
                        colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Browse Products")
                    }
                }
            }
        } else {
            // Cart with items - matches web layout
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // ==================== Cart Items ====================
                items(cartItems) { item ->
                    CartItemCard(
                        item = item,
                        onUpdateQuantity = { newQty ->
                            viewModel.updateCartQuantity(item.productId, newQty)
                        },
                        onRemove = { viewModel.removeFromCart(item.productId) }
                    )
                }
                
                // ==================== Available Promotions Section ====================
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = SlateCard)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.LocalOffer,
                                    contentDescription = null,
                                    tint = OrangePrimary,
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Available Promotions",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = WhiteText,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Spacer(modifier = Modifier.height(12.dp))
                            
                            if (activePromotions.isEmpty()) {
                                Text(
                                    text = "No promotions available for this shop",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = WhiteTextMuted
                                )
                            } else {
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    // "No promotion" option - matches web
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(if (selectedPromotion == null) OrangePrimary.copy(alpha = 0.1f) else Color.Transparent)
                                            .clickable { viewModel.selectPromotion(null) }
                                            .padding(8.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        RadioButton(
                                            selected = selectedPromotion == null,
                                            onClick = { viewModel.selectPromotion(null) },
                                            colors = RadioButtonDefaults.colors(
                                                selectedColor = OrangePrimary,
                                                unselectedColor = WhiteTextMuted
                                            )
                                        )
                                        Text(
                                            text = "No promotion",
                                            style = MaterialTheme.typography.titleSmall,
                                            color = WhiteText,
                                            fontWeight = FontWeight.Medium
                                        )
                                    }
                                    activePromotions.forEach { promo ->
                                        // Filter out invalid ones based on min amount
                                        val isEligible = promo.minOrderAmount == null || subtotal >= promo.minOrderAmount
                                        
                                        // Calculate uses remaining
                                        val usesRemaining = if (promo.usageLimit != null) {
                                            promo.usageLimit - (promo.usedCount ?: 0)
                                        } else null
                                        
                                        // Format value display
                                        val valueDisplay = if (promo.type == "percentage") {
                                            "${promo.value.toInt()}% off"
                                        } else {
                                            "₹${promo.value.toInt()} off"
                                        }
                                        
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(8.dp))
                                                .background(if (selectedPromotion?.id == promo.id) OrangePrimary.copy(alpha = 0.1f) else Color.Transparent)
                                                .clickable(enabled = isEligible) {
                                                    if (selectedPromotion?.id == promo.id) {
                                                        viewModel.selectPromotion(null) // Deselect
                                                    } else {
                                                        viewModel.selectPromotion(promo)
                                                    }
                                                }
                                                .padding(8.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            RadioButton(
                                                selected = selectedPromotion?.id == promo.id,
                                                onClick = {
                                                    if (selectedPromotion?.id == promo.id) {
                                                        viewModel.selectPromotion(null)
                                                    } else {
                                                        viewModel.selectPromotion(promo)
                                                    }
                                                },
                                                enabled = isEligible,
                                                colors = RadioButtonDefaults.colors(
                                                    selectedColor = OrangePrimary,
                                                    unselectedColor = WhiteTextMuted
                                                )
                                            )
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(
                                                    text = promo.code,
                                                    style = MaterialTheme.typography.titleSmall,
                                                    color = if (isEligible) WhiteText else WhiteTextMuted,
                                                    fontWeight = FontWeight.Bold
                                                )
                                                Text(
                                                    text = promo.description ?: promo.name,
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = WhiteTextMuted
                                                )
                                                // Uses remaining - matches web
                                                if (usesRemaining != null) {
                                                    Text(
                                                        text = "$usesRemaining uses remaining",
                                                        style = MaterialTheme.typography.bodySmall,
                                                        color = WhiteTextMuted
                                                    )
                                                }
                                                if (!isEligible) {
                                                    Text(
                                                        text = "Min order: ₹${promo.minOrderAmount}",
                                                        style = MaterialTheme.typography.bodySmall,
                                                        color = ErrorRed
                                                    )
                                                }
                                            }
                                            // Value badge - matches web "2% off"
                                            Surface(
                                                shape = RoundedCornerShape(8.dp),
                                                color = GlassWhite
                                            ) {
                                                Text(
                                                    text = valueDisplay,
                                                    style = MaterialTheme.typography.labelMedium,
                                                    color = WhiteText,
                                                    fontWeight = FontWeight.Medium,
                                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                
                // ==================== Delivery Method Section ====================
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = SlateCard)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "Delivery Method",
                                style = MaterialTheme.typography.titleMedium,
                                color = WhiteText,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            
                            // Check shop delivery availability (like web)
                            val pickupAvailable = shopInfo?.pickupAvailable ?: true
                            val deliveryAvailable = shopInfo?.deliveryAvailable ?: false
                            
                            // Pickup Option - always show if available (like web)
                            if (pickupAvailable) {
                                DeliveryMethodOption(
                                    icon = Icons.Default.Store,
                                    title = "I will come take it",
                                    subtitle = "In-store pickup",
                                    isSelected = deliveryMethod == "pickup",
                                    onClick = { deliveryMethod = "pickup" }
                                )
                            }
                            
                            // Delivery Option - only show if shop enables home delivery (like web)
                            if (deliveryAvailable) {
                                if (pickupAvailable) {
                                    Spacer(modifier = Modifier.height(8.dp))
                                }
                                DeliveryMethodOption(
                                    icon = Icons.Default.LocalShipping,
                                    title = "Deliver to me",
                                    subtitle = "Home delivery",
                                    isSelected = deliveryMethod == "delivery",
                                    onClick = { deliveryMethod = "delivery" }
                                )
                            }
                            
                            // If neither is available, show a message
                            if (!pickupAvailable && !deliveryAvailable) {
                                Text(
                                    text = "Loading delivery options...",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = WhiteTextMuted
                                )
                            }
                        }
                    }
                }
                
                // ==================== Payment Method Section ====================
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = SlateCard)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "Payment Method",
                                style = MaterialTheme.typography.titleMedium,
                                color = WhiteText,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            
                            // UPI Option
                            PaymentMethodOption(
                                label = "UPI",
                                isSelected = paymentMethod == "upi",
                                onClick = { paymentMethod = "upi" }
                            )
                            
                            Spacer(modifier = Modifier.height(8.dp))
                            
                            // Cash Option
                            PaymentMethodOption(
                                label = "Cash",
                                isSelected = paymentMethod == "cash",
                                onClick = { paymentMethod = "cash" }
                            )
                            
                            Spacer(modifier = Modifier.height(8.dp))
                            
                            // Pay Later Option - show if shop allows it (matching web)
                            val isPayLaterAllowed = shopInfo?.allowPayLater == true
                            val isUserWhitelisted = shopInfo?.payLaterWhitelist?.contains(userId) == true
                                
                            if (isPayLaterAllowed) {
                                PaymentMethodOption(
                                    label = "Pay Later",
                                    isSelected = paymentMethod == "pay_later",
                                    onClick = { paymentMethod = "pay_later" }
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Trusted (repeat or whitelisted) customers can request Pay Later. Orders stay pending until the shop approves the credit.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = WhiteTextMuted
                                )
                            }
                        }
                    }
                }
                
                // ==================== Order Summary Section ====================
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = SlateCard)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "Order Summary",
                                style = MaterialTheme.typography.titleMedium,
                                color = WhiteText,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            
                            // Subtotal
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Subtotal", color = WhiteTextMuted)
                                Text("₹${String.format("%.2f", subtotal)}", color = WhiteText)
                            }

                            // Discount
                            if (discountAmount > 0) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text("Discount (${selectedPromotion?.code})", color = SuccessGreen)
                                    Text("-₹${String.format("%.2f", discountAmount)}", color = SuccessGreen)
                                }
                            }
                            
                            Spacer(modifier = Modifier.height(8.dp))
                            HorizontalDivider(color = GlassWhite)
                            Spacer(modifier = Modifier.height(8.dp))
                            
                            // Total
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    "Total Amount",
                                    color = WhiteText,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    "₹${String.format("%.2f", total)}",
                                    color = OrangePrimary,
                                    fontWeight = FontWeight.Bold,
                                    style = MaterialTheme.typography.titleMedium
                                )
                            }
                        }
                    }
                }
                
                // ==================== Place Order Button ====================
                item {
                    Button(
                        onClick = {
                            isPlacingOrder = true
                            viewModel.placeOrder(
                                deliveryMethod = deliveryMethod,
                                paymentMethod = paymentMethod,
                                subtotal = subtotal.toString(),
                                total = total.toString(),
                                discount = discountAmount.toString(),
                                promotionId = selectedPromotion?.id,
                                onSuccess = {
                                    isPlacingOrder = false
                                    onOrderComplete()
                                },
                                onError = { 
                                    isPlacingOrder = false 
                                }
                            )
                        },
                        enabled = !isPlacingOrder,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = OrangePrimary,
                            disabledContainerColor = OrangePrimary.copy(alpha = 0.5f)
                        )
                    ) {
                        if (isPlacingOrder) {
                            CircularProgressIndicator(
                                color = WhiteText,
                                modifier = Modifier.size(24.dp)
                            )
                        } else {
                            Text(
                                text = "Place Order",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
                
                // Bottom spacing
                item { Spacer(modifier = Modifier.height(24.dp)) }
            }
        }
    }
}

@Composable
private fun CartItemCard(
    item: CartItem,
    onUpdateQuantity: (Int) -> Unit,
    onRemove: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Product Image
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(GlassWhite),
                contentAlignment = Alignment.Center
            ) {
                if (!item.product.images.isNullOrEmpty()) {
                    AsyncImage(
                        model = item.product.images!!.first(),
                        contentDescription = item.product.name,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.ShoppingBag,
                        contentDescription = null,
                        tint = WhiteTextMuted,
                        modifier = Modifier.size(32.dp)
                    )
                }
            }
            
            Spacer(modifier = Modifier.width(16.dp))
            
            // Product Info
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.product.name,
                    style = MaterialTheme.typography.titleSmall,
                    color = WhiteText,
                    fontWeight = FontWeight.Medium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                
                Text(
                    text = "₹${item.product.price} × ${item.quantity}",
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                // Quantity Controls (like web: - 1 +)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(0.dp)
                ) {
                    // Minus Button
                    IconButton(
                        onClick = { 
                            if (item.quantity > 1) {
                                onUpdateQuantity(item.quantity - 1)
                            }
                        },
                        modifier = Modifier
                            .size(32.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(GlassWhite)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Remove,
                            contentDescription = "Decrease",
                            tint = WhiteText,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                    
                    // Quantity
                    Text(
                        text = "${item.quantity}",
                        style = MaterialTheme.typography.titleSmall,
                        color = WhiteText,
                        modifier = Modifier.padding(horizontal = 16.dp)
                    )
                    
                    // Plus Button
                    IconButton(
                        onClick = { onUpdateQuantity(item.quantity + 1) },
                        modifier = Modifier
                            .size(32.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(GlassWhite)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = "Increase",
                            tint = WhiteText,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
            
            // Price and Delete
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "₹${String.format("%.2f", (item.product.price.toDoubleOrNull() ?: 0.0) * item.quantity)}",
                    style = MaterialTheme.typography.titleMedium,
                    color = OrangePrimary,
                    fontWeight = FontWeight.Bold
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                // Delete Button
                IconButton(
                    onClick = onRemove,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "Remove",
                        tint = Color(0xFFEF4444) // Red color for delete
                    )
                }
            }
        }
    }
}

@Composable
private fun DeliveryMethodOption(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = if (isSelected) OrangePrimary.copy(alpha = 0.15f) else GlassWhite,
        border = if (isSelected) androidx.compose.foundation.BorderStroke(2.dp, OrangePrimary) else null
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (isSelected) OrangePrimary else WhiteTextMuted,
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyMedium,
                    color = WhiteText,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextMuted
                )
            }
            if (isSelected) {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = "Selected",
                    tint = OrangePrimary
                )
            }
        }
    }
}

@Composable
private fun PaymentMethodOption(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically
    ) {
        RadioButton(
            selected = isSelected,
            onClick = onClick,
            colors = RadioButtonDefaults.colors(
                selectedColor = OrangePrimary,
                unselectedColor = WhiteTextMuted
            )
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = WhiteText
        )
    }
}
