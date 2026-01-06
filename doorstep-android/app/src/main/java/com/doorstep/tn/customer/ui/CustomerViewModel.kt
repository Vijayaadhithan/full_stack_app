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
    
    // Cart
    private val _cartItems = MutableStateFlow<List<CartItem>>(emptyList())
    val cartItems: StateFlow<List<CartItem>> = _cartItems.asStateFlow()
    
    val cartCount: Int get() = _cartItems.value.sumOf { it.quantity }
    val cartTotal: Double get() = _cartItems.value.sumOf { 
        (it.product?.price?.toDoubleOrNull() ?: 0.0) * it.quantity 
    }
    
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
            
            when (val result = repository.getProductById(productId)) {
                is Result.Success -> _selectedProduct.value = result.data
                is Result.Error -> _error.value = result.message
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
            
            when (val result = repository.getServiceById(serviceId)) {
                is Result.Success -> _selectedService.value = result.data
                is Result.Error -> _error.value = result.message
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
    
    fun removeFromCart(itemId: Int) {
        viewModelScope.launch {
            when (val result = repository.removeFromCart(itemId)) {
                is Result.Success -> loadCart() // Refresh cart
                is Result.Error -> _error.value = result.message
                is Result.Loading -> {}
            }
        }
    }
    
    // ==================== Order Actions ====================
    
    fun loadOrders() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            when (val result = repository.getCustomerOrders()) {
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
}
