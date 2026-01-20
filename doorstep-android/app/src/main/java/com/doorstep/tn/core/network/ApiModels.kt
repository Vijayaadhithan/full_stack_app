package com.doorstep.tn.core.network

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Request models for API calls - matches web app's request bodies exactly
 */

// Cart - POST /api/cart
@JsonClass(generateAdapter = true)
data class AddToCartRequest(
    @Json(name = "productId") val productId: Int,
    @Json(name = "quantity") val quantity: Int = 1
)

// Wishlist - POST /api/wishlist
@JsonClass(generateAdapter = true)
data class AddToWishlistRequest(
    @Json(name = "productId") val productId: Int
)

// Profile - PATCH /api/users/{id}
@JsonClass(generateAdapter = true)
data class UpdateProfileRequest(
    @Json(name = "name") val name: String? = null,
    @Json(name = "phone") val phone: String? = null,
    @Json(name = "email") val email: String? = null,
    @Json(name = "upiId") val upiId: String? = null,
    @Json(name = "addressLandmark") val addressLandmark: String? = null,
    @Json(name = "addressStreet") val addressStreet: String? = null,
    @Json(name = "addressCity") val addressCity: String? = null,
    @Json(name = "addressState") val addressState: String? = null,
    @Json(name = "addressPostalCode") val addressPostalCode: String? = null,
    @Json(name = "addressCountry") val addressCountry: String? = null,
    @Json(name = "latitude") val latitude: String? = null,
    @Json(name = "longitude") val longitude: String? = null
)

// Order - POST /api/orders
@JsonClass(generateAdapter = true)
data class CreateOrderRequest(
    @Json(name = "items") val items: List<OrderItemRequest>,
    @Json(name = "total") val total: String,
    @Json(name = "subtotal") val subtotal: String,
    @Json(name = "discount") val discount: String = "0",
    @Json(name = "promotionId") val promotionId: Int? = null,
    @Json(name = "deliveryMethod") val deliveryMethod: String = "pickup",
    @Json(name = "paymentMethod") val paymentMethod: String = "cash"
)

@JsonClass(generateAdapter = true)
data class OrderItemRequest(
    @Json(name = "productId") val productId: Int,
    @Json(name = "quantity") val quantity: Int,
    @Json(name = "price") val price: String
)

// Response wrapper for POST /api/orders - server returns { order: Order }
@JsonClass(generateAdapter = true)
data class CreateOrderResponse(
    @Json(name = "order") val order: com.doorstep.tn.customer.data.model.Order? = null
)

// Booking - POST /api/bookings (matches web app exactly)
@JsonClass(generateAdapter = true)
data class CreateBookingRequest(
    @Json(name = "serviceId") val serviceId: Int,
    @Json(name = "bookingDate") val bookingDate: String,
    @Json(name = "serviceLocation") val serviceLocation: String,
    @Json(name = "timeSlotLabel") val timeSlotLabel: String? = null
)

// Booking slots response - GET /api/bookings/service/:id
@JsonClass(generateAdapter = true)
data class ServiceBookingSlot(
    @Json(name = "timeSlotLabel") val timeSlotLabel: String? = null,
    @Json(name = "start") val start: String? = null,
    @Json(name = "end") val end: String? = null
)

// Booking response from POST /api/bookings
data class BookingResponse(
    val message: String? = null,
    val booking: com.doorstep.tn.customer.data.model.Booking? = null
)

// Booking action response (payment, update reference, dispute)
@JsonClass(generateAdapter = true)
data class BookingActionResponse(
    @Json(name = "message") val message: String? = null,
    @Json(name = "booking") val booking: com.doorstep.tn.customer.data.model.Booking? = null
)

// Payment reference - PATCH /api/bookings/:id/customer-complete, /update-reference
@JsonClass(generateAdapter = true)
data class PaymentReferenceRequest(
    @Json(name = "paymentReference") val paymentReference: String
)

// Booking dispute - POST /api/bookings/:id/report-dispute
@JsonClass(generateAdapter = true)
data class BookingDisputeRequest(
    @Json(name = "reason") val reason: String
)

// Update booking - PATCH /api/bookings/{id} (for cancel, reschedule)
// Update booking - PATCH /api/bookings/{id} (for cancel, reschedule)
@JsonClass(generateAdapter = true)
data class UpdateBookingRequest(
    @Json(name = "status") val status: String? = null,
    @Json(name = "bookingDate") val bookingDate: String? = null,
    @Json(name = "comments") val comments: String? = null
)

// Submit review - POST /api/reviews (matches web app exactly)
@JsonClass(generateAdapter = true)
data class SubmitReviewRequest(
    @Json(name = "serviceId") val serviceId: Int,
    @Json(name = "rating") val rating: Int,
    @Json(name = "review") val review: String,
    @Json(name = "bookingId") val bookingId: Int
)

// Review response from POST /api/reviews
@JsonClass(generateAdapter = true)
data class ReviewResponse(
    @Json(name = "id") val id: Int? = null,
    @Json(name = "message") val message: String? = null
)

// Service review - GET /api/reviews/service/:id
@JsonClass(generateAdapter = true)
data class ServiceReview(
    @Json(name = "id") val id: Int,
    @Json(name = "serviceId") val serviceId: Int? = null,
    @Json(name = "bookingId") val bookingId: Int? = null,
    @Json(name = "customerId") val customerId: Int? = null,
    @Json(name = "rating") val rating: Int,
    @Json(name = "review") val review: String? = null,
    @Json(name = "providerReply") val providerReply: String? = null,
    @Json(name = "createdAt") val createdAt: String? = null
)

// Customer service review - GET /api/reviews/customer
@JsonClass(generateAdapter = true)
data class CustomerReview(
    @Json(name = "id") val id: Int,
    @Json(name = "serviceId") val serviceId: Int,
    @Json(name = "customerId") val customerId: Int,
    @Json(name = "rating") val rating: Int,
    @Json(name = "review") val review: String? = null,
    @Json(name = "serviceName") val serviceName: String? = null,
    @Json(name = "createdAt") val createdAt: String? = null
)

// Customer product review - GET /api/product-reviews/customer
@JsonClass(generateAdapter = true)
data class CustomerProductReview(
    @Json(name = "id") val id: Int,
    @Json(name = "productId") val productId: Int,
    @Json(name = "customerId") val customerId: Int,
    @Json(name = "rating") val rating: Int,
    @Json(name = "review") val review: String? = null,
    @Json(name = "productName") val productName: String? = null,
    @Json(name = "createdAt") val createdAt: String? = null
)

// Product review - GET /api/reviews/product/:id
@JsonClass(generateAdapter = true)
data class ProductReview(
    @Json(name = "id") val id: Int,
    @Json(name = "productId") val productId: Int? = null,
    @Json(name = "orderId") val orderId: Int? = null,
    @Json(name = "customerId") val customerId: Int? = null,
    @Json(name = "rating") val rating: Int,
    @Json(name = "review") val review: String? = null,
    @Json(name = "shopReply") val shopReply: String? = null,
    @Json(name = "createdAt") val createdAt: String? = null
)

// Notification - GET /api/notifications
@JsonClass(generateAdapter = true)
data class AppNotification(
    @Json(name = "id") val id: Int,
    @Json(name = "userId") val userId: Int,
    @Json(name = "type") val type: String,  // "booking", "order", "promotion", "system", etc.
    @Json(name = "title") val title: String,
    @Json(name = "message") val message: String,
    @Json(name = "isRead") val isRead: Boolean = false,
    @Json(name = "relatedBookingId") val relatedBookingId: Int? = null,
    @Json(name = "createdAt") val createdAt: String? = null
)

// Notifications response wrapper - server returns { data: [...], total, totalPages }
@JsonClass(generateAdapter = true)
data class NotificationsResponse(
    @Json(name = "data") val data: List<AppNotification> = emptyList(),
    @Json(name = "total") val total: Int = 0,
    @Json(name = "totalPages") val totalPages: Int = 1
)

// Notification count response
@JsonClass(generateAdapter = true)
data class UnreadNotificationCount(
    @Json(name = "count") val count: Int
)

// ==================== SEARCH ====================

// Universal/Global Search Result - matches web GET /api/search
@JsonClass(generateAdapter = true)
data class SearchResult(
    @Json(name = "type") val type: String,  // "service", "product", "shop"
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String,
    @Json(name = "description") val description: String? = null,
    @Json(name = "price") val price: String? = null,
    @Json(name = "category") val category: String? = null,
    @Json(name = "shopName") val shopName: String? = null,
    @Json(name = "providerName") val providerName: String? = null,
    @Json(name = "distance") val distance: Double? = null,
    @Json(name = "imageUrl") val imageUrl: String? = null
)

// Search response wrapper
@JsonClass(generateAdapter = true)
data class SearchResponse(
    @Json(name = "query") val query: String,
    @Json(name = "results") val results: List<SearchResult>
)

// ==================== QUICK ORDER ====================

// Text/Quick Order Request - matches web POST /api/orders/text
@JsonClass(generateAdapter = true)
data class CreateTextOrderRequest(
    @Json(name = "shopId") val shopId: Int,
    @Json(name = "orderText") val orderText: String,
    @Json(name = "deliveryMethod") val deliveryMethod: String = "pickup"
)

// Text Order Response
@JsonClass(generateAdapter = true)
data class TextOrderResponse(
    @Json(name = "order") val order: TextOrderInfo
)

@JsonClass(generateAdapter = true)
data class TextOrderInfo(
    @Json(name = "id") val id: Int
)

// ==================== QUICK ADD PRODUCT ====================

// Quick Add Product Request - matches web POST /api/products/quick-add
@JsonClass(generateAdapter = true)
data class QuickAddProductRequest(
    @Json(name = "name") val name: String,
    @Json(name = "price") val price: String,
    @Json(name = "category") val category: String
)

// ==================== ORDER TIMELINE ====================

// Order Timeline Entry - matches web GET /api/orders/:id/timeline
@JsonClass(generateAdapter = true)
data class OrderTimelineEntry(
    @Json(name = "orderId") val orderId: Int,
    @Json(name = "status") val status: String,
    @Json(name = "trackingInfo") val trackingInfo: String? = null,
    @Json(name = "timestamp") val timestamp: String
)

// ==================== PRODUCT REVIEW ====================

// Product Review Request - matches web POST /api/product-reviews  
@JsonClass(generateAdapter = true)
data class ProductReviewRequest(
    @Json(name = "productId") val productId: Int,
    @Json(name = "orderId") val orderId: Int,
    @Json(name = "rating") val rating: Int,
    @Json(name = "review") val review: String
)

@JsonClass(generateAdapter = true)
data class UpdateReviewRequest(
    @Json(name = "rating") val rating: Int? = null,
    @Json(name = "review") val review: String? = null
)

@JsonClass(generateAdapter = true)
data class CreateReturnRequest(
    @Json(name = "reason") val reason: String,
    @Json(name = "comments") val comments: String? = null
)

// ==================== FCM PUSH NOTIFICATIONS ====================

// FCM Token Registration - POST /api/fcm/register
@JsonClass(generateAdapter = true)
data class FcmTokenRequest(
    @Json(name = "token") val token: String,
    @Json(name = "platform") val platform: String,  // "android" or "web"
    @Json(name = "deviceInfo") val deviceInfo: String? = null
)

// FCM Token Unregister - DELETE /api/fcm/unregister
@JsonClass(generateAdapter = true)
data class FcmTokenUnregisterRequest(
    @Json(name = "token") val token: String
)

// ==================== PROMOTIONS ====================

@JsonClass(generateAdapter = true)
data class Promotion(
    @Json(name = "id") val id: Int,
    @Json(name = "shopId") val shopId: Int,
    @Json(name = "code") val code: String,
    @Json(name = "name") val name: String,
    @Json(name = "description") val description: String? = null,
    @Json(name = "type") val type: String, // "percentage" or "fixed_amount"
    @Json(name = "value") val value: Double,
    @Json(name = "minPurchase") val minOrderAmount: Double? = null, // Server returns minPurchase, we alias to minOrderAmount
    @Json(name = "maxDiscount") val maxDiscount: Double? = null,
    @Json(name = "usageLimit") val usageLimit: Int? = null,
    @Json(name = "usedCount") val usedCount: Int? = null,
    @Json(name = "startDate") val startDate: String? = null,
    @Json(name = "endDate") val endDate: String? = null, // Server may return null
    @Json(name = "isActive") val isActive: Boolean = true
)

// ==================== BUY-AGAIN RECOMMENDATIONS ====================

// Buy Again Service - matches web GET /api/recommendations/buy-again
@JsonClass(generateAdapter = true)
data class BuyAgainService(
    @Json(name = "serviceId") val serviceId: Int,
    @Json(name = "providerId") val providerId: Int? = null,
    @Json(name = "name") val name: String? = null,
    @Json(name = "price") val price: String? = null,
    @Json(name = "image") val image: String? = null,
    @Json(name = "timesBooked") val timesBooked: Int = 0,
    @Json(name = "lastBookedAt") val lastBookedAt: String? = null,
    @Json(name = "providerName") val providerName: String? = null
)

// Buy Again Product - matches web GET /api/recommendations/buy-again
@JsonClass(generateAdapter = true)
data class BuyAgainProduct(
    @Json(name = "productId") val productId: Int,
    @Json(name = "shopId") val shopId: Int? = null,
    @Json(name = "name") val name: String? = null,
    @Json(name = "price") val price: String? = null,
    @Json(name = "image") val image: String? = null,
    @Json(name = "timesOrdered") val timesOrdered: Int = 0,
    @Json(name = "lastOrderedAt") val lastOrderedAt: String? = null,
    @Json(name = "shopName") val shopName: String? = null
)

// Buy Again Response - matches web GET /api/recommendations/buy-again
@JsonClass(generateAdapter = true)
data class BuyAgainResponse(
    @Json(name = "services") val services: List<BuyAgainService> = emptyList(),
    @Json(name = "products") val products: List<BuyAgainProduct> = emptyList()
)

// ==================== PROVIDER PAGINATION ====================

// Paginated Provider Bookings Response - matches web /api/bookings/provider
@JsonClass(generateAdapter = true)
data class PaginatedBookingsResponse(
    @Json(name = "data") val data: List<com.doorstep.tn.provider.data.model.ProviderBooking> = emptyList(),
    @Json(name = "total") val total: Int = 0,
    @Json(name = "totalPages") val totalPages: Int = 1,
    @Json(name = "page") val page: Int = 1
)

