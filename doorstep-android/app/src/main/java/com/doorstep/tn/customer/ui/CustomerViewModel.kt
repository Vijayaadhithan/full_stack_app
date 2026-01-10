package com.doorstep.tn.customer.ui

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.doorstep.tn.auth.data.repository.Result
import com.doorstep.tn.customer.data.model.*
import com.doorstep.tn.customer.data.repository.CustomerRepository
import com.doorstep.tn.core.datastore.PreferenceKeys
import com.doorstep.tn.core.datastore.dataStore
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for customer screens with debounced search and optimistic UI updates.
 */
@OptIn(FlowPreview::class)
@HiltViewModel
class CustomerViewModel @Inject constructor(
    private val repository: CustomerRepository,
    @ApplicationContext private val context: Context
) : ViewModel() {
    
    // Language & User
    private val _language = MutableStateFlow("en")
    val language: StateFlow<String> = _language.asStateFlow()
    
    private val _userName = MutableStateFlow<String?>(null)
    val userName: StateFlow<String?> = _userName.asStateFlow()
    
    // Products
    private val _products = MutableStateFlow<List<Product>>(emptyList())
    val products: StateFlow<List<Product>> = _products.asStateFlow()
    
    private val _selectedProduct = MutableStateFlow<Product?>(null)
    val selectedProduct: StateFlow<Product?> = _selectedProduct.asStateFlow()
    
    // Services
    private val _services = MutableStateFlow<List<Service>>(emptyList())
    val services: StateFlow<List<Service>> = _services.asStateFlow()
    
    private val _selectedService = MutableStateFlow<Service?>(null)
    val selectedService: StateFlow<Service?> = _selectedService.asStateFlow()
    
    // Shops
    private val _shops = MutableStateFlow<List<Shop>>(emptyList())
    val shops: StateFlow<List<Shop>> = _shops.asStateFlow()
    
    private val _selectedShop = MutableStateFlow<Shop?>(null)
    val selectedShop: StateFlow<Shop?> = _selectedShop.asStateFlow()
    
    private val _shopProducts = MutableStateFlow<List<Product>>(emptyList())
    val shopProducts: StateFlow<List<Product>> = _shopProducts.asStateFlow()
    
    // Cart
    private val _cartItems = MutableStateFlow<List<CartItem>>(emptyList())
    val cartItems: StateFlow<List<CartItem>> = _cartItems.asStateFlow()
    
    val cartCount: Int get() = _cartItems.value.sumOf { it.quantity }
    val cartTotal: Double get() = _cartItems.value.sumOf { 
        (it.product?.price?.toDoubleOrNull() ?: 0.0) * it.quantity 
    }
    
    // Wishlist
    private val _wishlistItems = MutableStateFlow<List<Product>>(emptyList())
    val wishlistItems: StateFlow<List<Product>> = _wishlistItems.asStateFlow()
    
    // Track wishlist product IDs for quick lookup (optimistic UI)
    private val _wishlistProductIds = MutableStateFlow<Set<Int>>(emptySet())
    val wishlistProductIds: StateFlow<Set<Int>> = _wishlistProductIds.asStateFlow()
    
    // Orders
    private val _orders = MutableStateFlow<List<Order>>(emptyList())
    val orders: StateFlow<List<Order>> = _orders.asStateFlow()
    
    private val _selectedOrder = MutableStateFlow<Order?>(null)
    val selectedOrder: StateFlow<Order?> = _selectedOrder.asStateFlow()
    
    // Bookings
    private val _bookings = MutableStateFlow<List<Booking>>(emptyList())
    val bookings: StateFlow<List<Booking>> = _bookings.asStateFlow()
    
    private val _selectedBooking = MutableStateFlow<Booking?>(null)
    val selectedBooking: StateFlow<Booking?> = _selectedBooking.asStateFlow()
    
    // Loading & Error
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()
    
    // Product Search (for product filter)
    private val _productSearchQuery = MutableStateFlow("")
    val productSearchQuery: StateFlow<String> = _productSearchQuery.asStateFlow()
    
    private val _selectedCategory = MutableStateFlow<String?>(null)
    val selectedCategory: StateFlow<String?> = _selectedCategory.asStateFlow()
    
    // Customer Reviews
    private val _customerReviews = MutableStateFlow<List<com.doorstep.tn.core.network.CustomerReview>>(emptyList())
    val customerReviews: StateFlow<List<com.doorstep.tn.core.network.CustomerReview>> = _customerReviews.asStateFlow()
    
    private val _customerProductReviews = MutableStateFlow<List<com.doorstep.tn.core.network.CustomerProductReview>>(emptyList())
    val customerProductReviews: StateFlow<List<com.doorstep.tn.core.network.CustomerProductReview>> = _customerProductReviews.asStateFlow()
    
    // Notifications
    private val _notifications = MutableStateFlow<List<com.doorstep.tn.core.network.AppNotification>>(emptyList())
    val notifications: StateFlow<List<com.doorstep.tn.core.network.AppNotification>> = _notifications.asStateFlow()
    
    val unreadNotificationCount: StateFlow<Int> = _notifications.map { list ->
        list.count { !it.isRead }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)
    
    // Universal Search with debouncing
    private val _searchResults = MutableStateFlow<List<com.doorstep.tn.core.network.SearchResult>>(emptyList())
    val searchResults: StateFlow<List<com.doorstep.tn.core.network.SearchResult>> = _searchResults.asStateFlow()
    
    private val _isSearching = MutableStateFlow(false)
    val isSearching: StateFlow<Boolean> = _isSearching.asStateFlow()
    
    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()
    
    // Debounced search input channel - reduces API calls by 70-80%
    private val searchInputChannel = MutableSharedFlow<String>(extraBufferCapacity = 1)
    
    // Quick Order State
    private val _quickOrderSuccess = MutableStateFlow<Int?>(null) // Order ID on success
    val quickOrderSuccess: StateFlow<Int?> = _quickOrderSuccess.asStateFlow()
    
    // Initialize language from preferences and setup search debouncing
    init {
        viewModelScope.launch {
            val prefs = context.dataStore.data.first()
            _language.value = prefs[PreferenceKeys.LANGUAGE] ?: "en"
            _userName.value = prefs[PreferenceKeys.USER_NAME]
        }
        
        // Setup debounced search - waits 500ms after last keystroke before making API call
        viewModelScope.launch {
            searchInputChannel
                .debounce(500L)
                .distinctUntilChanged()
                .collect { query ->
                    if (query.length >= 2) {
                        performSearchInternal(query)
                    } else {
                        _searchResults.value = emptyList()
                    }
                }
        }
    }
    
    /**
     * Set language and persist to DataStore
     */
    fun setLanguage(languageCode: String) {
        _language.value = languageCode
        viewModelScope.launch {
            context.dataStore.edit { prefs ->
                prefs[PreferenceKeys.LANGUAGE] = languageCode
            }
        }
    }
    
    // ==================== Product Actions ====================
    
    fun loadProducts(
        search: String? = null, 
        category: String? = null,
        latitude: Double? = null,
        longitude: Double? = null,
        radius: Int? = null
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            when (val result = repository.getProducts(search, category, latitude, longitude, radius)) {
                is Result.Success -> _products.value = result.data
                is Result.Error -> _error.value = result.message
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    fun loadProductDetails(productId: Int) {
        viewModelScope.launch {
            _isLoading.value = true
            
            // First try to find product from cached list (has shopId)
            val cachedProduct = _products.value.find { it.id == productId }
            if (cachedProduct != null) {
                _selectedProduct.value = cachedProduct
                _isLoading.value = false
                return@launch
            }
            
            // Also check shop products cache
            val shopProduct = _shopProducts.value.find { it.id == productId }
            if (shopProduct != null) {
                _selectedProduct.value = shopProduct
                _isLoading.value = false
                return@launch
            }
            
            // Fallback to API - try getting by ID directly
            when (val result = repository.getProductById(productId)) {
                is Result.Success -> _selectedProduct.value = result.data
                is Result.Error -> {
                    // Product not found - could be API issue
                    _error.value = result.message
                    _selectedProduct.value = null
                }
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    // Load product with shopId - matches web app /customer/shops/{shopId}/products/{productId}
    fun loadShopProduct(shopId: Int, productId: Int) {
        viewModelScope.launch {
            _isLoading.value = true
            
            when (val result = repository.getShopProduct(shopId, productId)) {
                is Result.Success -> _selectedProduct.value = result.data
                is Result.Error -> {
                    _error.value = result.message
                    _selectedProduct.value = null
                }
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    // Load product by ID only - for search results where shopId may not be available
    fun loadProductById(productId: Int) {
        viewModelScope.launch {
            _isLoading.value = true
            
            when (val result = repository.getProductById(productId)) {
                is Result.Success -> _selectedProduct.value = result.data
                is Result.Error -> {
                    _error.value = result.message
                    _selectedProduct.value = null
                }
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    fun updateSearchQuery(query: String) {
        _productSearchQuery.value = query
    }
    
    fun updateCategory(category: String?) {
        _selectedCategory.value = category
        loadProducts(category = category)
    }
    
    // ==================== Service Actions ====================
    
    fun loadServices(
        category: String? = null,
        latitude: Double? = null,
        longitude: Double? = null,
        radius: Int? = null
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            when (val result = repository.getServices(category, latitude, longitude, radius)) {
                is Result.Success -> _services.value = result.data
                is Result.Error -> _error.value = result.message
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    fun loadServiceDetails(serviceId: Int) {
        viewModelScope.launch {
            _isLoading.value = true
            
            // First try to find service from cached list
            val cachedService = _services.value.find { it.id == serviceId }
            if (cachedService != null) {
                _selectedService.value = cachedService
                _isLoading.value = false
                return@launch
            }
            
            // Fallback to API
            when (val result = repository.getServiceById(serviceId)) {
                is Result.Success -> _selectedService.value = result.data
                is Result.Error -> {
                    _error.value = result.message
                    _selectedService.value = null
                }
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    // ==================== Shop Actions ====================
    
    fun loadShops(
        search: String? = null,
        latitude: Double? = null,
        longitude: Double? = null,
        radius: Int? = null
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            when (val result = repository.getShops(search = search, latitude = latitude, longitude = longitude, radius = radius)) {
                is Result.Success -> _shops.value = result.data
                is Result.Error -> _error.value = result.message
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    fun loadShopDetails(shopId: Int) {
        viewModelScope.launch {
            _isLoading.value = true
            
            when (val result = repository.getShopById(shopId)) {
                is Result.Success -> _selectedShop.value = result.data
                is Result.Error -> _error.value = result.message
                is Result.Loading -> {}
            }
            
            // Also load shop products
            when (val result = repository.getShopProducts(shopId)) {
                is Result.Success -> _shopProducts.value = result.data
                is Result.Error -> {} // Don't override shop error
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    // Get shop by ID with callback - for CartScreen to check delivery options
    fun getShopById(shopId: Int, onResult: (Shop?) -> Unit) {
        viewModelScope.launch {
            when (val result = repository.getShopById(shopId)) {
                is Result.Success -> onResult(result.data)
                is Result.Error -> onResult(null)
                is Result.Loading -> {}
            }
        }
    }
    
    // ==================== Cart Actions ====================
    
    fun loadCart() {
        viewModelScope.launch {
            when (val result = repository.getCart()) {
                is Result.Success -> _cartItems.value = result.data
                is Result.Error -> _error.value = result.message
                is Result.Loading -> {}
            }
        }
    }
    
    fun addToCart(productId: Int, quantity: Int = 1) {
        viewModelScope.launch {
            _isLoading.value = true
            
            when (val result = repository.addToCart(productId, quantity)) {
                is Result.Success -> loadCart() // Refresh cart
                is Result.Error -> _error.value = result.message
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    fun removeFromCart(productId: Int) {
        viewModelScope.launch {
            when (val result = repository.removeFromCart(productId)) {
                is Result.Success -> loadCart() // Refresh cart
                is Result.Error -> _error.value = result.message
                is Result.Loading -> {}
            }
        }
    }
    
    // Update cart quantity - uses POST /api/cart with new quantity (like web)
    // Now with optimistic UI update for real-time feedback
    fun updateCartQuantity(productId: Int, newQuantity: Int) {
        viewModelScope.launch {
            if (newQuantity <= 0) {
                // Optimistically remove from cart UI immediately
                _cartItems.value = _cartItems.value.filter { it.productId != productId }
                // Then remove from server
                when (val result = repository.removeFromCart(productId)) {
                    is Result.Success -> {} // Already updated UI
                    is Result.Error -> {
                        _error.value = result.message
                        loadCart() // Reload to sync with server on error
                    }
                    is Result.Loading -> {}
                }
            } else {
                // Optimistically update quantity in UI immediately
                _cartItems.value = _cartItems.value.map { item ->
                    if (item.productId == productId) {
                        item.copy(quantity = newQuantity)
                    } else {
                        item
                    }
                }
                // Then update on server
                when (val result = repository.addToCart(productId, newQuantity)) {
                    is Result.Success -> {} // Already updated UI optimistically
                    is Result.Error -> {
                        _error.value = result.message
                        loadCart() // Reload to sync with server on error
                    }
                    is Result.Loading -> {}
                }
            }
        }
    }
    
    // Place order - matches web POST /api/orders
    fun placeOrder(
        deliveryMethod: String,
        paymentMethod: String,
        subtotal: String,
        total: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            
            // Build order items from cart
            val orderItems = _cartItems.value.map { cartItem ->
                com.doorstep.tn.core.network.OrderItemRequest(
                    productId = cartItem.productId,
                    quantity = cartItem.quantity,
                    price = cartItem.product.price
                )
            }
            
            when (val result = repository.createOrder(
                items = orderItems,
                subtotal = subtotal,
                total = total,
                deliveryMethod = deliveryMethod,
                paymentMethod = paymentMethod
            )) {
                is Result.Success -> {
                    // Clear cart and refresh orders
                    loadCart()
                    loadOrders()
                    onSuccess()
                }
                is Result.Error -> {
                    _error.value = result.message
                    onError(result.message)
                }
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    // ==================== Wishlist Actions ====================
    
    fun loadWishlist() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            when (val result = repository.getWishlist()) {
                is Result.Success -> {
                    _wishlistItems.value = result.data
                    // Update product IDs set for quick lookup
                    _wishlistProductIds.value = result.data.map { it.id }.toSet()
                }
                is Result.Error -> _error.value = result.message
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    // Add to wishlist with optimistic UI update
    fun addToWishlist(productId: Int) {
        viewModelScope.launch {
            // Optimistic: Add to IDs set immediately for instant UI feedback
            _wishlistProductIds.value = _wishlistProductIds.value + productId
            
            // Find product from cached data to add to list
            val product = _products.value.find { it.id == productId }
                ?: _shopProducts.value.find { it.id == productId }
            product?.let { _wishlistItems.value = _wishlistItems.value + it }
            
            when (val result = repository.addToWishlist(productId)) {
                is Result.Success -> { /* Already updated optimistically */ }
                is Result.Error -> {
                    // Rollback on error
                    _wishlistProductIds.value = _wishlistProductIds.value - productId
                    _wishlistItems.value = _wishlistItems.value.filter { it.id != productId }
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
        }
    }
    
    // Remove from wishlist with optimistic UI update
    fun removeFromWishlist(productId: Int) {
        viewModelScope.launch {
            // Store for potential rollback
            val removedProduct = _wishlistItems.value.find { it.id == productId }
            
            // Optimistic: Remove immediately
            _wishlistProductIds.value = _wishlistProductIds.value - productId
            _wishlistItems.value = _wishlistItems.value.filter { it.id != productId }
            
            when (val result = repository.removeFromWishlist(productId)) {
                is Result.Success -> { /* Already updated optimistically */ }
                is Result.Error -> {
                    // Rollback on error
                    _wishlistProductIds.value = _wishlistProductIds.value + productId
                    removedProduct?.let { _wishlistItems.value = _wishlistItems.value + it }
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
        }
    }
    
    // Check if product is in wishlist (for UI)
    fun isInWishlist(productId: Int): Boolean = productId in _wishlistProductIds.value
    
    // ==================== Order Actions ====================
    
    fun loadOrders(status: String? = null) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            when (val result = repository.getCustomerOrders(status = status)) {
                is Result.Success -> _orders.value = result.data
                is Result.Error -> _error.value = result.message
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    fun loadOrderDetails(orderId: Int) {
        viewModelScope.launch {
            _isLoading.value = true
            
            when (val result = repository.getOrderById(orderId)) {
                is Result.Success -> _selectedOrder.value = result.data
                is Result.Error -> _error.value = result.message
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    // ==================== Booking Actions ====================
    
    fun loadBookings() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            when (val result = repository.getCustomerBookings()) {
                is Result.Success -> _bookings.value = result.data
                is Result.Error -> _error.value = result.message
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    fun loadBookingDetails(bookingId: Int) {
        viewModelScope.launch {
            _isLoading.value = true
            
            when (val result = repository.getBookingById(bookingId)) {
                is Result.Success -> _selectedBooking.value = result.data
                is Result.Error -> _error.value = result.message
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    fun clearError() {
        _error.value = null
    }
    
    fun selectBooking(booking: Booking) {
        _selectedBooking.value = booking
    }
    
    // Create booking matching web's POST /api/bookings
    fun createBooking(
        serviceId: Int,
        bookingDate: String,
        timeSlotLabel: String?,  // Nullable - null for emergency "now" bookings
        serviceLocation: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            
            when (val result = repository.createBooking(serviceId, bookingDate, timeSlotLabel, serviceLocation)) {
                is Result.Success -> {
                    loadBookings() // Refresh bookings list
                    onSuccess()
                }
                is Result.Error -> {
                    _error.value = result.message
                    onError(result.message)
                }
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    // ==================== Profile Actions ====================
    
    // Update profile - matches web's PATCH /api/users/{id}
    fun updateProfile(
        userId: Int,
        request: com.doorstep.tn.core.network.UpdateProfileRequest,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            
            when (val result = repository.updateProfile(userId, request)) {
                is Result.Success -> {
                    onSuccess()
                }
                is Result.Error -> {
                    _error.value = result.message
                    onError(result.message)
                }
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    // ==================== Booking Actions (Customer) ====================
    
    // Cancel booking - matches web's PATCH /api/bookings/{id} with status: "cancelled"
    fun cancelBooking(
        bookingId: Int,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            
            when (val result = repository.cancelBooking(bookingId)) {
                is Result.Success -> {
                    loadBookings() // Refresh bookings list
                    onSuccess()
                }
                is Result.Error -> {
                    _error.value = result.message
                    onError(result.message)
                }
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    // Reschedule booking - matches web's PATCH /api/bookings/{id}
    fun rescheduleBooking(
        bookingId: Int,
        newBookingDate: String,
        comments: String? = null,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            
            when (val result = repository.rescheduleBooking(bookingId, newBookingDate, comments)) {
                is Result.Success -> {
                    loadBookings() // Refresh bookings list
                    onSuccess()
                }
                is Result.Error -> {
                    _error.value = result.message
                    onError(result.message)
                }
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    // Submit service review - matches web's POST /api/reviews
    fun submitReview(
        serviceId: Int,
        rating: Int,
        review: String,
        bookingId: Int,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            
            when (val result = repository.submitReview(serviceId, rating, review, bookingId)) {
                is Result.Success -> {
                    loadBookings() // Refresh to show review status
                    onSuccess()
                }
                is Result.Error -> {
                    _error.value = result.message
                    onError(result.message)
                }
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    // ==================== Reviews Actions (Customer) ====================
    
    // Load customer's reviews - matches web's /api/reviews/customer and /api/product-reviews/customer
    fun loadCustomerReviews() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            // Load service reviews
            when (val result = repository.getCustomerReviews()) {
                is Result.Success -> _customerReviews.value = result.data
                is Result.Error -> _error.value = result.message
                is Result.Loading -> {}
            }
            
            // Load product reviews
            when (val result = repository.getCustomerProductReviews()) {
                is Result.Success -> _customerProductReviews.value = result.data
                is Result.Error -> {
                    // Only show error if we don't already have one
                    if (_error.value == null) _error.value = result.message
                }
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    // Update service review - matches web PATCH /api/reviews/{id}
    fun updateServiceReview(
        reviewId: Int,
        rating: Int? = null,
        review: String? = null,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.updateServiceReview(reviewId, rating, review)) {
                is Result.Success -> {
                    loadCustomerReviews() // Refresh list
                    onSuccess()
                }
                is Result.Error -> onError(result.message)
                is Result.Loading -> {}
            }
            _isLoading.value = false
        }
    }
    
    // Update product review - matches web PATCH /api/product-reviews/{id}
    fun updateProductReview(
        reviewId: Int,
        rating: Int? = null,
        review: String? = null,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.updateProductReview(reviewId, rating, review)) {
                is Result.Success -> {
                    loadCustomerReviews() // Refresh list
                    onSuccess()
                }
                is Result.Error -> onError(result.message)
                is Result.Loading -> {}
            }
            _isLoading.value = false
        }
    }
    
    // Create return request - matches web POST /api/orders/{orderId}/return
    fun createReturnRequest(
        orderId: Int,
        reason: String,
        comments: String? = null,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.createReturnRequest(orderId, reason, comments)) {
                is Result.Success -> onSuccess()
                is Result.Error -> onError(result.message)
                is Result.Loading -> {}
            }
            _isLoading.value = false
        }
    }
    // ==================== Notification Actions ====================
    
    // Load user notifications - matches web GET /api/notifications
    fun loadNotifications() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            when (val result = repository.getNotifications()) {
                is Result.Success -> _notifications.value = result.data
                is Result.Error -> _error.value = result.message
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    // Mark single notification as read
    fun markNotificationRead(notificationId: Int) {
        viewModelScope.launch {
            when (val result = repository.markNotificationRead(notificationId)) {
                is Result.Success -> {
                    // Update local state
                    _notifications.value = _notifications.value.map { notification ->
                        if (notification.id == notificationId) {
                            notification.copy(isRead = true)
                        } else {
                            notification
                        }
                    }
                }
                is Result.Error -> {
                    // Silently fail, notification is still visible
                }
                is Result.Loading -> {}
            }
        }
    }
    
    // Mark all notifications as read
    fun markAllNotificationsRead() {
        viewModelScope.launch {
            when (val result = repository.markAllNotificationsRead()) {
                is Result.Success -> {
                    // Update local state
                    _notifications.value = _notifications.value.map { notification ->
                        notification.copy(isRead = true)
                    }
                }
                is Result.Error -> {
                    // Silently fail
                }
                is Result.Loading -> {}
            }
        }
    }
    
    // Delete notification
    fun deleteNotification(notificationId: Int) {
        viewModelScope.launch {
            when (val result = repository.deleteNotification(notificationId)) {
                is Result.Success -> {
                    // Remove from local state
                    _notifications.value = _notifications.value.filter { it.id != notificationId }
                }
                is Result.Error -> {
                    // Silently fail
                }
                is Result.Loading -> {}
            }
        }
    }
    
    // ==================== Search Actions ====================
    
    // Debounced search - emits to channel which handles 500ms debounce
    fun performSearch(query: String) {
        _searchQuery.value = query
        searchInputChannel.tryEmit(query)
    }
    
    // Internal search called by debounce collector
    private suspend fun performSearchInternal(query: String) {
        _isSearching.value = true
        
        when (val result = repository.globalSearch(query)) {
            is Result.Success -> {
                _searchResults.value = result.data.results
            }
            is Result.Error -> {
                _error.value = result.message
                _searchResults.value = emptyList()
            }
            is Result.Loading -> {}
        }
        
        _isSearching.value = false
    }
    
    // Clear search results
    fun clearSearch() {
        _searchResults.value = emptyList()
        _searchQuery.value = ""
    }
    
    // ==================== Quick Order Actions ====================
    
    // Create text/quick order - matches web POST /api/orders/text
    fun createTextOrder(
        shopId: Int,
        orderText: String,
        deliveryMethod: String = "pickup",
        onSuccess: (orderId: Int) -> Unit,
        onError: (message: String) -> Unit
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            
            when (val result = repository.createTextOrder(shopId, orderText, deliveryMethod)) {
                is Result.Success -> {
                    _quickOrderSuccess.value = result.data.order.id
                    onSuccess(result.data.order.id)
                }
                is Result.Error -> {
                    _error.value = result.message
                    onError(result.message ?: "Failed to create quick order")
                }
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    // Reset quick order success state
    fun resetQuickOrderSuccess() {
        _quickOrderSuccess.value = null
    }
    
    // ==================== Quick Add Product Actions ====================
    
    // Quick add product - matches web POST /api/products/quick-add
    fun quickAddProduct(
        name: String,
        price: String,
        category: String,
        onSuccess: () -> Unit,
        onError: (message: String) -> Unit
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            
            when (val result = repository.quickAddProduct(name, price, category)) {
                is Result.Success -> {
                    onSuccess()
                }
                is Result.Error -> {
                    _error.value = result.message
                    onError(result.message ?: "Failed to add product")
                }
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    // ==================== Order Timeline Actions ====================
    
    private val _orderTimeline = MutableStateFlow<List<com.doorstep.tn.core.network.OrderTimelineEntry>>(emptyList())
    val orderTimeline: StateFlow<List<com.doorstep.tn.core.network.OrderTimelineEntry>> = _orderTimeline.asStateFlow()
    
    // Load order timeline - matches web GET /api/orders/:id/timeline
    fun loadOrderTimeline(orderId: Int) {
        viewModelScope.launch {
            when (val result = repository.getOrderTimeline(orderId)) {
                is Result.Success -> {
                    _orderTimeline.value = result.data
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
        }
    }
    
    // ==================== Product Review Actions ====================
    
    // Submit product review - matches web POST /api/product-reviews
    fun submitProductReview(
        productId: Int,
        orderId: Int,
        rating: Int,
        review: String,
        onSuccess: () -> Unit,
        onError: (message: String) -> Unit
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            
            when (val result = repository.submitProductReview(productId, orderId, rating, review)) {
                is Result.Success -> {
                    onSuccess()
                }
                is Result.Error -> {
                    _error.value = result.message
                    onError(result.message ?: "Failed to submit review")
                }
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
}
