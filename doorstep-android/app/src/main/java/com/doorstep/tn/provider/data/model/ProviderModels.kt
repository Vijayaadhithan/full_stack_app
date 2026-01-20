package com.doorstep.tn.provider.data.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Provider-specific data models matching web app's TypeScript interfaces
 */

// ─── Provider Service ────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class ProviderService(
    val id: Int,
    val name: String,
    val description: String? = null,
    val category: String? = null,
    val price: String? = null, // Can be string like "500" or number
    val duration: Int? = null, // in minutes
    @Json(name = "providerId") val providerId: Int? = null,
    @Json(name = "isAvailable") val isAvailable: Boolean = true,
    @Json(name = "isAvailableNow") val isAvailableNow: Boolean = true,
    @Json(name = "availabilityNote") val availabilityNote: String? = null,
    @Json(name = "serviceLocationType") val serviceLocationType: String? = null, // "customer_location" or "provider_location"
    @Json(name = "imageUrl") val imageUrl: String? = null,
    @Json(name = "createdAt") val createdAt: String? = null,
    @Json(name = "updatedAt") val updatedAt: String? = null
) {
    val priceAsDouble: Double?
        get() = price?.toDoubleOrNull()
}

// ─── Provider Booking ────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class ProviderBookingCustomer(
    val id: Int,
    val name: String? = null,
    val phone: String? = null,
    @Json(name = "addressStreet") val addressStreet: String? = null,
    @Json(name = "addressLandmark") val addressLandmark: String? = null,
    @Json(name = "addressCity") val addressCity: String? = null,
    @Json(name = "addressState") val addressState: String? = null,
    @Json(name = "addressPostalCode") val addressPostalCode: String? = null,
    @Json(name = "addressCountry") val addressCountry: String? = null
)

@JsonClass(generateAdapter = true)
data class ProviderBookingService(
    val name: String,
    val price: String? = null,
    val category: String? = null
)

@JsonClass(generateAdapter = true)
data class ProviderBookingAddress(
    @Json(name = "addressStreet") val addressStreet: String? = null,
    @Json(name = "addressLandmark") val addressLandmark: String? = null,
    @Json(name = "addressCity") val addressCity: String? = null,
    @Json(name = "addressState") val addressState: String? = null,
    @Json(name = "addressPostalCode") val addressPostalCode: String? = null,
    @Json(name = "addressCountry") val addressCountry: String? = null
)

@JsonClass(generateAdapter = true)
data class BookingProximityInfo(
    @Json(name = "nearestBookingId") val nearestBookingId: Int? = null,
    @Json(name = "nearestBookingDate") val nearestBookingDate: String? = null,
    @Json(name = "distanceKm") val distanceKm: Double? = null,
    val message: String? = null
)

@JsonClass(generateAdapter = true)
data class ProviderBooking(
    val id: Int,
    @Json(name = "serviceId") val serviceId: Int? = null,
    @Json(name = "customerId") val customerId: Int? = null,
    val status: String,
    @Json(name = "scheduledDate") val scheduledDate: String? = null,
    @Json(name = "scheduledTime") val scheduledTime: String? = null, // Could be "morning", "afternoon", "evening", or specific time
    @Json(name = "serviceLocation") val serviceLocation: String? = null, // "customer" or "provider"
    val notes: String? = null,
    @Json(name = "providerComments") val providerComments: String? = null,
    @Json(name = "paymentMethod") val paymentMethod: String? = null,
    @Json(name = "paymentStatus") val paymentStatus: String? = null,
    @Json(name = "paymentReference") val paymentReference: String? = null,
    @Json(name = "cancellationReason") val cancellationReason: String? = null,
    @Json(name = "completedAt") val completedAt: String? = null,
    @Json(name = "createdAt") val createdAt: String? = null,
    @Json(name = "updatedAt") val updatedAt: String? = null,
    // Nested objects
    val service: ProviderBookingService? = null,
    val customer: ProviderBookingCustomer? = null,
    @Json(name = "relevantAddress") val relevantAddress: ProviderBookingAddress? = null,
    @Json(name = "proximityInfo") val proximityInfo: BookingProximityInfo? = null
) {
    val displayPrice: String
        get() = service?.price?.let { "₹$it" } ?: "Price not set"
    
    val customerName: String
        get() = customer?.name ?: "Unknown Customer"
    
    val serviceName: String
        get() = service?.name ?: "Unknown Service"
    
    val formattedAddress: String
        get() {
            val addr = relevantAddress ?: return "Address not provided"
            return listOfNotNull(
                addr.addressStreet,
                addr.addressLandmark,
                addr.addressCity,
                addr.addressState,
                addr.addressPostalCode
            ).filter { it.isNotBlank() }.joinToString(", ").ifBlank { "Address not provided" }
        }
    
    val isPending: Boolean
        get() = status == "pending" || status == "rescheduled_pending_provider_approval"
    
    val isConfirmed: Boolean
        get() = status == "confirmed" || status == "accepted" || status == "rescheduled_by_provider"
    
    val isCompleted: Boolean
        get() = status == "completed" || status == "payment_confirmed"
    
    val isCancelled: Boolean
        get() = status == "cancelled" || status == "rejected"
}

// ─── Provider Stats ──────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class ProviderStats(
    @Json(name = "pendingBookings") val pendingBookings: Int = 0,
    @Json(name = "todayBookings") val todayBookings: Int = 0,
    @Json(name = "completedBookings") val completedBookings: Int = 0,
    @Json(name = "totalEarnings") val totalEarnings: Double = 0.0,
    @Json(name = "weekEarnings") val weekEarnings: Double = 0.0,
    @Json(name = "monthEarnings") val monthEarnings: Double = 0.0,
    @Json(name = "averageRating") val averageRating: Double = 0.0,
    @Json(name = "totalReviews") val totalReviews: Int = 0
)

// ─── Request Models ──────────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class CreateServiceRequest(
    val name: String,
    val description: String? = null,
    val category: String,
    val price: String,
    val duration: Int,
    @Json(name = "serviceLocationType") val serviceLocationType: String = "customer_location",
    @Json(name = "isAvailable") val isAvailable: Boolean = true,
    @Json(name = "isAvailableNow") val isAvailableNow: Boolean = true,
    @Json(name = "availabilityNote") val availabilityNote: String? = null
)

@JsonClass(generateAdapter = true)
data class UpdateServiceRequest(
    val name: String? = null,
    val description: String? = null,
    val category: String? = null,
    val price: String? = null,
    val duration: Int? = null,
    @Json(name = "serviceLocationType") val serviceLocationType: String? = null,
    @Json(name = "isAvailable") val isAvailable: Boolean? = null,
    @Json(name = "isAvailableNow") val isAvailableNow: Boolean? = null,
    @Json(name = "availabilityNote") val availabilityNote: String? = null
)

@JsonClass(generateAdapter = true)
data class ProviderAvailabilityRequest(
    @Json(name = "isAvailableNow") val isAvailableNow: Boolean,
    @Json(name = "availabilityNote") val availabilityNote: String? = null
)

@JsonClass(generateAdapter = true)
data class UpdateBookingStatusRequest(
    val status: String,
    val comments: String? = null
)

// ─── Response Wrappers ───────────────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class PendingBookingsResponse(
    val bookings: List<ProviderBooking>
)

@JsonClass(generateAdapter = true)
data class ProviderServicesResponse(
    val services: List<ProviderService>
)
