package com.doorstep.tn.customer.data.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// ==================== Paginated Response Wrappers ====================

/**
 * Generic paginated response matching server structure
 */
@JsonClass(generateAdapter = true)
data class PaginatedResponse<T>(
    @Json(name = "page") val page: Int = 1,
    @Json(name = "pageSize") val pageSize: Int = 20,
    @Json(name = "hasMore") val hasMore: Boolean = false,
    @Json(name = "items") val items: List<T> = emptyList()
)

/**
 * Paginated products response
 */
@JsonClass(generateAdapter = true)
data class ProductsResponse(
    @Json(name = "page") val page: Int = 1,
    @Json(name = "pageSize") val pageSize: Int = 20,
    @Json(name = "hasMore") val hasMore: Boolean = false,
    @Json(name = "items") val items: List<Product> = emptyList()
)

// ==================== Products ====================

@JsonClass(generateAdapter = true)
data class Product(
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String,
    @Json(name = "description") val description: String? = null,
    @Json(name = "price") val price: String,
    @Json(name = "mrp") val mrp: String? = null,
    @Json(name = "stock") val stock: Int? = null,
    @Json(name = "category") val category: String? = null,
    @Json(name = "images") val images: List<String>? = null,
    @Json(name = "isAvailable") val isAvailable: Boolean = true,
    @Json(name = "shopId") val shopId: Int? = null,
    @Json(name = "catalogModeEnabled") val catalogModeEnabled: Boolean? = false,
    @Json(name = "openOrderMode") val openOrderMode: Boolean? = false,
    @Json(name = "allowPayLater") val allowPayLater: Boolean? = false
)

// ==================== Services ====================

@JsonClass(generateAdapter = true)
data class Service(
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String,
    @Json(name = "description") val description: String? = null,
    @Json(name = "price") val price: String,
    @Json(name = "duration") val duration: Int? = null,
    @Json(name = "category") val category: String? = null,
    @Json(name = "images") val images: List<String>? = null,
    @Json(name = "isAvailable") val isAvailable: Boolean = true,
    @Json(name = "providerId") val providerId: Int? = null,
    @Json(name = "isAvailableNow") val isAvailableNow: Boolean = true,
    @Json(name = "availabilityNote") val availabilityNote: String? = null,
    @Json(name = "maxDailyBookings") val maxDailyBookings: Int? = null,
    @Json(name = "allowedSlots") val allowedSlots: List<String>? = null,
    @Json(name = "rating") val rating: Double? = null,
    @Json(name = "reviewCount") val reviewCount: Int = 0,
    @Json(name = "provider") val provider: ProviderInfo? = null
)

// ==================== Shops ====================

@JsonClass(generateAdapter = true)
data class Shop(
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String,
    @Json(name = "phone") val phone: String? = null,
    @Json(name = "email") val email: String? = null,
    @Json(name = "addressStreet") val addressStreet: String? = null,
    @Json(name = "addressCity") val addressCity: String? = null,
    @Json(name = "addressState") val addressState: String? = null,
    @Json(name = "latitude") val latitude: Double? = null,
    @Json(name = "longitude") val longitude: Double? = null,
    @Json(name = "profileImage") val profileImage: String? = null,
    @Json(name = "coverImage") val coverImage: String? = null,
    @Json(name = "description") val description: String? = null,
    @Json(name = "openingHours") val openingHours: String? = null,
    @Json(name = "isOpen") val isOpen: Boolean = true,
    @Json(name = "rating") val rating: Double? = null,
    @Json(name = "reviewCount") val reviewCount: Int = 0,
    // Delivery options - matches web's shopInfo
    @Json(name = "pickupAvailable") val pickupAvailable: Boolean = true,
    @Json(name = "deliveryAvailable") val deliveryAvailable: Boolean = false,
    @Json(name = "catalogModeEnabled") val catalogModeEnabled: Boolean? = null,
    @Json(name = "openOrderMode") val openOrderMode: Boolean? = null,
    @Json(name = "returnsEnabled") val returnsEnabled: Boolean? = null,
    @Json(name = "allowPayLater") val allowPayLater: Boolean = false,
    @Json(name = "payLaterWhitelist") val payLaterWhitelist: List<Int>? = null
)

// ==================== Orders ====================

@JsonClass(generateAdapter = true)
data class Order(
    @Json(name = "id") val id: Int,
    @Json(name = "customerId") val customerId: Int? = null,
    @Json(name = "shopId") val shopId: Int? = null,
    @Json(name = "status") val status: String,
    @Json(name = "total") val total: String,
    @Json(name = "subtotal") val subtotal: String? = null,
    @Json(name = "orderDate") val orderDate: String? = null,
    @Json(name = "shippingAddress") val shippingAddress: String? = null,
    @Json(name = "paymentMethod") val paymentMethod: String? = null,
    @Json(name = "paymentStatus") val paymentStatus: String? = null,  // "pending", "verifying", "paid"
    @Json(name = "deliveryMethod") val deliveryMethod: String? = null,  // "pickup" or "delivery"
    @Json(name = "orderType") val orderType: String? = null,  // "product_order" or "text_order"
    @Json(name = "orderText") val orderText: String? = null,  // For text/quick orders
    @Json(name = "returnRequested") val returnRequested: Boolean? = null,
    @Json(name = "items") val items: List<OrderItem>? = null,
    @Json(name = "shop") val shop: OrderShop? = null
)

// Shop info nested in order response
@JsonClass(generateAdapter = true)
data class OrderShop(
    @Json(name = "name") val name: String? = null,
    @Json(name = "phone") val phone: String? = null,
    @Json(name = "email") val email: String? = null,
    @Json(name = "latitude") val latitude: Double? = null,
    @Json(name = "longitude") val longitude: Double? = null,
    @Json(name = "address") val address: String? = null,
    @Json(name = "upiId") val upiId: String? = null,  // For UPI payments
    @Json(name = "returnsEnabled") val returnsEnabled: Boolean? = null
)

@JsonClass(generateAdapter = true)
data class OrderItem(
    @Json(name = "id") val id: Int,
    @Json(name = "productId") val productId: Int? = null,
    @Json(name = "quantity") val quantity: Int,
    @Json(name = "price") val price: String,
    @Json(name = "total") val total: String,
    @Json(name = "product") val product: Product? = null
)

// ==================== Bookings ====================

@JsonClass(generateAdapter = true)
data class Booking(
    @Json(name = "id") val id: Int,
    @Json(name = "customerId") val customerId: Int? = null,
    @Json(name = "serviceId") val serviceId: Int? = null,
    @Json(name = "status") val status: String,
    @Json(name = "bookingDate") val bookingDate: String? = null,
    @Json(name = "timeSlotLabel") val timeSlotLabel: String? = null,
    @Json(name = "service") val service: Service? = null,
    @Json(name = "provider") val provider: ProviderInfo? = null,
    @Json(name = "serviceLocation") val serviceLocation: String? = null,
    @Json(name = "rejectionReason") val rejectionReason: String? = null,
    @Json(name = "paymentStatus") val paymentStatus: String? = null,
    @Json(name = "paymentReference") val paymentReference: String? = null,
    @Json(name = "disputeReason") val disputeReason: String? = null,
    @Json(name = "comments") val comments: String? = null,
    @Json(name = "rescheduleDate") val rescheduleDate: String? = null,
    @Json(name = "providerAddress") val providerAddress: String? = null,
    @Json(name = "expiresAt") val expiresAt: String? = null
)

@JsonClass(generateAdapter = true)
data class ProviderInfo(
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String,
    @Json(name = "phone") val phone: String? = null,
    @Json(name = "addressStreet") val addressStreet: String? = null,
    @Json(name = "addressCity") val addressCity: String? = null,
    @Json(name = "addressState") val addressState: String? = null,
    @Json(name = "addressPostalCode") val addressPostalCode: String? = null,
    @Json(name = "addressCountry") val addressCountry: String? = null,
    @Json(name = "latitude") val latitude: Double? = null,
    @Json(name = "longitude") val longitude: Double? = null,
    @Json(name = "upiId") val upiId: String? = null,
    @Json(name = "upiQrCodeUrl") val upiQrCodeUrl: String? = null
)

// ==================== Cart ====================
// Server returns: { product: Product, quantity: number }[]
// No separate productId field - it comes from product.id

@JsonClass(generateAdapter = true)
data class CartItem(
    @Json(name = "quantity") val quantity: Int,
    @Json(name = "product") val product: Product
) {
    // Derive productId from product.id (server doesn't return separate productId)
    val productId: Int get() = product.id
}
