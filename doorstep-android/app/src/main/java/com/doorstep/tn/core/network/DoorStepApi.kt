package com.doorstep.tn.core.network

import com.doorstep.tn.auth.data.model.CheckUserRequest
import com.doorstep.tn.auth.data.model.CheckUserResponse
import com.doorstep.tn.auth.data.model.LoginPinRequest
import com.doorstep.tn.auth.data.model.RuralRegisterRequest
import com.doorstep.tn.auth.data.model.UserResponse
import com.doorstep.tn.customer.data.model.Product
import com.doorstep.tn.customer.data.model.Service
import com.doorstep.tn.customer.data.model.Order
import com.doorstep.tn.customer.data.model.Booking
import com.doorstep.tn.customer.data.model.CartItem
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
    
    @POST("api/auth/logout")
    suspend fun logout(): Response<Unit>
    
    // ==================== PRODUCTS ENDPOINTS ====================
    
    @GET("api/products")
    suspend fun getProducts(
        @Query("search") search: String? = null,
        @Query("category") category: String? = null,
        @Query("limit") limit: Int = 20,
        @Query("offset") offset: Int = 0
    ): Response<List<Product>>
    
    @GET("api/products/{id}")
    suspend fun getProductById(@Path("id") productId: Int): Response<Product>
    
    // ==================== SERVICES ENDPOINTS ====================
    
    @GET("api/services")
    suspend fun getServices(
        @Query("category") category: String? = null,
        @Query("lat") latitude: Double? = null,
        @Query("lng") longitude: Double? = null,
        @Query("limit") limit: Int = 20
    ): Response<List<Service>>
    
    @GET("api/services/{id}")
    suspend fun getServiceById(@Path("id") serviceId: Int): Response<Service>
    
    // ==================== CART ENDPOINTS ====================
    
    @GET("api/cart")
    suspend fun getCart(): Response<List<CartItem>>
    
    @POST("api/cart")
    suspend fun addToCart(@Body item: CartItem): Response<CartItem>
    
    @DELETE("api/cart/{id}")
    suspend fun removeFromCart(@Path("id") itemId: Int): Response<Unit>
    
    // ==================== ORDERS ENDPOINTS ====================
    
    @GET("api/orders/customer")
    suspend fun getCustomerOrders(): Response<List<Order>>
    
    @GET("api/orders/{id}")
    suspend fun getOrderById(@Path("id") orderId: Int): Response<Order>
    
    @POST("api/orders")
    suspend fun createOrder(@Body order: Order): Response<Order>
    
    // ==================== BOOKINGS ENDPOINTS ====================
    
    @GET("api/bookings/customer")
    suspend fun getCustomerBookings(): Response<List<Booking>>
    
    @GET("api/bookings/{id}")
    suspend fun getBookingById(@Path("id") bookingId: Int): Response<Booking>
    
    @POST("api/bookings")
    suspend fun createBooking(@Body booking: Booking): Response<Booking>
    
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
}
