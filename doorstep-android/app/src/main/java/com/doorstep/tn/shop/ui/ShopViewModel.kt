package com.doorstep.tn.shop.ui

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.doorstep.tn.core.security.SecureUserStore
import com.doorstep.tn.shop.data.model.*
import com.doorstep.tn.shop.data.repository.ShopRepository
import com.doorstep.tn.shop.data.repository.Result
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for Shop screens with comprehensive state management
 */
@HiltViewModel
class ShopViewModel @Inject constructor(
    private val repository: ShopRepository,
    @ApplicationContext private val context: Context
) : ViewModel() {
    
    // ─── Dashboard State ────────────────────────────────────────────────────────
    
    private val _dashboardStats = MutableStateFlow<DashboardStats?>(null)
    val dashboardStats: StateFlow<DashboardStats?> = _dashboardStats.asStateFlow()
    
    private val _recentOrders = MutableStateFlow<List<ShopOrder>>(emptyList())
    val recentOrders: StateFlow<List<ShopOrder>> = _recentOrders.asStateFlow()
    
    private val _shopReviews = MutableStateFlow<List<ShopReview>>(emptyList())
    val shopReviews: StateFlow<List<ShopReview>> = _shopReviews.asStateFlow()
    
    // ─── Orders State ───────────────────────────────────────────────────────────
    
    private val _activeBoard = MutableStateFlow<ActiveBoardResponse?>(null)
    val activeBoard: StateFlow<ActiveBoardResponse?> = _activeBoard.asStateFlow()
    
    private val _orders = MutableStateFlow<List<ShopOrder>>(emptyList())
    val orders: StateFlow<List<ShopOrder>> = _orders.asStateFlow()

    private val _returnRequests = MutableStateFlow<List<ReturnRequest>>(emptyList())
    val returnRequests: StateFlow<List<ReturnRequest>> = _returnRequests.asStateFlow()
    
    // ─── Products State ─────────────────────────────────────────────────────────
    
    private val _products = MutableStateFlow<List<ShopProduct>>(emptyList())
    val products: StateFlow<List<ShopProduct>> = _products.asStateFlow()
    
    // ─── Promotions State ───────────────────────────────────────────────────────
    
    private val _promotions = MutableStateFlow<List<ShopPromotion>>(emptyList())
    val promotions: StateFlow<List<ShopPromotion>> = _promotions.asStateFlow()
    
    // ─── Workers State ──────────────────────────────────────────────────────────
    
    private val _workers = MutableStateFlow<List<ShopWorker>>(emptyList())
    val workers: StateFlow<List<ShopWorker>> = _workers.asStateFlow()
    
    private val _workerResponsibilities = MutableStateFlow<WorkerResponsibilitiesResponse?>(null)
    val workerResponsibilities: StateFlow<WorkerResponsibilitiesResponse?> = _workerResponsibilities.asStateFlow()
    
    // ─── Profile State ──────────────────────────────────────────────────────────
    
    private val _shopProfile = MutableStateFlow<ShopProfile?>(null)
    val shopProfile: StateFlow<ShopProfile?> = _shopProfile.asStateFlow()
    
    // ─── Pay-Later State ────────────────────────────────────────────────────────
    
    private val _payLaterWhitelist = MutableStateFlow<PayLaterWhitelistResponse?>(null)
    val payLaterWhitelist: StateFlow<PayLaterWhitelistResponse?> = _payLaterWhitelist.asStateFlow()
    
    // ─── Loading & Error State ──────────────────────────────────────────────────
    
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()
    
    private val _successMessage = MutableStateFlow<String?>(null)
    val successMessage: StateFlow<String?> = _successMessage.asStateFlow()

    private val activeNewStatuses = setOf("new", "pending", "awaiting_customer_agreement")
    private val activePackingStatuses = setOf("confirmed", "processing", "packing", "packed")
    private val activeReadyStatuses = setOf("ready")
    
    // Store shop ID for review calls
    private var shopId: Int? = null

    init {
        shopId = SecureUserStore.getUserId(context)?.toIntOrNull()
    }
    
    fun setShopId(id: Int) {
        shopId = id
    }
    
    // ─── Dashboard Operations ───────────────────────────────────────────────────
    
    fun loadDashboardData() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null

            try {
                // Load dashboard stats
                when (val result = repository.getDashboardStats()) {
                    is Result.Success -> _dashboardStats.value = result.data
                    is Result.Error -> _error.value = result.message
                }

                // Load recent orders
                when (val result = repository.getRecentOrders()) {
                    is Result.Success -> _recentOrders.value = result.data
                    is Result.Error -> { /* Silent fail for secondary data */ }
                }

                // Load reviews if shopId is set
                shopId?.let { id ->
                    when (val result = repository.getShopReviews(id)) {
                        is Result.Success -> _shopReviews.value = result.data
                        is Result.Error -> { /* Silent fail for secondary data */ }
                    }
                }
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to load dashboard"
            } finally {
                _isLoading.value = false
            }
        }
    }
    
    // ─── Orders Operations ──────────────────────────────────────────────────────
    
    fun loadActiveOrdersBoard() {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.getActiveOrdersBoard()) {
                is Result.Success -> _activeBoard.value = result.data
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }
    
    fun loadOrders(status: String? = null) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.getOrders(status)) {
                is Result.Success -> _orders.value = result.data
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }
    
    fun updateOrderStatus(
        orderId: Int,
        status: String,
        comments: String? = null,
        trackingInfo: String? = null,
        onSuccess: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.updateOrderStatus(orderId, status, comments, trackingInfo)) {
                is Result.Success -> {
                    applyOrderUpdate(result.data)
                    _successMessage.value = "Order status updated"
                    loadActiveOrdersBoard() // Refresh
                    onSuccess()
                }
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }

    private fun applyOrderUpdate(updatedOrder: ShopOrder) {
        _orders.value = updateOrdersList(_orders.value, updatedOrder)
        _activeBoard.value = updateActiveBoardOrder(_activeBoard.value, updatedOrder)
    }

    private fun updateOrdersList(
        current: List<ShopOrder>,
        updatedOrder: ShopOrder
    ): List<ShopOrder> {
        val index = current.indexOfFirst { it.id == updatedOrder.id }
        if (index == -1) {
            return current + updatedOrder
        }
        return current.toMutableList().apply { this[index] = updatedOrder }
    }

    private fun updateActiveBoardOrder(
        board: ActiveBoardResponse?,
        updatedOrder: ShopOrder
    ): ActiveBoardResponse? {
        if (board == null) return board

        val cleanedNew = board.newOrders.filterNot { it.id == updatedOrder.id }
        val cleanedPacking = board.packingOrders.filterNot { it.id == updatedOrder.id }
        val cleanedReady = board.readyOrders.filterNot { it.id == updatedOrder.id }

        val normalizedStatus = updatedOrder.status.lowercase()
        val targetColumn = when {
            activeNewStatuses.contains(normalizedStatus) -> "new"
            activePackingStatuses.contains(normalizedStatus) -> "packing"
            activeReadyStatuses.contains(normalizedStatus) -> "ready"
            else -> null
        }

        val boardOrder = updatedOrder.toActiveBoardOrder()

        return when (targetColumn) {
            "new" -> ActiveBoardResponse(
                new = cleanedNew + boardOrder,
                packing = cleanedPacking,
                ready = cleanedReady
            )
            "packing" -> ActiveBoardResponse(
                new = cleanedNew,
                packing = cleanedPacking + boardOrder,
                ready = cleanedReady
            )
            "ready" -> ActiveBoardResponse(
                new = cleanedNew,
                packing = cleanedPacking,
                ready = cleanedReady + boardOrder
            )
            else -> ActiveBoardResponse(
                new = cleanedNew,
                packing = cleanedPacking,
                ready = cleanedReady
            )
        }
    }

    private fun ShopOrder.toActiveBoardOrder(): ActiveBoardOrder {
        val totalValue = total?.toDoubleOrNull() ?: 0.0
        return ActiveBoardOrder(
            id = id,
            status = status,
            total = totalValue,
            paymentStatus = paymentStatus,
            deliveryMethod = deliveryMethod,
            orderDate = orderDate,
            _customerName = customerName,
            items = items.map {
                ActiveBoardOrderItem(
                    id = it.id,
                    productId = it.productId,
                    name = it.name,
                    quantity = it.quantity
                )
            }
        )
    }

    fun confirmPayment(orderId: Int, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.confirmPayment(orderId)) {
                is Result.Success -> {
                    _successMessage.value = "Payment confirmed"
                    loadOrders()
                    loadActiveOrdersBoard()
                    onSuccess()
                }
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }

    fun approvePayLater(orderId: Int, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.approvePayLater(orderId)) {
                is Result.Success -> {
                    _successMessage.value = "Pay Later approved"
                    loadOrders()
                    loadActiveOrdersBoard()
                    onSuccess()
                }
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }

    fun quoteTextOrder(orderId: Int, total: String, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.quoteTextOrder(orderId, total)) {
                is Result.Success -> {
                    _successMessage.value = "Bill sent to customer"
                    loadOrders()
                    loadActiveOrdersBoard()
                    onSuccess()
                }
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }
    
    // ─── Products Operations ────────────────────────────────────────────────────
    
    fun loadProducts(shopOwnerId: Int? = null) {
        viewModelScope.launch {
            _isLoading.value = true
            val resolvedShopId = shopOwnerId ?: shopId
            if (resolvedShopId == null) {
                _error.value = "Shop ID not set"
                _isLoading.value = false
                return@launch
            }
            when (val result = repository.getProducts(resolvedShopId)) {
                is Result.Success -> _products.value = result.data
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }
    
    fun createProduct(request: CreateProductRequest, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.createProduct(request)) {
                is Result.Success -> {
                    _successMessage.value = "Product created"
                    loadProducts()
                    onSuccess()
                }
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }
    
    fun updateProduct(
        productId: Int,
        request: UpdateProductRequest,
        onSuccess: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.updateProduct(productId, request)) {
                is Result.Success -> {
                    _successMessage.value = "Product updated"
                    loadProducts()
                    onSuccess()
                }
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }
    
    fun deleteProduct(productId: Int, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.deleteProduct(productId)) {
                is Result.Success -> {
                    _successMessage.value = "Product deleted"
                    loadProducts()
                    onSuccess()
                }
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }
    
    fun updateProductStock(
        productId: Int,
        stock: Int,
        isAvailable: Boolean? = null,
        onSuccess: () -> Unit = {}
    ) {
        viewModelScope.launch {
            when (val result = repository.updateProductStock(productId, stock, isAvailable)) {
                is Result.Success -> {
                    _successMessage.value = "Stock updated"
                    loadProducts()
                    onSuccess()
                }
                is Result.Error -> _error.value = result.message
            }
        }
    }
    
    // ─── Promotions Operations ──────────────────────────────────────────────────
    
    fun loadPromotions(shopOwnerId: Int? = null) {
        viewModelScope.launch {
            _isLoading.value = true
            val resolvedShopId = shopOwnerId ?: shopId
            if (resolvedShopId == null) {
                _error.value = "Shop ID not set"
                _isLoading.value = false
                return@launch
            }
            when (val result = repository.getPromotions(resolvedShopId)) {
                is Result.Success -> _promotions.value = result.data
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }
    
    fun createPromotion(request: CreatePromotionRequest, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.createPromotion(request)) {
                is Result.Success -> {
                    _successMessage.value = "Promotion created"
                    loadPromotions()
                    onSuccess()
                }
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }
    
    fun updatePromotion(
        promotionId: Int,
        request: UpdatePromotionRequest,
        onSuccess: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.updatePromotion(promotionId, request)) {
                is Result.Success -> {
                    _successMessage.value = "Promotion updated"
                    loadPromotions()
                    onSuccess()
                }
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }
    
    fun togglePromotionStatus(promotionId: Int, isActive: Boolean) {
        viewModelScope.launch {
            when (val result = repository.togglePromotionStatus(promotionId, isActive)) {
                is Result.Success -> {
                    _successMessage.value = if (isActive) "Promotion activated" else "Promotion deactivated"
                    loadPromotions()
                }
                is Result.Error -> _error.value = result.message
            }
        }
    }
    
    fun deletePromotion(promotionId: Int, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.deletePromotion(promotionId)) {
                is Result.Success -> {
                    _successMessage.value = "Promotion deleted"
                    loadPromotions()
                    onSuccess()
                }
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }
    
    // ─── Workers Operations ─────────────────────────────────────────────────────
    
    fun loadWorkers() {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.getWorkers()) {
                is Result.Success -> _workers.value = result.data
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }

    suspend fun checkWorkerNumber(workerNumber: String): Result<Map<String, Any>> {
        return repository.checkWorkerNumber(workerNumber)
    }
    
    fun loadWorkerResponsibilities() {
        viewModelScope.launch {
            when (val result = repository.getWorkerResponsibilities()) {
                is Result.Success -> _workerResponsibilities.value = result.data
                is Result.Error -> { /* Silent fail */ }
            }
        }
    }
    
    fun addWorker(request: AddWorkerRequest, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.addWorker(request)) {
                is Result.Success -> {
                    _successMessage.value = "Worker added"
                    loadWorkers()
                    onSuccess()
                }
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }
    
    fun updateWorker(
        workerUserId: Int,
        request: UpdateWorkerRequest,
        onSuccess: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.updateWorker(workerUserId, request)) {
                is Result.Success -> {
                    _successMessage.value = "Worker updated"
                    loadWorkers()
                    onSuccess()
                }
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }
    
    fun toggleWorkerStatus(workerUserId: Int, active: Boolean) {
        viewModelScope.launch {
            when (val result = repository.toggleWorkerStatus(workerUserId, active)) {
                is Result.Success -> {
                    _successMessage.value = if (active) "Worker activated" else "Worker deactivated"
                    loadWorkers()
                }
                is Result.Error -> _error.value = result.message
            }
        }
    }
    
    fun removeWorker(workerUserId: Int, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.removeWorker(workerUserId)) {
                is Result.Success -> {
                    _successMessage.value = "Worker removed"
                    loadWorkers()
                    onSuccess()
                }
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }
    
    // ─── Reviews Operations ─────────────────────────────────────────────────────
    
    fun loadReviews() {
        viewModelScope.launch {
            _isLoading.value = true
            shopId?.let { id ->
                when (val result = repository.getShopReviews(id)) {
                    is Result.Success -> _shopReviews.value = result.data
                    is Result.Error -> _error.value = result.message
                }
            } ?: run {
                _error.value = "Shop ID not set"
            }
            _isLoading.value = false
        }
    }
    
    fun replyToReview(reviewId: Int, reply: String, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.replyToReview(reviewId, reply)) {
                is Result.Success -> {
                    _successMessage.value = "Reply posted"
                    loadReviews()
                    onSuccess()
                }
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }
    
    // ─── Profile Operations ─────────────────────────────────────────────────────
    
    fun loadShopProfile() {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.getShopProfile()) {
                is Result.Success -> {
                    _shopProfile.value = result.data
                    shopId = result.data.ownerId ?: result.data.id
                }
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }
    
    fun updateShopProfile(
        userId: Int,
        request: UpdateShopProfileRequest,
        onSuccess: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.updateShopProfile(userId, request)) {
                is Result.Success -> {
                    _successMessage.value = "Profile updated"
                    _shopProfile.value = result.data
                    shopId = result.data.ownerId ?: result.data.id
                    onSuccess()
                }
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }

    // ─── Account Operations ────────────────────────────────────────────────────

    fun deleteAccount(
        onSuccess: () -> Unit = {},
        onError: (String) -> Unit = {}
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.deleteAccount()) {
                is Result.Success -> {
                    _successMessage.value = "Account deleted"
                    onSuccess()
                }
                is Result.Error -> {
                    _error.value = result.message
                    onError(result.message)
                }
            }
            _isLoading.value = false
        }
    }
    
    // ─── Pay-Later Operations ───────────────────────────────────────────────────
    
    fun loadPayLaterWhitelist() {
        viewModelScope.launch {
            when (val result = repository.getPayLaterWhitelist()) {
                is Result.Success -> _payLaterWhitelist.value = result.data
                is Result.Error -> _error.value = result.message
            }
        }
    }
    
    fun addToPayLaterWhitelist(phone: String, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            when (val result = repository.addToPayLaterWhitelist(phone)) {
                is Result.Success -> {
                    _successMessage.value = "Customer added to pay-later"
                    loadPayLaterWhitelist()
                    onSuccess()
                }
                is Result.Error -> _error.value = result.message
            }
        }
    }
    
    fun removeFromPayLaterWhitelist(customerId: Int) {
        viewModelScope.launch {
            when (val result = repository.removeFromPayLaterWhitelist(customerId)) {
                is Result.Success -> {
                    _successMessage.value = "Customer removed from pay-later"
                    loadPayLaterWhitelist()
                }
                is Result.Error -> _error.value = result.message
            }
        }
    }

    // ─── Returns Operations ───────────────────────────────────────────────────

    fun loadReturnRequests() {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.getReturnRequests()) {
                is Result.Success -> _returnRequests.value = result.data
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }

    fun approveReturnRequest(returnId: Int, comments: String? = null, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.approveReturnRequest(returnId, comments)) {
                is Result.Success -> {
                    _successMessage.value = "Return approved"
                    loadReturnRequests()
                    onSuccess()
                }
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }

    fun rejectReturnRequest(returnId: Int, comments: String? = null, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.rejectReturnRequest(returnId, comments)) {
                is Result.Success -> {
                    _successMessage.value = "Return rejected"
                    loadReturnRequests()
                    onSuccess()
                }
                is Result.Error -> _error.value = result.message
            }
            _isLoading.value = false
        }
    }
    
    // ─── Utility Functions ──────────────────────────────────────────────────────
    
    fun clearError() {
        _error.value = null
    }
    
    fun clearSuccessMessage() {
        _successMessage.value = null
    }
}
