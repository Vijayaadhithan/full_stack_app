package com.doorstep.tn.customer.data.repository

import com.doorstep.tn.auth.data.repository.Result
import com.doorstep.tn.core.network.DoorStepApi
import com.doorstep.tn.customer.data.model.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for customer operations
 */
@Singleton
class CustomerRepository @Inject constructor(
    private val api: DoorStepApi
) {
    
    // ==================== Products ====================
    
    suspend fun getProducts(
        search: String? = null,
        category: String? = null,
        limit: Int = 20,
        offset: Int = 0
    ): Result<List<Product>> {
        return try {
            val response = api.getProducts(search, category, limit, offset)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to load products")
        }
    }
    
    suspend fun getProductById(productId: Int): Result<Product> {
        return try {
            val response = api.getProductById(productId)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to load product")
        }
    }
    
    // ==================== Services ====================
    
    suspend fun getServices(
        category: String? = null,
        latitude: Double? = null,
        longitude: Double? = null,
        limit: Int = 20
    ): Result<List<Service>> {
        return try {
            val response = api.getServices(category, latitude, longitude, limit)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to load services")
        }
    }
    
    suspend fun getServiceById(serviceId: Int): Result<Service> {
        return try {
            val response = api.getServiceById(serviceId)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to load service")
        }
    }
    
    // ==================== Cart ====================
    
    suspend fun getCart(): Result<List<CartItem>> {
        return try {
            val response = api.getCart()
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to load cart")
        }
    }
    
    suspend fun addToCart(productId: Int, quantity: Int): Result<CartItem> {
        return try {
            val response = api.addToCart(CartItem(productId = productId, quantity = quantity))
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to add to cart")
        }
    }
    
    suspend fun removeFromCart(itemId: Int): Result<Unit> {
        return try {
            val response = api.removeFromCart(itemId)
            if (response.isSuccessful) {
                Result.Success(Unit)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to remove from cart")
        }
    }
    
    // ==================== Orders ====================
    
    suspend fun getCustomerOrders(): Result<List<Order>> {
        return try {
            val response = api.getCustomerOrders()
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to load orders")
        }
    }
    
    suspend fun getOrderById(orderId: Int): Result<Order> {
        return try {
            val response = api.getOrderById(orderId)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to load order")
        }
    }
    
    // ==================== Bookings ====================
    
    suspend fun getCustomerBookings(): Result<List<Booking>> {
        return try {
            val response = api.getCustomerBookings()
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to load bookings")
        }
    }
    
    suspend fun getBookingById(bookingId: Int): Result<Booking> {
        return try {
            val response = api.getBookingById(bookingId)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to load booking")
        }
    }
}
