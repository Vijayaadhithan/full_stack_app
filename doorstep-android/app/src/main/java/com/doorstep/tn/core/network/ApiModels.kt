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

// Booking - POST /api/bookings (matches web app exactly)
data class CreateBookingRequest(
    val serviceId: Int,
    val bookingDate: String,           // "YYYY-MM-DD" ISO date
    val serviceLocation: String,        // "customer" or "provider"
    val timeSlotLabel: String           // "morning", "afternoon", "evening", "emergency"
)

// Booking response from POST /api/bookings
data class BookingResponse(
    val message: String? = null,
    val booking: com.doorstep.tn.customer.data.model.Booking? = null
)

