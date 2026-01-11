package com.doorstep.tn.core.network

import com.doorstep.tn.auth.data.model.CheckUserRequest
import com.doorstep.tn.auth.data.model.CheckUserResponse
import com.doorstep.tn.auth.data.model.LoginPinRequest
import com.doorstep.tn.auth.data.model.ResetPinRequest
import com.doorstep.tn.auth.data.model.RuralRegisterRequest
import com.doorstep.tn.auth.data.model.UserResponse
import com.doorstep.tn.customer.data.model.Product
import com.doorstep.tn.customer.data.model.ProductsResponse
import com.doorstep.tn.customer.data.model.Service
import com.doorstep.tn.customer.data.model.Shop
import com.doorstep.tn.customer.data.model.Order
import com.doorstep.tn.customer.data.model.Booking
import com.doorstep.tn.customer.data.model.CartItem
import com.doorstep.tn.core.network.AddToCartRequest
import com.doorstep.tn.core.network.AddToWishlistRequest
import com.doorstep.tn.core.network.UpdateProfileRequest
import retrofit2.Response
import retrofit2.http.*

/**
 * Retrofit API interface for DoorStep TN backend
 */
interface DoorStepApi {
    
    // ==================== AUTH ENDPOINTS ====================
    
    @POST("api/auth/check-user")
    suspend fun checkUser(@Body request: CheckUserRequest): Response<CheckUserResponse>
    
    @POST("api/auth/login-pin")
    suspend fun loginWithPin(@Body request: LoginPinRequest): Response<UserResponse>
    
    @POST("api/auth/rural-register")
    suspend fun ruralRegister(@Body request: RuralRegisterRequest): Response<UserResponse>
    
    @GET("api/user")
    suspend fun getCurrentUser(): Response<UserResponse>
    
    @POST("api/logout")
    suspend fun logout(): Response<Unit>
    
    @POST("api/auth/reset-pin")
    suspend fun resetPin(@Body request: ResetPinRequest): Response<Unit>
    
    // ==================== PRODUCTS ENDPOINTS ====================
    
    @GET("api/products")
    suspend fun getProducts(
        @Query("searchTerm") search: String? = null,
        @Query("category") category: String? = null,
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 24,
        @Query("lat") latitude: Double? = null,
        @Query("lng") longitude: Double? = null,
        @Query("radius") radius: Int? = null
    ): Response<ProductsResponse>
    
    @GET("api/products/{id}")
    suspend fun getProductById(@Path("id") productId: Int): Response<Product>
    
    @GET("api/shops/{shopId}/products/{productId}")
    suspend fun getShopProduct(
        @Path("shopId") shopId: Int,
        @Path("productId") productId: Int
    ): Response<Product>
    
    // ==================== SERVICES ENDPOINTS ====================
    
    @GET("api/services")
    suspend fun getServices(
        @Query("category") category: String? = null,
        @Query("lat") latitude: Double? = null,
        @Query("lng") longitude: Double? = null,
        @Query("radius") radius: Int? = null
    ): Response<List<Service>>
    
    @GET("api/services/{id}")
    suspend fun getServiceById(@Path("id") serviceId: Int): Response<Service>
    
    // ==================== SHOPS ENDPOINTS ====================
    
    @GET("api/shops")
    suspend fun getShops(
        @Query("category") category: String? = null,
        @Query("lat") latitude: Double? = null,
        @Query("lng") longitude: Double? = null,
        @Query("search") search: String? = null,
        @Query("radius") radius: Int? = null
    ): Response<List<Shop>>
    
    @GET("api/shops/{id}")
    suspend fun getShopById(@Path("id") shopId: Int): Response<Shop>
    
    @GET("api/products/shop/{id}")
    suspend fun getShopProducts(@Path("id") shopId: Int): Response<List<Product>>
    
    // ==================== CART ENDPOINTS ====================
    
    @GET("api/cart")
    suspend fun getCart(): Response<List<CartItem>>
    
    // POST /api/cart with {productId, quantity} - matches web app
    @POST("api/cart")
    suspend fun addToCart(@Body request: AddToCartRequest): Response<Unit>
    
    // DELETE /api/cart/{productId} - uses productId as in web app
    @DELETE("api/cart/{productId}")
    suspend fun removeFromCart(@Path("productId") productId: Int): Response<Unit>
    
    // ==================== WISHLIST ENDPOINTS ====================
    
    @GET("api/wishlist")
    suspend fun getWishlist(): Response<List<Product>>
    
    @POST("api/wishlist")
    suspend fun addToWishlist(@Body request: AddToWishlistRequest): Response<Unit>
    
    @DELETE("api/wishlist/{productId}")
    suspend fun removeFromWishlist(@Path("productId") productId: Int): Response<Unit>
    
    // ==================== PROFILE ENDPOINTS ====================
    
    @PATCH("api/users/{id}")
    suspend fun updateProfile(
        @Path("id") userId: Int,
        @Body data: UpdateProfileRequest
    ): Response<UserResponse>
    
    // ==================== ORDERS ENDPOINTS ====================
    
    @GET("api/orders/customer")
    suspend fun getCustomerOrders(@Query("status") status: String? = null): Response<List<Order>>
    
    @GET("api/orders/{id}")
    suspend fun getOrderById(@Path("id") orderId: Int): Response<Order>
    
    @POST("api/orders")
    suspend fun createOrder(@Body request: CreateOrderRequest): Response<CreateOrderResponse>
    
    // ==================== BOOKINGS ENDPOINTS ====================
    
    // Use /api/bookings instead of /api/bookings/customer to get enriched data
    // /api/bookings returns service and provider info, /api/bookings/customer returns basic data only
    @GET("api/bookings")
    suspend fun getCustomerBookings(): Response<List<Booking>>
    
    @GET("api/bookings/{id}")
    suspend fun getBookingById(@Path("id") bookingId: Int): Response<Booking>

    @GET("api/bookings/service/{id}")
    suspend fun getServiceBookingSlots(
        @Path("id") serviceId: Int,
        @Query("date") date: String
    ): Response<List<ServiceBookingSlot>>

    @POST("api/bookings")
    suspend fun createBooking(@Body request: CreateBookingRequest): Response<BookingResponse>
    
    // Customer booking actions - matches web PATCH /api/bookings/{id}
    @PATCH("api/bookings/{id}")
    suspend fun updateBooking(
        @Path("id") bookingId: Int,
        @Body request: UpdateBookingRequest
    ): Response<Booking>

    // Customer booking payment and dispute actions
    @PATCH("api/bookings/{id}/customer-complete")
    suspend fun submitBookingPayment(
        @Path("id") bookingId: Int,
        @Body request: PaymentReferenceRequest
    ): Response<BookingActionResponse>

    @PATCH("api/bookings/{id}/update-reference")
    suspend fun updateBookingReference(
        @Path("id") bookingId: Int,
        @Body request: PaymentReferenceRequest
    ): Response<BookingActionResponse>

    @POST("api/bookings/{id}/report-dispute")
    suspend fun reportBookingDispute(
        @Path("id") bookingId: Int,
        @Body request: BookingDisputeRequest
    ): Response<BookingActionResponse>
    
    // Submit service review - matches web POST /api/reviews
    @POST("api/reviews")
    suspend fun submitReview(@Body request: SubmitReviewRequest): Response<ReviewResponse>

    // Get service reviews - matches web GET /api/reviews/service/:id
    @GET("api/reviews/service/{id}")
    suspend fun getServiceReviews(
        @Path("id") serviceId: Int
    ): Response<List<ServiceReview>>
    
    // Get customer's service reviews - matches web GET /api/reviews/customer
    @GET("api/reviews/customer")
    suspend fun getCustomerReviews(): Response<List<CustomerReview>>
    
    // Get customer's product reviews - matches web GET /api/product-reviews/customer
    @GET("api/product-reviews/customer")
    suspend fun getCustomerProductReviews(): Response<List<CustomerProductReview>>
    
    // Update service review - matches web PATCH /api/reviews/{id}
    @PATCH("api/reviews/{id}")
    suspend fun updateServiceReview(
        @Path("id") reviewId: Int,
        @Body request: UpdateReviewRequest
    ): Response<CustomerReview>
    
    // Update product review - matches web PATCH /api/product-reviews/{id}
    @PATCH("api/product-reviews/{id}")
    suspend fun updateProductReview(
        @Path("id") reviewId: Int,
        @Body request: UpdateReviewRequest
    ): Response<CustomerProductReview>
    
    // Create return request - matches web POST /api/orders/{orderId}/return
    @POST("api/orders/{orderId}/return")
    suspend fun createReturnRequest(
        @Path("orderId") orderId: Int,
        @Body request: CreateReturnRequest
    ): Response<Unit>
    
    // ==================== NOTIFICATION ENDPOINTS ====================
    
    // Get user notifications - matches web GET /api/notifications
    @GET("api/notifications")
    suspend fun getNotifications(): Response<NotificationsResponse>
    
    // Get unread notification count - matches web GET /api/notifications (derived)
    @GET("api/notifications")
    suspend fun getUnreadNotificationCount(): Response<NotificationsResponse>
    
    // Mark single notification as read - matches web PATCH /api/notifications/:id/read
    @PATCH("api/notifications/{id}/read")
    suspend fun markNotificationRead(@Path("id") notificationId: Int): Response<Unit>
    
    // Mark all notifications as read - matches web PATCH /api/notifications/mark-all-read
    @PATCH("api/notifications/mark-all-read")
    suspend fun markAllNotificationsRead(): Response<Unit>
    
    // Delete notification - matches web DELETE /api/notifications/:id
    @DELETE("api/notifications/{id}")
    suspend fun deleteNotification(@Path("id") notificationId: Int): Response<Unit>
    
    // ==================== ORDER PAYMENT ACTIONS ====================
    
    // Agree to final bill - POST /api/orders/:id/agree-final-bill
    @POST("api/orders/{id}/agree-final-bill")
    suspend fun agreeFinalBill(@Path("id") orderId: Int): Response<Order>
    
    // Submit payment reference - POST /api/orders/:id/submit-payment-reference
    @POST("api/orders/{id}/submit-payment-reference")
    suspend fun submitPaymentReference(
        @Path("id") orderId: Int,
        @Body body: Map<String, String>
    ): Response<Order>
    
    // Update payment method - POST /api/orders/:id/payment-method
    @POST("api/orders/{id}/payment-method")
    suspend fun updatePaymentMethod(
        @Path("id") orderId: Int,
        @Body body: Map<String, String>
    ): Response<Order>

    // Cancel order - POST /api/orders/:id/cancel
    @POST("api/orders/{id}/cancel")
    suspend fun cancelOrder(@Path("id") orderId: Int): Response<Order>
    
    // ==================== SHOP ENDPOINTS ====================
    
    @GET("api/orders/shop")
    suspend fun getShopOrders(): Response<List<Order>>
    
    @PATCH("api/orders/{id}/status")
    suspend fun updateOrderStatus(
        @Path("id") orderId: Int,
        @Body statusUpdate: Map<String, String>
    ): Response<Order>
    
    // ==================== PROVIDER ENDPOINTS ====================
    
    @GET("api/bookings/provider/pending")
    suspend fun getProviderPendingBookings(): Response<List<Booking>>
    
    @PATCH("api/bookings/{id}/status")
    suspend fun updateBookingStatus(
        @Path("id") bookingId: Int,
        @Body statusUpdate: Map<String, String>
    ): Response<Booking>
    
    // ==================== SEARCH ENDPOINTS ====================
    
    // Universal/Global search - matches web GET /api/search
    @GET("api/search")
    suspend fun globalSearch(
        @Query("q") query: String,
        @Query("lat") latitude: Double? = null,
        @Query("lng") longitude: Double? = null,
        @Query("radius") radius: Int? = null,
        @Query("limit") limit: Int? = null
    ): Response<SearchResponse>
    
    // ==================== QUICK ORDER ENDPOINTS ====================
    
    // Create text/quick order - matches web POST /api/orders/text
    @POST("api/orders/text")
    suspend fun createTextOrder(@Body request: CreateTextOrderRequest): Response<TextOrderResponse>
    
    // ==================== QUICK ADD PRODUCT ENDPOINT ====================
    
    // Quick add product - matches web POST /api/products/quick-add
    @POST("api/products/quick-add")
    suspend fun quickAddProduct(@Body request: QuickAddProductRequest): Response<Product>
    
    // ==================== ORDER TIMELINE ENDPOINT ====================
    
    // Get order timeline - matches web GET /api/orders/:id/timeline
    @GET("api/orders/{id}/timeline")
    suspend fun getOrderTimeline(@Path("id") orderId: Int): Response<List<OrderTimelineEntry>>
    
    // ==================== PRODUCT REVIEW ENDPOINT ====================
    
    // Submit product review - matches web POST /api/product-reviews
    @POST("api/product-reviews")
    suspend fun submitProductReview(@Body request: ProductReviewRequest): Response<Any>
}
