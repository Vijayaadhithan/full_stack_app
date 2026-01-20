package com.doorstep.tn.provider.data.repository

import com.doorstep.tn.auth.data.model.UserResponse
import com.doorstep.tn.core.network.DoorStepApi
import com.doorstep.tn.provider.data.model.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for provider-specific API operations
 */
@Singleton
class ProviderRepository @Inject constructor(
    private val api: DoorStepApi
) {
    
    // ─── Bookings ────────────────────────────────────────────────────────────
    
    /**
     * Get pending booking requests for the provider
     */
    suspend fun getPendingBookings(): Result<List<ProviderBooking>> {
        return try {
            val response = api.getProviderPendingBookings()
            if (response.isSuccessful) {
                Result.Success(response.body() ?: emptyList())
            } else {
                Result.Error("Failed to fetch pending bookings: ${response.message()}")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }
    
    /**
     * Get all bookings for the provider (history)
     */
    suspend fun getProviderBookings(
        status: String? = null,
        page: Int = 1,
        limit: Int = 20
    ): Result<List<ProviderBooking>> {
        return try {
            val response = api.getProviderBookings(status, page, limit)
            if (response.isSuccessful) {
                Result.Success(response.body()?.data ?: emptyList())
            } else {
                Result.Error("Failed to fetch bookings: ${response.message()}")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }
    
    /**
     * Accept a booking request
     */
    suspend fun acceptBooking(bookingId: Int, comments: String? = null): Result<ProviderBooking> {
        return updateBookingStatus(bookingId, "accepted", comments)
    }
    
    /**
     * Reject a booking request
     */
    suspend fun rejectBooking(bookingId: Int, comments: String? = null): Result<ProviderBooking> {
        return updateBookingStatus(bookingId, "rejected", comments)
    }
    
    /**
     * Mark booking as completed
     */
    suspend fun completeBooking(bookingId: Int, comments: String? = null): Result<ProviderBooking> {
        return updateBookingStatus(bookingId, "completed", comments)
    }
    
    /**
     * Update booking status
     */
    private suspend fun updateBookingStatus(
        bookingId: Int,
        status: String,
        comments: String?
    ): Result<ProviderBooking> {
        return try {
            val request = UpdateBookingStatusRequest(status = status, comments = comments)
            val response = api.updateProviderBookingStatus(bookingId, request)
            if (response.isSuccessful) {
                response.body()?.let {
                    Result.Success(it)
                } ?: Result.Error("Empty response")
            } else {
                Result.Error("Failed to update booking: ${response.message()}")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }
    
    // ─── Services ────────────────────────────────────────────────────────────
    
    /**
     * Get all services for the provider
     */
    suspend fun getProviderServices(providerId: Int): Result<List<ProviderService>> {
        return try {
            val response = api.getProviderServices(providerId)
            if (response.isSuccessful) {
                Result.Success(response.body() ?: emptyList())
            } else {
                Result.Error("Failed to fetch services: ${response.message()}")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }
    
    /**
     * Create a new service
     */
    suspend fun createService(request: CreateServiceRequest): Result<ProviderService> {
        return try {
            val response = api.createService(request)
            if (response.isSuccessful) {
                response.body()?.let {
                    Result.Success(it)
                } ?: Result.Error("Empty response")
            } else {
                Result.Error("Failed to create service: ${response.message()}")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }
    
    /**
     * Update an existing service
     */
    suspend fun updateService(serviceId: Int, request: UpdateServiceRequest): Result<ProviderService> {
        return try {
            val response = api.updateService(serviceId, request)
            if (response.isSuccessful) {
                response.body()?.let {
                    Result.Success(it)
                } ?: Result.Error("Empty response")
            } else {
                Result.Error("Failed to update service: ${response.message()}")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }
    
    /**
     * Delete a service
     */
    suspend fun deleteService(serviceId: Int): Result<Unit> {
        return try {
            val response = api.deleteService(serviceId)
            if (response.isSuccessful) {
                Result.Success(Unit)
            } else {
                Result.Error("Failed to delete service: ${response.message()}")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }
    
    /**
     * Toggle service availability
     */
    suspend fun toggleServiceAvailability(serviceId: Int, isAvailable: Boolean): Result<ProviderService> {
        return updateService(serviceId, UpdateServiceRequest(isAvailable = isAvailable))
    }
    
    // ─── Provider Availability ───────────────────────────────────────────────
    
    /**
     * Update provider's online/offline status
     */
    suspend fun updateProviderAvailability(
        isAvailable: Boolean,
        note: String? = null
    ): Result<UserResponse> {
        return try {
            val request = ProviderAvailabilityRequest(isAvailableNow = isAvailable, availabilityNote = note)
            val response = api.updateProviderAvailability(request)
            if (response.isSuccessful) {
                response.body()?.let {
                    Result.Success(it)
                } ?: Result.Error("Empty response")
            } else {
                Result.Error("Failed to update availability: ${response.message()}")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }
}

/**
 * Result wrapper for repository operations
 */
sealed class Result<out T> {
    data class Success<out T>(val data: T) : Result<T>()
    data class Error(val message: String) : Result<Nothing>()
    object Loading : Result<Nothing>()
}
