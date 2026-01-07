package com.doorstep.tn.customer.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.doorstep.tn.auth.data.repository.Result
import com.doorstep.tn.customer.data.model.*
import com.doorstep.tn.customer.data.repository.CustomerRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for customer screens
 */
@HiltViewModel
class CustomerViewModel @Inject constructor(
    private val repository: CustomerRepository
) : ViewModel() {
    
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
    
    // Search
    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()
    
    private val _selectedCategory = MutableStateFlow<String?>(null)
    val selectedCategory: StateFlow<String?> = _selectedCategory.asStateFlow()
    
    // ==================== Product Actions ====================
    
    fun loadProducts(search: String? = null, category: String? = null) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            when (val result = repository.getProducts(search, category)) {
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
    
    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
    }
    
    fun updateCategory(category: String?) {
        _selectedCategory.value = category
        loadProducts(category = category)
    }
    
    // ==================== Service Actions ====================
    
    fun loadServices(category: String? = null) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            when (val result = repository.getServices(category)) {
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
    
    fun loadShops(search: String? = null) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            when (val result = repository.getShops(search = search)) {
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
    fun updateCartQuantity(productId: Int, newQuantity: Int) {
        viewModelScope.launch {
            if (newQuantity <= 0) {
                removeFromCart(productId)
            } else {
                when (val result = repository.addToCart(productId, newQuantity)) {
                    is Result.Success -> loadCart()
                    is Result.Error -> _error.value = result.message
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
                is Result.Success -> _wishlistItems.value = result.data
                is Result.Error -> _error.value = result.message
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    fun addToWishlist(productId: Int) {
        viewModelScope.launch {
            when (val result = repository.addToWishlist(productId)) {
                is Result.Success -> loadWishlist()
                is Result.Error -> _error.value = result.message
                is Result.Loading -> {}
            }
        }
    }
    
    fun removeFromWishlist(productId: Int) {
        viewModelScope.launch {
            when (val result = repository.removeFromWishlist(productId)) {
                is Result.Success -> loadWishlist()
                is Result.Error -> _error.value = result.message
                is Result.Loading -> {}
            }
        }
    }
    
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
        timeSlotLabel: String,
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
}
