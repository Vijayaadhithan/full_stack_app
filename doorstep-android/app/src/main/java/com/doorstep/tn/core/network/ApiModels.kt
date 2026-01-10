package com.doorstep.tn.core.network

/**
 * Request models for API calls - matches web app's request bodies exactly
 */

// Cart - POST /api/cart
data class AddToCartRequest(
    val productId: Int,
    val quantity: Int = 1
)

// Wishlist - POST /api/wishlist
data class AddToWishlistRequest(
    val productId: Int
)

// Profile - PATCH /api/users/{id}
data class UpdateProfileRequest(
    val name: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val upiId: String? = null,
    val addressLandmark: String? = null,
    val addressStreet: String? = null,
    val addressCity: String? = null,
    val addressState: String? = null,
    val addressPostalCode: String? = null,
    val addressCountry: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null
)

// Order - POST /api/orders
data class CreateOrderRequest(
    val items: List<OrderItemRequest>,
    val total: String,
    val subtotal: String,
    val discount: String = "0",
    val promotionId: Int? = null,
    val deliveryMethod: String = "pickup",  // "pickup" or "delivery"
    val paymentMethod: String = "cash"       // "cash", "upi", "pay_later"
)

data class OrderItemRequest(
    val productId: Int,
    val quantity: Int,
    val price: String
)

// Response wrapper for POST /api/orders - server returns { order: Order }
data class CreateOrderResponse(
    val order: com.doorstep.tn.customer.data.model.Order? = null
)

// Booking - POST /api/bookings (matches web app exactly)
data class CreateBookingRequest(
    val serviceId: Int,
    val bookingDate: String,           // "YYYY-MM-DD" ISO date
    val serviceLocation: String,        // "customer" or "provider"
    val timeSlotLabel: String? = null   // "morning", "afternoon", "evening", or null for emergency
)

// Booking response from POST /api/bookings
data class BookingResponse(
    val message: String? = null,
    val booking: com.doorstep.tn.customer.data.model.Booking? = null
)

// Update booking - PATCH /api/bookings/{id} (for cancel, reschedule)
data class UpdateBookingRequest(
    val status: String? = null,            // "cancelled" to cancel
    val bookingDate: String? = null,       // ISO date for reschedule
    val comments: String? = null           // Optional comments for reschedule
)

// Submit review - POST /api/reviews (matches web app exactly)
data class SubmitReviewRequest(
    val serviceId: Int,
    val rating: Int,
    val review: String,
    val bookingId: Int
)

// Review response from POST /api/reviews
data class ReviewResponse(
    val id: Int? = null,
    val message: String? = null
)

// Customer service review - GET /api/reviews/customer
data class CustomerReview(
    val id: Int,
    val serviceId: Int,
    val customerId: Int,
    val rating: Int,
    val review: String? = null,
    val serviceName: String? = null,
    val createdAt: String? = null
)

// Customer product review - GET /api/product-reviews/customer
data class CustomerProductReview(
    val id: Int,
    val productId: Int,
    val customerId: Int,
    val rating: Int,
    val review: String? = null,
    val productName: String? = null,
    val createdAt: String? = null
)

// Notification - GET /api/notifications
data class AppNotification(
    val id: Int,
    val userId: Int,
    val type: String,  // "booking", "order", "promotion", "system", etc.
    val title: String,
    val message: String,
    val isRead: Boolean = false,
    val relatedBookingId: Int? = null,
    val createdAt: String? = null
)

// Notifications response wrapper - server returns { data: [...], total, totalPages }
data class NotificationsResponse(
    val data: List<AppNotification> = emptyList(),
    val total: Int = 0,
    val totalPages: Int = 1
)

// Notification count response
data class UnreadNotificationCount(
    val count: Int
)

// ==================== SEARCH ====================

// Universal/Global Search Result - matches web GET /api/search
data class SearchResult(
    val type: String,  // "service", "product", "shop"
    val id: Int,
    val name: String,
    val description: String? = null,
    val price: String? = null,
    val category: String? = null,
    val shopName: String? = null,
    val providerName: String? = null,
    val distance: Double? = null,
    val imageUrl: String? = null
)

// Search response wrapper
data class SearchResponse(
    val query: String,
    val results: List<SearchResult>
)

// ==================== QUICK ORDER ====================

// Text/Quick Order Request - matches web POST /api/orders/text
data class CreateTextOrderRequest(
    val shopId: Int,
    val orderText: String,
    val deliveryMethod: String = "pickup"  // "pickup" or "delivery"
)

// Text Order Response
data class TextOrderResponse(
    val order: TextOrderInfo
)

data class TextOrderInfo(
    val id: Int
)

// ==================== QUICK ADD PRODUCT ====================

// Quick Add Product Request - matches web POST /api/products/quick-add
data class QuickAddProductRequest(
    val name: String,
    val price: String,
    val category: String
)

// ==================== ORDER TIMELINE ====================

// Order Timeline Entry - matches web GET /api/orders/:id/timeline
data class OrderTimelineEntry(
    val orderId: Int,
    val status: String,
    val trackingInfo: String? = null,
    val timestamp: String
)

// ==================== PRODUCT REVIEW ====================

// Product Review Request - matches web POST /api/product-reviews  
data class ProductReviewRequest(
    val productId: Int,
    val orderId: Int,
    val rating: Int,
    val review: String
)

data class UpdateReviewRequest(
    val rating: Int? = null,
    val review: String? = null
)

data class CreateReturnRequest(
    val reason: String,
    val comments: String? = null
)
