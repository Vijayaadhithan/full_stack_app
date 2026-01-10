package com.doorstep.tn.customer.data.repository

import com.doorstep.tn.auth.data.repository.Result
import com.doorstep.tn.core.cache.CacheRepository
import com.doorstep.tn.core.cache.MemoryCache
import com.doorstep.tn.core.network.DoorStepApi
import com.doorstep.tn.customer.data.model.*
import kotlinx.coroutines.flow.firstOrNull
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for customer operations with multi-layer caching:
 * 1. In-memory cache (fastest, 5-min TTL)
 * 2. Room database (offline support, 5-min TTL)
 * 3. Network API (source of truth)
 */
@Singleton
class CustomerRepository @Inject constructor(
    private val api: DoorStepApi,
    private val cacheRepository: CacheRepository
) {
    // In-memory caches with 5-minute TTL (Layer 1 - fastest)
    private val productsCache = MemoryCache<String, List<Product>>(maxSize = 50)
    private val servicesCache = MemoryCache<String, List<Service>>(maxSize = 50)
    private val shopsCache = MemoryCache<String, List<Shop>>(maxSize = 50)
    private val productDetailCache = MemoryCache<Int, Product>(maxSize = 100)
    private val serviceDetailCache = MemoryCache<Int, Service>(maxSize = 100)
    private val shopDetailCache = MemoryCache<Int, Shop>(maxSize = 50)
    
    /**
     * Invalidate all caches - call after mutations that affect cached data
     */
    fun invalidateProductsCache() {
        productsCache.clear()
        // Note: Room cache expires via TTL, no need to explicitly clear
    }
    fun invalidateServicesCache() = servicesCache.clear()
    fun invalidateShopsCache() = shopsCache.clear()
    
    // ==================== Products ====================
    
    /**
     * Get products with offline-first strategy:
     * 1. Return in-memory cache if available
     * 2. Try network, cache to Room + memory on success
     * 3. Fall back to Room cache on network failure
     */
    suspend fun getProducts(
        search: String? = null,
        category: String? = null,
        latitude: Double? = null,
        longitude: Double? = null,
        radius: Int? = null,
        page: Int = 1,
        pageSize: Int = 24
    ): Result<List<Product>> {
        // Generate cache key from parameters
        val cacheKey = "products_${search}_${category}_${latitude}_${longitude}_${radius}_${page}"
        
        // Layer 1: In-memory cache (instant)
        productsCache.get(cacheKey)?.let { 
            return Result.Success(it) 
        }
        
        // Layer 2 + 3: Try network, fall back to Room
        return try {
            val response = api.getProducts(search, category, page, pageSize, latitude, longitude, radius)
            if (response.isSuccessful && response.body() != null) {
                val items = response.body()!!.items
                // Cache to memory (Layer 1)
                productsCache.put(cacheKey, items)
                // Cache to Room database (Layer 2 - offline support)
                cacheRepository.cacheProducts(items, cacheKey)
                Result.Success(items)
            } else {
                // Network failed, try Room cache
                val cachedProducts = cacheRepository.getCachedProducts().firstOrNull()
                if (!cachedProducts.isNullOrEmpty()) {
                    Result.Success(cachedProducts)
                } else {
                    Result.Error(response.message(), response.code())
                }
            }
        } catch (e: Exception) {
            // Network error - return Room cache for offline support
            val cachedProducts = cacheRepository.getCachedProducts().firstOrNull()
            if (!cachedProducts.isNullOrEmpty()) {
                Result.Success(cachedProducts)
            } else {
                Result.Error(e.message ?: "Failed to load products")
            }
        }
    }
    
    suspend fun getProductById(productId: Int): Result<Product> {
        // Check cache first
        productDetailCache.get(productId)?.let { return Result.Success(it) }
        
        return try {
            val response = api.getProductById(productId)
            if (response.isSuccessful && response.body() != null) {
                val product = response.body()!!
                productDetailCache.put(productId, product)
                Result.Success(product)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to load product")
        }
    }
    
    // Get product with shopId - matches web app's /api/shops/{shopId}/products/{productId}
    suspend fun getShopProduct(shopId: Int, productId: Int): Result<Product> {
        // Check cache first
        productDetailCache.get(productId)?.let { return Result.Success(it) }
        
        return try {
            val response = api.getShopProduct(shopId, productId)
            if (response.isSuccessful && response.body() != null) {
                val product = response.body()!!
                productDetailCache.put(productId, product)
                Result.Success(product)
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
        search: String? = null,
        radius: Int? = null
    ): Result<List<Shop>> {
        val cacheKey = "shops_${category}_${latitude}_${longitude}_${search}_${radius}"
        
        // Layer 1: In-memory cache
        shopsCache.get(cacheKey)?.let { return Result.Success(it) }
        
        // Layer 2 + 3: Network with Room fallback
        return try {
            val response = api.getShops(category, latitude, longitude, search, radius)
            if (response.isSuccessful && response.body() != null) {
                val shops = response.body()!!
                shopsCache.put(cacheKey, shops)
                cacheRepository.cacheShops(shops, cacheKey)
                Result.Success(shops)
            } else {
                val cachedShops = cacheRepository.getCachedShops().firstOrNull()
                if (!cachedShops.isNullOrEmpty()) {
                    Result.Success(cachedShops)
                } else {
                    Result.Error(response.message(), response.code())
                }
            }
        } catch (e: Exception) {
            val cachedShops = cacheRepository.getCachedShops().firstOrNull()
            if (!cachedShops.isNullOrEmpty()) {
                Result.Success(cachedShops)
            } else {
                Result.Error(e.message ?: "Failed to load shops")
            }
        }
    }
    
    suspend fun getShopById(shopId: Int): Result<Shop> {
        shopDetailCache.get(shopId)?.let { return Result.Success(it) }
        
        return try {
            val response = api.getShopById(shopId)
            if (response.isSuccessful && response.body() != null) {
                val shop = response.body()!!
                shopDetailCache.put(shopId, shop)
                Result.Success(shop)
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
        latitude: Double? = null,
        longitude: Double? = null,
        radius: Int? = null
    ): Result<List<Service>> {
        val cacheKey = "services_${category}_${latitude}_${longitude}_${radius}"
        
        // Layer 1: In-memory cache
        servicesCache.get(cacheKey)?.let { return Result.Success(it) }
        
        // Layer 2 + 3: Network with Room fallback
        return try {
            val response = api.getServices(category, latitude, longitude, radius)
            if (response.isSuccessful && response.body() != null) {
                val services = response.body()!!
                servicesCache.put(cacheKey, services)
                cacheRepository.cacheServices(services, cacheKey)
                Result.Success(services)
            } else {
                val cachedServices = cacheRepository.getCachedServices().firstOrNull()
                if (!cachedServices.isNullOrEmpty()) {
                    Result.Success(cachedServices)
                } else {
                    Result.Error(response.message(), response.code())
                }
            }
        } catch (e: Exception) {
            val cachedServices = cacheRepository.getCachedServices().firstOrNull()
            if (!cachedServices.isNullOrEmpty()) {
                Result.Success(cachedServices)
            } else {
                Result.Error(e.message ?: "Failed to load services")
            }
        }
    }
    
    suspend fun getServiceById(serviceId: Int): Result<Service> {
        serviceDetailCache.get(serviceId)?.let { return Result.Success(it) }
        
        return try {
            val response = api.getServiceById(serviceId)
            if (response.isSuccessful && response.body() != null) {
                val service = response.body()!!
                serviceDetailCache.put(serviceId, service)
                Result.Success(service)
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
        timeSlotLabel: String?,  // Nullable - null for emergency "now" bookings
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
    
    // Cancel booking - matches web PATCH /api/bookings/{id} with status: "cancelled"
    suspend fun cancelBooking(bookingId: Int): Result<Booking> {
        return try {
            val request = com.doorstep.tn.core.network.UpdateBookingRequest(
                status = "cancelled"
            )
            val response = api.updateBooking(bookingId, request)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to cancel booking")
        }
    }
    
    // Reschedule booking - matches web PATCH /api/bookings/{id}
    suspend fun rescheduleBooking(
        bookingId: Int,
        newBookingDate: String,
        comments: String? = null
    ): Result<Booking> {
        return try {
            val request = com.doorstep.tn.core.network.UpdateBookingRequest(
                bookingDate = newBookingDate,
                comments = comments
            )
            val response = api.updateBooking(bookingId, request)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to reschedule booking")
        }
    }
    
    // Submit service review - matches web POST /api/reviews
    suspend fun submitReview(
        serviceId: Int,
        rating: Int,
        review: String,
        bookingId: Int
    ): Result<com.doorstep.tn.core.network.ReviewResponse> {
        return try {
            val request = com.doorstep.tn.core.network.SubmitReviewRequest(
                serviceId = serviceId,
                rating = rating,
                review = review,
                bookingId = bookingId
            )
            val response = api.submitReview(request)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to submit review")
        }
    }
    
    // Get customer's service reviews - matches web GET /api/reviews/customer
    suspend fun getCustomerReviews(): Result<List<com.doorstep.tn.core.network.CustomerReview>> {
        return try {
            val response = api.getCustomerReviews()
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to load reviews")
        }
    }
    
    // Get customer's product reviews - matches web GET /api/product-reviews/customer
    suspend fun getCustomerProductReviews(): Result<List<com.doorstep.tn.core.network.CustomerProductReview>> {
        return try {
            val response = api.getCustomerProductReviews()
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to load product reviews")
        }
    }

    // Update service review - matches web PATCH /api/reviews/{id}
    suspend fun updateServiceReview(reviewId: Int, rating: Int? = null, review: String? = null): Result<com.doorstep.tn.core.network.CustomerReview> {
        return try {
            val request = com.doorstep.tn.core.network.UpdateReviewRequest(rating = rating, review = review)
            val response = api.updateServiceReview(reviewId, request)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to update service review")
        }
    }
    
    // Update product review - matches web PATCH /api/product-reviews/{id}
    suspend fun updateProductReview(reviewId: Int, rating: Int? = null, review: String? = null): Result<com.doorstep.tn.core.network.CustomerProductReview> {
        return try {
            val request = com.doorstep.tn.core.network.UpdateReviewRequest(rating = rating, review = review)
            val response = api.updateProductReview(reviewId, request)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to update product review")
        }
    }
    
    // Create return request - matches web POST /api/orders/{orderId}/return
    suspend fun createReturnRequest(orderId: Int, reason: String, comments: String? = null): Result<Unit> {
        return try {
            val request = com.doorstep.tn.core.network.CreateReturnRequest(reason = reason, comments = comments)
            val response = api.createReturnRequest(orderId, request)
            if (response.isSuccessful) {
                Result.Success(Unit)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to create return request")
        }
    }
    
    // ==================== NOTIFICATION OPERATIONS ====================
    
    // Get user notifications - matches web GET /api/notifications
    suspend fun getNotifications(): Result<List<com.doorstep.tn.core.network.AppNotification>> {
        return try {
            val response = api.getNotifications()
            if (response.isSuccessful && response.body() != null) {
                // Extract notifications list from wrapper object (server returns {data: [...], total, totalPages})
                Result.Success(response.body()!!.data)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to load notifications")
        }
    }
    
    // Mark notification as read - matches web PATCH /api/notifications/:id/read
    suspend fun markNotificationRead(notificationId: Int): Result<Unit> {
        return try {
            val response = api.markNotificationRead(notificationId)
            if (response.isSuccessful) {
                Result.Success(Unit)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to mark notification as read")
        }
    }
    
    // Mark all notifications as read - matches web POST /api/notifications/mark-all-read
    suspend fun markAllNotificationsRead(): Result<Unit> {
        return try {
            val response = api.markAllNotificationsRead()
            if (response.isSuccessful) {
                Result.Success(Unit)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to mark all notifications as read")
        }
    }
    
    // Delete notification - matches web DELETE /api/notifications/:id
    suspend fun deleteNotification(notificationId: Int): Result<Unit> {
        return try {
            val response = api.deleteNotification(notificationId)
            if (response.isSuccessful) {
                Result.Success(Unit)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to delete notification")
        }
    }
    
    // ==================== SEARCH OPERATIONS ====================
    
    // Global/Universal search - matches web GET /api/search
    suspend fun globalSearch(
        query: String,
        latitude: Double? = null,
        longitude: Double? = null,
        radius: Int? = null,
        limit: Int? = null
    ): Result<com.doorstep.tn.core.network.SearchResponse> {
        return try {
            val response = api.globalSearch(query, latitude, longitude, radius, limit)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to perform search")
        }
    }
    
    // ==================== QUICK ORDER OPERATIONS ====================
    
    // Create text/quick order - matches web POST /api/orders/text
    suspend fun createTextOrder(
        shopId: Int,
        orderText: String,
        deliveryMethod: String
    ): Result<com.doorstep.tn.core.network.TextOrderResponse> {
        return try {
            val request = com.doorstep.tn.core.network.CreateTextOrderRequest(
                shopId = shopId,
                orderText = orderText,
                deliveryMethod = deliveryMethod
            )
            val response = api.createTextOrder(request)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to create quick order")
        }
    }
    
    // ==================== QUICK ADD PRODUCT OPERATIONS ====================
    
    // Quick Add Product - matches web POST /api/products/quick-add
    suspend fun quickAddProduct(
        name: String,
        price: String,
        category: String
    ): Result<com.doorstep.tn.customer.data.model.Product> {
        return try {
            val request = com.doorstep.tn.core.network.QuickAddProductRequest(
                name = name,
                price = price,
                category = category
            )
            val response = api.quickAddProduct(request)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to quick add product")
        }
    }
    
    // ==================== ORDER TIMELINE OPERATIONS ====================
    
    // Get order timeline - matches web GET /api/orders/:id/timeline
    suspend fun getOrderTimeline(orderId: Int): Result<List<com.doorstep.tn.core.network.OrderTimelineEntry>> {
        return try {
            val response = api.getOrderTimeline(orderId)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to load order timeline")
        }
    }
    
    // ==================== PRODUCT REVIEW OPERATIONS ====================
    
    // Submit product review - matches web POST /api/product-reviews
    suspend fun submitProductReview(
        productId: Int,
        orderId: Int,
        rating: Int,
        review: String
    ): Result<Any> {
        return try {
            val request = com.doorstep.tn.core.network.ProductReviewRequest(
                productId = productId,
                orderId = orderId,
                rating = rating,
                review = review
            )
            val response = api.submitProductReview(request)
            if (response.isSuccessful) {
                Result.Success(response.body() ?: Unit)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to submit review")
        }
    }
}

