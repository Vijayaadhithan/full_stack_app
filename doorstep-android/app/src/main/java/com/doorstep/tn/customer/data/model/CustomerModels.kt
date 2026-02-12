package com.doorstep.tn.customer.data.model

import com.doorstep.tn.core.network.FlexibleString
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.TextStyle
import java.util.Locale

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

/**
 * Paginated services response
 */
@JsonClass(generateAdapter = true)
data class ServicesResponse(
    @Json(name = "page") val page: Int = 1,
    @Json(name = "pageSize") val pageSize: Int = 20,
    @Json(name = "hasMore") val hasMore: Boolean = false,
    @Json(name = "items") val items: List<Service> = emptyList()
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
    @Json(name = "minOrderQuantity") val minOrderQuantity: Int? = null,
    @Json(name = "maxOrderQuantity") val maxOrderQuantity: Int? = null,
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
data class ShopProfile(
    @Json(name = "shopName") val shopName: String? = null,
    @Json(name = "description") val description: String? = null,
    @Json(name = "businessType") val businessType: String? = null,
    @Json(name = "workingHours") val workingHours: ShopWorkingHours? = null,
    @Json(name = "freeDeliveryRadiusKm") val freeDeliveryRadiusKm: Double? = null,
    @Json(name = "deliveryFee") val deliveryFee: Double? = null,
    @Json(name = "catalogModeEnabled") val catalogModeEnabled: Boolean? = null,
    @Json(name = "openOrderMode") val openOrderMode: Boolean? = null,
    @Json(name = "allowPayLater") val allowPayLater: Boolean? = null,
    @Json(name = "payLaterWhitelist") val payLaterWhitelist: List<Int>? = null
)

@JsonClass(generateAdapter = true)
data class ShopWorkingHours(
    @Json(name = "from") val from: String? = null,
    @Json(name = "to") val to: String? = null,
    @Json(name = "days") val days: List<String>? = null
)

private val SHOP_WORKING_HOURS_ZONE_ID: ZoneId = ZoneId.of("Asia/Kolkata")

private fun ShopWorkingHours.isOpenNow(now: ZonedDateTime = ZonedDateTime.now(SHOP_WORKING_HOURS_ZONE_ID)): Boolean {
    val fromMinutes = parseTimeToMinutes(from) ?: return true
    val toMinutes = parseTimeToMinutes(to) ?: return true

    val allowedDays = days
        .orEmpty()
        .mapNotNull { normalizeDayToken(it) }
        .toSet()

    fun isAllowed(dayToken: String): Boolean = allowedDays.isEmpty() || dayToken in allowedDays

    val nowMinutes = now.hour * 60 + now.minute
    val today = now.dayOfWeek.getDisplayName(TextStyle.FULL, Locale.ENGLISH).lowercase(Locale.ROOT)
    val yesterday = now.minusDays(1).dayOfWeek.getDisplayName(TextStyle.FULL, Locale.ENGLISH).lowercase(Locale.ROOT)

    if (fromMinutes == toMinutes) {
        // Interpret equal times as "open 24h" (subject to allowed days, if provided).
        return isAllowed(today)
    }

    val crossesMidnight = fromMinutes > toMinutes
    if (!crossesMidnight) {
        if (!isAllowed(today)) return false
        return nowMinutes >= fromMinutes && nowMinutes < toMinutes
    }

    val inWindow = nowMinutes >= fromMinutes || nowMinutes < toMinutes
    if (!inWindow) return false

    val segmentDay = if (nowMinutes >= fromMinutes) today else yesterday
    return isAllowed(segmentDay)
}

private fun normalizeDayToken(value: String): String? {
    val token = value.trim().lowercase(Locale.ROOT)
    if (token.isEmpty()) return null
    return when (token) {
        "mon", "monday" -> "monday"
        "tue", "tues", "tuesday" -> "tuesday"
        "wed", "weds", "wednesday" -> "wednesday"
        "thu", "thur", "thurs", "thursday" -> "thursday"
        "fri", "friday" -> "friday"
        "sat", "saturday" -> "saturday"
        "sun", "sunday" -> "sunday"
        else -> token
    }
}

private fun parseTimeToMinutes(value: String?): Int? {
    val raw = value?.trim()?.takeIf { it.isNotEmpty() } ?: return null

    if (raw.contains(":")) {
        val parts = raw.split(":")
        if (parts.size != 2) return null
        val hour = parts[0].trim().toIntOrNull() ?: return null
        val minute = parts[1].trim().toIntOrNull() ?: return null
        if (hour !in 0..23 || minute !in 0..59) return null
        return hour * 60 + minute
    }

    if (raw.any { !it.isDigit() }) return null

    // Allow "9" -> 09:00, "18" -> 18:00, "930" -> 09:30, "0930" -> 09:30.
    val (hour, minute) = when (raw.length) {
        1, 2 -> raw.toIntOrNull()?.let { it to 0 } ?: return null
        3 -> raw.substring(0, 1).toIntOrNull()?.let { h ->
            raw.substring(1, 3).toIntOrNull()?.let { m -> h to m }
        } ?: return null
        4 -> raw.substring(0, 2).toIntOrNull()?.let { h ->
            raw.substring(2, 4).toIntOrNull()?.let { m -> h to m }
        } ?: return null
        else -> return null
    }

    if (hour !in 0..23 || minute !in 0..59) return null
    return hour * 60 + minute
}

@JsonClass(generateAdapter = true)
data class PayLaterEligibility(
    @Json(name = "eligible") val eligible: Boolean? = null,
    @Json(name = "isKnownCustomer") val isKnownCustomer: Boolean? = null,
    @Json(name = "isWhitelisted") val isWhitelisted: Boolean? = null
)

@JsonClass(generateAdapter = true)
data class Shop(
    @Json(name = "id") val id: Int,
    @Json(name = "ownerId") val ownerId: Int? = null,
    @Json(name = "shopTableId") val shopTableId: Int? = null,
    @Json(name = "name") val name: String? = null,
    @Json(name = "phone") val phone: String? = null,
    @Json(name = "email") val email: String? = null,
    @Json(name = "shopProfile") val shopProfile: ShopProfile? = null,
    @Json(name = "profilePicture") val profilePicture: String? = null,
    @Json(name = "shopBannerImageUrl") val shopBannerImageUrl: String? = null,
    @Json(name = "shopLogoImageUrl") val shopLogoImageUrl: String? = null,
    @Json(name = "addressStreet") val addressStreet: String? = null,
    @Json(name = "addressCity") val addressCity: String? = null,
    @Json(name = "addressState") val addressState: String? = null,
    @Json(name = "addressPostalCode") val addressPostalCode: String? = null,
    @Json(name = "addressCountry") val addressCountry: String? = null,
    @Json(name = "latitude") val latitude: String? = null,
    @Json(name = "longitude") val longitude: String? = null,
	@Json(name = "deliveryAvailable") val deliveryAvailable: Boolean = false,
	@Json(name = "pickupAvailable") val pickupAvailable: Boolean = false,
	@Json(name = "returnsEnabled") val returnsEnabled: Boolean = false,
	@Json(name = "averageRating") @FlexibleString val averageRating: String? = null,
	@Json(name = "totalReviews") val totalReviews: Int = 0,
	@Json(name = "catalogModeEnabled") val catalogModeEnabled: Boolean? = null,
	@Json(name = "openOrderMode") val openOrderMode: Boolean? = null,
	@Json(name = "allowPayLater") val allowPayLater: Boolean? = null,
    @Json(name = "payLaterEligibilityForCustomer") val payLaterEligibilityForCustomer: PayLaterEligibility? = null
) {
    val displayName: String
        get() = shopProfile?.shopName?.takeIf { it.isNotBlank() } ?: (name ?: "Shop")

	val description: String?
	    get() = shopProfile?.description?.takeIf { it.isNotBlank() }

	val rating: Double?
	    get() = averageRating?.toDoubleOrNull()

    val reviewCount: Int
        get() = totalReviews

    val profileImage: String?
        get() = shopLogoImageUrl ?: profilePicture

    val coverImage: String?
        get() = shopBannerImageUrl

    val latitudeValue: Double?
        get() = latitude?.toDoubleOrNull()

    val longitudeValue: Double?
        get() = longitude?.toDoubleOrNull()

    val isOpen: Boolean
        get() = shopProfile?.workingHours?.isOpenNow() ?: true
}

// ==================== Orders ====================

@JsonClass(generateAdapter = true)
data class Order(
    @Json(name = "id") val id: Int,
    @Json(name = "customerId") val customerId: Int? = null,
    @Json(name = "shopId") val shopId: Int? = null,
    @Json(name = "status") val status: String,
    @Json(name = "total") val total: String,
    @Json(name = "subtotal") val subtotal: String? = null,
    @Json(name = "discount") val discount: String? = null,
    @Json(name = "orderDate") val orderDate: String? = null,
    @Json(name = "shippingAddress") val shippingAddress: String? = null,
    @Json(name = "paymentMethod") val paymentMethod: String? = null,
    @Json(name = "paymentStatus") val paymentStatus: String? = null,  // "pending", "verifying", "paid"
    @Json(name = "deliveryMethod") val deliveryMethod: String? = null,  // "pickup" or "delivery"
    @Json(name = "deliveryFee") val deliveryFee: String? = null,
    @Json(name = "deliveryDistanceKm") val deliveryDistanceKm: Double? = null,
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
    @Json(name = "name") val name: String? = null,
    @Json(name = "quantity") val quantity: Int,
    @Json(name = "price") val price: String,
    @Json(name = "mrp") val mrp: String? = null,
    @Json(name = "discount") val discount: String? = null,
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
