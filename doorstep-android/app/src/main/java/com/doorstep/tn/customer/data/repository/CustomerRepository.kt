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
        page: Int = 1,
        pageSize: Int = 24
    ): Result<List<Product>> {
        return try {
            val response = api.getProducts(search, category, page, pageSize)
            if (response.isSuccessful && response.body() != null) {
                // Extract items from paginated response
                Result.Success(response.body()!!.items)
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
    
    // Get product with shopId - matches web app's /api/shops/{shopId}/products/{productId}
    suspend fun getShopProduct(shopId: Int, productId: Int): Result<Product> {
        return try {
            val response = api.getShopProduct(shopId, productId)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to load product")
        }
    }
    
    // ==================== Shops ====================
    
    suspend fun getShops(
        category: String? = null,
        latitude: Double? = null,
        longitude: Double? = null,
        search: String? = null
    ): Result<List<Shop>> {
        return try {
            val response = api.getShops(category, latitude, longitude, search)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to load shops")
        }
    }
    
    suspend fun getShopById(shopId: Int): Result<Shop> {
        return try {
            val response = api.getShopById(shopId)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to load shop")
        }
    }
    
    suspend fun getShopProducts(shopId: Int): Result<List<Product>> {
        return try {
            val response = api.getShopProducts(shopId)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to load shop products")
        }
    }
    
    // ==================== Services ====================
    
    suspend fun getServices(
        category: String? = null,
        searchTerm: String? = null,
        latitude: Double? = null,
        longitude: Double? = null
    ): Result<List<Service>> {
        return try {
            val response = api.getServices(category, searchTerm, latitude, longitude)
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
    
    suspend fun addToCart(productId: Int, quantity: Int = 1): Result<CartItem> {
        return try {
            val request = com.doorstep.tn.core.network.AddToCartRequest(productId, quantity)
            val response = api.addToCart(request)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to add to cart")
        }
    }
    
    suspend fun removeFromCart(productId: Int): Result<Unit> {
        return try {
            val response = api.removeFromCart(productId)
            if (response.isSuccessful) {
                Result.Success(Unit)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to remove from cart")
        }
    }
    
    // ==================== Wishlist ====================
    
    suspend fun getWishlist(): Result<List<Product>> {
        return try {
            val response = api.getWishlist()
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to load wishlist")
        }
    }
    
    suspend fun addToWishlist(productId: Int): Result<Unit> {
        return try {
            val request = com.doorstep.tn.core.network.AddToWishlistRequest(productId)
            val response = api.addToWishlist(request)
            if (response.isSuccessful) {
                Result.Success(Unit)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to add to wishlist")
        }
    }
    
    suspend fun removeFromWishlist(productId: Int): Result<Unit> {
        return try {
            val response = api.removeFromWishlist(productId)
            if (response.isSuccessful) {
                Result.Success(Unit)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to remove from wishlist")
        }
    }
    
    // ==================== Profile ====================
    
    suspend fun updateProfile(userId: Int, data: com.doorstep.tn.core.network.UpdateProfileRequest): Result<com.doorstep.tn.auth.data.model.UserResponse> {
        return try {
            val response = api.updateProfile(userId, data)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to update profile")
        }
    }
    
    // ==================== Orders ====================
    
    suspend fun getCustomerOrders(status: String? = null): Result<List<Order>> {
        return try {
            val response = api.getCustomerOrders(status = status)
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
    
    // Create order - matches web POST /api/orders
    suspend fun createOrder(
        items: List<com.doorstep.tn.core.network.OrderItemRequest>,
        subtotal: String,
        total: String,
        deliveryMethod: String,
        paymentMethod: String
    ): Result<Order> {
        return try {
            val request = com.doorstep.tn.core.network.CreateOrderRequest(
                items = items,
                subtotal = subtotal,
                total = total,
                discount = "0",
                promotionId = null,
                deliveryMethod = deliveryMethod,
                paymentMethod = paymentMethod
            )
            val response = api.createOrder(request)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to create order")
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
    
    // Create booking - matches web POST /api/bookings
    suspend fun createBooking(
        serviceId: Int,
        bookingDate: String,
        timeSlotLabel: String,
        serviceLocation: String
    ): Result<com.doorstep.tn.core.network.BookingResponse> {
        return try {
            val request = com.doorstep.tn.core.network.CreateBookingRequest(
                serviceId = serviceId,
                bookingDate = bookingDate,
                serviceLocation = serviceLocation,
                timeSlotLabel = timeSlotLabel
            )
            val response = api.createBooking(request)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to create booking")
        }
    }
}

