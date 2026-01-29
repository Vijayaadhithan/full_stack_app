package com.doorstep.tn.shop.data.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Shop-specific data models matching web app's TypeScript interfaces
 */

// ─── Dashboard Stats ────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class DashboardStats(
    @Json(name = "pendingOrders") val pendingOrders: Int = 0,
    @Json(name = "ordersInProgress") val ordersInProgress: Int = 0,
    @Json(name = "completedOrders") val completedOrders: Int = 0,
    @Json(name = "totalProducts") val totalProducts: Int = 0,
    @Json(name = "lowStockItems") val lowStockItems: Int = 0,
    @Json(name = "earningsToday") val earningsToday: Double = 0.0,
    @Json(name = "earningsMonth") val earningsMonth: Double = 0.0,
    @Json(name = "earningsTotal") val earningsTotal: Double = 0.0,
    @Json(name = "customerSpendTotals") val customerSpendTotals: List<CustomerSpendTotal> = emptyList(),
    @Json(name = "itemSalesTotals") val itemSalesTotals: List<ItemSalesTotal> = emptyList()
)

@JsonClass(generateAdapter = true)
data class CustomerSpendTotal(
    @Json(name = "customerId") val customerId: Int,
    @Json(name = "name") val name: String? = null,
    @Json(name = "phone") val phone: String? = null,
    @Json(name = "totalSpent") val totalSpent: Double = 0.0,
    @Json(name = "orderCount") val orderCount: Int = 0
)

@JsonClass(generateAdapter = true)
data class ItemSalesTotal(
    @Json(name = "productId") val productId: Int,
    @Json(name = "name") val name: String? = null,
    @Json(name = "quantity") val quantity: Int = 0,
    @Json(name = "totalAmount") val totalAmount: Double = 0.0
)

// ─── Shop Orders ────────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class ShopOrder(
    @Json(name = "id") val id: Int,
    @Json(name = "customerId") val customerId: Int? = null,
    @Json(name = "shopId") val shopId: Int? = null,
    @Json(name = "status") val status: String,
    @Json(name = "paymentStatus") val paymentStatus: String? = null,
    @Json(name = "paymentMethod") val paymentMethod: String? = null,
    @Json(name = "deliveryMethod") val deliveryMethod: String? = null,
    @Json(name = "orderType") val orderType: String? = null,
    @Json(name = "orderText") val orderText: String? = null,
    @Json(name = "shippingAddress") val shippingAddress: String? = null,
    @Json(name = "billingAddress") val billingAddress: String? = null,
    @Json(name = "trackingInfo") val trackingInfo: String? = null,
    @Json(name = "paymentReference") val paymentReference: String? = null,
    @Json(name = "notes") val notes: String? = null,
    @Json(name = "returnRequested") val returnRequested: Boolean? = null,
    @Json(name = "total") val total: String? = null,
    @Json(name = "orderDate") val orderDate: String? = null,
    @Json(name = "createdAt") val createdAt: String? = null,
    @Json(name = "updatedAt") val updatedAt: String? = null,
    @Json(name = "customer") val customer: ShopOrderCustomer? = null,
    @Json(name = "items") val items: List<ShopOrderItem> = emptyList()
) {
    val isPending: Boolean get() = status == "pending"
    val isConfirmed: Boolean get() = status == "confirmed"
    val isProcessing: Boolean get() = status == "processing"
    val isPacked: Boolean get() = status == "packed"
    val isDispatched: Boolean get() = status == "dispatched"
    val isDelivered: Boolean get() = status == "delivered"
    val isCancelled: Boolean get() = status == "cancelled"
    
    val totalValue: Double get() = total?.toDoubleOrNull() ?: 0.0
    val displayTotal: String get() = "₹${String.format("%.2f", totalValue)}"
    val customerName: String get() = customer?.name ?: "Unknown Customer"
}

@JsonClass(generateAdapter = true)
data class ShopOrderCustomer(
    @Json(name = "id") val id: Int? = null,
    @Json(name = "name") val name: String? = null,
    @Json(name = "phone") val phone: String? = null,
    @Json(name = "email") val email: String? = null,
    @Json(name = "address") val address: String? = null,
    @Json(name = "latitude") val latitude: Double? = null,
    @Json(name = "longitude") val longitude: Double? = null
)

@JsonClass(generateAdapter = true)
data class ShopOrderItem(
    @Json(name = "id") val id: Int,
    @Json(name = "productId") val productId: Int? = null,
    @Json(name = "name") val name: String,
    @Json(name = "quantity") val quantity: Int = 1,
    @Json(name = "price") val price: String? = null,
    @Json(name = "total") val total: String? = null
)

// ─── Active Board (Kanban View) ─────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class ActiveBoardResponse(
    @Json(name = "new") val new: List<ActiveBoardOrder> = emptyList(),
    @Json(name = "packing") val packing: List<ActiveBoardOrder> = emptyList(),
    @Json(name = "ready") val ready: List<ActiveBoardOrder> = emptyList()
) {
    // UI convenience properties
    val newOrders: List<ActiveBoardOrder> get() = new
    val packingOrders: List<ActiveBoardOrder> get() = packing
    val readyOrders: List<ActiveBoardOrder> get() = ready
}

data class ActiveBoardOrder(
    @Json(name = "id") val id: Int,
    @Json(name = "status") val status: String,
    @Json(name = "total") val total: Double = 0.0,
    @Json(name = "paymentStatus") val paymentStatus: String? = null,
    @Json(name = "deliveryMethod") val deliveryMethod: String? = null,
    @Json(name = "orderDate") val orderDate: String? = null,
    @Json(name = "customerName") private val _customerName: String? = null,
    @Json(name = "items") val items: List<ActiveBoardOrderItem> = emptyList()
) {
    val customerName: String get() = _customerName ?: "Unknown Customer"
    val displayTotal: String get() = "₹${String.format("%.2f", total)}"
}

@JsonClass(generateAdapter = true)
data class ActiveBoardOrderItem(
    @Json(name = "id") val id: Int,
    @Json(name = "productId") val productId: Int? = null,
    @Json(name = "name") val name: String,
    @Json(name = "quantity") val quantity: Int = 1
)

// ─── Shop Products ──────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class ShopProduct(
    @Json(name = "id") val id: Int,
    @Json(name = "shopId") val shopId: Int? = null,
    @Json(name = "name") val name: String,
    @Json(name = "description") val description: String? = null,
    @Json(name = "category") val category: String? = null,
    @Json(name = "price") val price: String? = null,
    @Json(name = "mrp") val mrp: String? = null,
    @Json(name = "stock") val stock: Int? = null,
    @Json(name = "lowStockThreshold") val lowStockThreshold: Int? = null,
    @Json(name = "weight") val weight: String? = null,
    @Json(name = "dimensions") val dimensions: ProductDimensions? = null,
    @Json(name = "sku") val sku: String? = null,
    @Json(name = "barcode") val barcode: String? = null,
    @Json(name = "specifications") val specifications: Map<String, String>? = null,
    @Json(name = "isAvailable") val isAvailable: Boolean = true,
    @Json(name = "tags") val tags: List<String> = emptyList(),
    @Json(name = "images") val images: List<String> = emptyList(),
    @Json(name = "minOrderQuantity") val minOrderQuantity: Int = 1,
    @Json(name = "maxOrderQuantity") val maxOrderQuantity: Int? = null,
    @Json(name = "createdAt") val createdAt: String? = null,
    @Json(name = "updatedAt") val updatedAt: String? = null
) {
    val priceAsDouble: Double? get() = price?.toDoubleOrNull()
    val displayPrice: String get() = price?.let { "₹$it" } ?: "Price not set"
    val isLowStock: Boolean get() = lowStockThreshold?.let { (stock ?: 0) <= it } ?: false
    val mainImage: String? get() = images.firstOrNull()
}

@JsonClass(generateAdapter = true)
data class ProductDimensions(
    @Json(name = "length") val length: Double? = null,
    @Json(name = "width") val width: Double? = null,
    @Json(name = "height") val height: Double? = null
)

// ─── Shop Promotions ────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class ShopPromotion(
    @Json(name = "id") val id: Int,
    @Json(name = "shopId") val shopId: Int,
    @Json(name = "name") val name: String,
    @Json(name = "description") val description: String? = null,
    @Json(name = "type") val type: String, // "percentage" or "fixed_amount"
    @Json(name = "value") val value: Double = 0.0,
    @Json(name = "code") val code: String? = null,
    @Json(name = "startDate") val startDate: String? = null,
    @Json(name = "endDate") val endDate: String? = null,
    @Json(name = "usageLimit") val usageLimit: Int? = null,
    @Json(name = "usedCount") val usedCount: Int? = null,
    @Json(name = "isActive") val isActive: Boolean = true
) {
    val displayValue: String get() = if (type == "percentage") "${value.toInt()}%" else "₹${value.toInt()}"
    val usesRemaining: Int? get() = usageLimit?.let { it - (usedCount ?: 0) }
}

// ─── Shop Workers ───────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class ShopWorker(
    @Json(name = "id") val id: Int,
    @Json(name = "workerNumber") val workerNumber: String? = null,
    @Json(name = "name") val name: String? = null,
    @Json(name = "email") val email: String? = null,
    @Json(name = "phone") val phone: String? = null,
    @Json(name = "responsibilities") val responsibilities: List<String> = emptyList(),
    @Json(name = "active") val active: Boolean = true,
    @Json(name = "createdAt") val createdAt: String? = null
)

@JsonClass(generateAdapter = true)
data class WorkerResponsibilitiesResponse(
    @Json(name = "all") val all: List<String> = emptyList(),
    @Json(name = "presets") val presets: Map<String, List<String>> = emptyMap()
)

// ─── Shop Reviews ───────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class ShopReview(
    @Json(name = "id") val id: Int,
    @Json(name = "productId") val productId: Int? = null,
    @Json(name = "orderId") val orderId: Int? = null,
    @Json(name = "customerId") val customerId: Int? = null,
    @Json(name = "rating") val rating: Int,
    @Json(name = "review") val review: String? = null,
    @Json(name = "shopReply") val shopReply: String? = null,
    @Json(name = "images") val images: List<String> = emptyList(),
    @Json(name = "createdAt") val createdAt: String? = null
) {
    val hasReply: Boolean get() = !shopReply.isNullOrBlank()
}

// ─── Pay-Later Whitelist ────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class PayLaterWhitelistResponse(
    @Json(name = "allowPayLater") val allowPayLater: Boolean = false,
    @Json(name = "customers") val customers: List<PayLaterCustomer> = emptyList(),
    @Json(name = "payLaterWhitelist") val payLaterWhitelist: List<Int> = emptyList()
)

@JsonClass(generateAdapter = true)
data class PayLaterCustomer(
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String? = null,
    @Json(name = "phone") val phone: String? = null,
    @Json(name = "email") val email: String? = null,
    @Json(name = "amountDue") val amountDue: Double = 0.0
)

// ─── Shop Profile ───────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class ShopProfile(
    @Json(name = "id") val id: Int,
    @Json(name = "ownerId") val ownerId: Int? = null,
    @Json(name = "shopName") val shopName: String? = null,
    @Json(name = "description") val description: String? = null,
    @Json(name = "businessType") val businessType: String? = null,
    @Json(name = "gstin") val gstin: String? = null,
    @Json(name = "isOpen") val isOpen: Boolean? = null,
    @Json(name = "catalogModeEnabled") val catalogModeEnabled: Boolean? = null,
    @Json(name = "openOrderMode") val openOrderMode: Boolean? = null,
    @Json(name = "allowPayLater") val allowPayLater: Boolean? = null,
    @Json(name = "payLaterWhitelist") val payLaterWhitelist: List<Int>? = null,
    @Json(name = "workingHours") val workingHours: ShopWorkingHours? = null,
    @Json(name = "shippingPolicy") val shippingPolicy: String? = null,
    @Json(name = "returnPolicy") val returnPolicy: String? = null,
    @Json(name = "bannerImageUrl") val bannerImageUrl: String? = null,
    @Json(name = "logoImageUrl") val logoImageUrl: String? = null,
    @Json(name = "shopAddressStreet") val shopAddressStreet: String? = null,
    @Json(name = "shopAddressArea") val shopAddressArea: String? = null,
    @Json(name = "shopAddressCity") val shopAddressCity: String? = null,
    @Json(name = "shopAddressState") val shopAddressState: String? = null,
    @Json(name = "shopAddressPincode") val shopAddressPincode: String? = null,
    @Json(name = "shopLocationLat") val shopLocationLat: String? = null,
    @Json(name = "shopLocationLng") val shopLocationLng: String? = null
)

@JsonClass(generateAdapter = true)
data class ShopWorkingHours(
    @Json(name = "from") val from: String? = null,
    @Json(name = "to") val to: String? = null,
    @Json(name = "days") val days: List<String> = emptyList()
)

// ─── Request Models ─────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class UpdateOrderStatusRequest(
    @Json(name = "status") val status: String,
    @Json(name = "comments") val comments: String? = null,
    @Json(name = "trackingInfo") val trackingInfo: String? = null
)

@JsonClass(generateAdapter = true)
data class CreateProductRequest(
    @Json(name = "name") val name: String,
    @Json(name = "description") val description: String? = null,
    @Json(name = "category") val category: String,
    @Json(name = "price") val price: String,
    @Json(name = "mrp") val mrp: String? = null,
    @Json(name = "stock") val stock: Int? = null,
    @Json(name = "lowStockThreshold") val lowStockThreshold: Int? = null,
    @Json(name = "weight") val weight: Double? = null,
    @Json(name = "dimensions") val dimensions: ProductDimensions? = null,
    @Json(name = "sku") val sku: String? = null,
    @Json(name = "barcode") val barcode: String? = null,
    @Json(name = "specifications") val specifications: Map<String, String>? = null,
    @Json(name = "isAvailable") val isAvailable: Boolean = true,
    @Json(name = "tags") val tags: List<String> = emptyList(),
    @Json(name = "minOrderQuantity") val minOrderQuantity: Int = 1,
    @Json(name = "maxOrderQuantity") val maxOrderQuantity: Int? = null
)

@JsonClass(generateAdapter = true)
data class UpdateProductRequest(
    @Json(name = "name") val name: String? = null,
    @Json(name = "description") val description: String? = null,
    @Json(name = "category") val category: String? = null,
    @Json(name = "price") val price: String? = null,
    @Json(name = "mrp") val mrp: String? = null,
    @Json(name = "stock") val stock: Int? = null,
    @Json(name = "lowStockThreshold") val lowStockThreshold: Int? = null,
    @Json(name = "weight") val weight: Double? = null,
    @Json(name = "dimensions") val dimensions: ProductDimensions? = null,
    @Json(name = "sku") val sku: String? = null,
    @Json(name = "barcode") val barcode: String? = null,
    @Json(name = "specifications") val specifications: Map<String, String>? = null,
    @Json(name = "isAvailable") val isAvailable: Boolean? = null,
    @Json(name = "tags") val tags: List<String>? = null,
    @Json(name = "minOrderQuantity") val minOrderQuantity: Int? = null,
    @Json(name = "maxOrderQuantity") val maxOrderQuantity: Int? = null
)

@JsonClass(generateAdapter = true)
data class CreatePromotionRequest(
    @Json(name = "name") val name: String,
    @Json(name = "description") val description: String? = null,
    @Json(name = "type") val type: String, // "percentage" or "fixed_amount"
    @Json(name = "value") val value: Double,
    @Json(name = "code") val code: String? = null,
    @Json(name = "usageLimit") val usageLimit: Int? = null,
    @Json(name = "isActive") val isActive: Boolean = true,
    @Json(name = "shopId") val shopId: Int,
    @Json(name = "expiryDays") val expiryDays: Int = 0
)

@JsonClass(generateAdapter = true)
data class UpdatePromotionRequest(
    @Json(name = "name") val name: String? = null,
    @Json(name = "description") val description: String? = null,
    @Json(name = "type") val type: String? = null,
    @Json(name = "value") val value: Double? = null,
    @Json(name = "code") val code: String? = null,
    @Json(name = "usageLimit") val usageLimit: Int? = null,
    @Json(name = "isActive") val isActive: Boolean? = null,
    @Json(name = "expiryDays") val expiryDays: Int? = null
)

@JsonClass(generateAdapter = true)
data class AddWorkerRequest(
    @Json(name = "workerNumber") val workerNumber: String,
    @Json(name = "name") val name: String,
    @Json(name = "email") val email: String? = null,
    @Json(name = "phone") val phone: String? = null,
    @Json(name = "pin") val pin: String,
    @Json(name = "responsibilities") val responsibilities: List<String> = emptyList()
)

@JsonClass(generateAdapter = true)
data class UpdateWorkerRequest(
    @Json(name = "name") val name: String? = null,
    @Json(name = "email") val email: String? = null,
    @Json(name = "phone") val phone: String? = null,
    @Json(name = "responsibilities") val responsibilities: List<String>? = null,
    @Json(name = "active") val active: Boolean? = null,
    @Json(name = "pin") val pin: String? = null
)

@JsonClass(generateAdapter = true)
data class ReviewReplyRequest(
    @Json(name = "reply") val reply: String
)

@JsonClass(generateAdapter = true)
data class UpdateShopProfileRequest(
    @Json(name = "name") val name: String? = null,
    @Json(name = "phone") val phone: String? = null,
    @Json(name = "email") val email: String? = null,
    @Json(name = "upiId") val upiId: String? = null,
    @Json(name = "pickupAvailable") val pickupAvailable: Boolean? = null,
    @Json(name = "deliveryAvailable") val deliveryAvailable: Boolean? = null,
    @Json(name = "returnsEnabled") val returnsEnabled: Boolean? = null,
    @Json(name = "addressStreet") val addressStreet: String? = null,
    @Json(name = "addressCity") val addressCity: String? = null,
    @Json(name = "addressState") val addressState: String? = null,
    @Json(name = "addressPostalCode") val addressPostalCode: String? = null,
    @Json(name = "addressCountry") val addressCountry: String? = null,
    @Json(name = "shopProfile") val shopProfile: ShopProfileUpdate? = null
)

@JsonClass(generateAdapter = true)
data class ShopProfileUpdate(
    @Json(name = "shopName") val shopName: String? = null,
    @Json(name = "description") val description: String? = null,
    @Json(name = "businessType") val businessType: String? = null,
    @Json(name = "gstin") val gstin: String? = null,
    @Json(name = "workingHours") val workingHours: ShopWorkingHours? = null,
    @Json(name = "shippingPolicy") val shippingPolicy: String? = null,
    @Json(name = "returnPolicy") val returnPolicy: String? = null,
    @Json(name = "catalogModeEnabled") val catalogModeEnabled: Boolean? = null,
    @Json(name = "openOrderMode") val openOrderMode: Boolean? = null,
    @Json(name = "allowPayLater") val allowPayLater: Boolean? = null,
    @Json(name = "payLaterWhitelist") val payLaterWhitelist: List<Int>? = null,
    @Json(name = "shopAddressStreet") val shopAddressStreet: String? = null,
    @Json(name = "shopAddressArea") val shopAddressArea: String? = null,
    @Json(name = "shopAddressCity") val shopAddressCity: String? = null,
    @Json(name = "shopAddressState") val shopAddressState: String? = null,
    @Json(name = "shopAddressPincode") val shopAddressPincode: String? = null,
    @Json(name = "shopLocationLat") val shopLocationLat: Double? = null,
    @Json(name = "shopLocationLng") val shopLocationLng: Double? = null
)

@JsonClass(generateAdapter = true)
data class AddToPayLaterRequest(
    @Json(name = "phone") val phone: String
)

@JsonClass(generateAdapter = true)
data class ReturnRequest(
    @Json(name = "id") val id: Int,
    @Json(name = "orderId") val orderId: Int? = null,
    @Json(name = "orderItemId") val orderItemId: Int? = null,
    @Json(name = "customerId") val customerId: Int? = null,
    @Json(name = "reason") val reason: String? = null,
    @Json(name = "description") val description: String? = null,
    @Json(name = "status") val status: String? = null,
    @Json(name = "createdAt") val createdAt: String? = null
)

// ─── Response Wrappers ──────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class ProductResponse(
    @Json(name = "product") val product: ShopProduct? = null
)

@JsonClass(generateAdapter = true)
data class PromotionResponse(
    @Json(name = "promotion") val promotion: ShopPromotion? = null
)

@JsonClass(generateAdapter = true)
data class WorkerResponse(
    @Json(name = "worker") val worker: ShopWorker? = null,
    @Json(name = "message") val message: String? = null
)
