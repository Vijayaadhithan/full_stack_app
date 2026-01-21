package com.doorstep.tn.provider.ui

import android.content.Context
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.doorstep.tn.provider.data.model.*
import com.doorstep.tn.provider.data.repository.ProviderRepository
import com.doorstep.tn.provider.data.repository.Result
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject
import com.doorstep.tn.core.datastore.dataStore
import com.doorstep.tn.core.datastore.PreferenceKeys

/**
 * ViewModel for Provider screens
 */
@HiltViewModel
class ProviderViewModel @Inject constructor(
    private val repository: ProviderRepository,
    @ApplicationContext private val context: Context
) : ViewModel() {
    
    // User ID from DataStore
    private var currentUserId: Int? = null
    
    // ─── UI State ────────────────────────────────────────────────────────────
    
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()
    
    private val _successMessage = MutableStateFlow<String?>(null)
    val successMessage: StateFlow<String?> = _successMessage.asStateFlow()
    
    // ─── Provider Availability ───────────────────────────────────────────────
    
    private val _isAvailable = MutableStateFlow(true)
    val isAvailable: StateFlow<Boolean> = _isAvailable.asStateFlow()
    
    // ─── Pending Bookings ────────────────────────────────────────────────────
    
    private val _pendingBookings = MutableStateFlow<List<ProviderBooking>>(emptyList())
    val pendingBookings: StateFlow<List<ProviderBooking>> = _pendingBookings.asStateFlow()
    
    private val _isLoadingPendingBookings = MutableStateFlow(false)
    val isLoadingPendingBookings: StateFlow<Boolean> = _isLoadingPendingBookings.asStateFlow()
    
    // ─── All Bookings ────────────────────────────────────────────────────────
    
    private val _bookings = MutableStateFlow<List<ProviderBooking>>(emptyList())
    val bookings: StateFlow<List<ProviderBooking>> = _bookings.asStateFlow()
    
    private val _isLoadingBookings = MutableStateFlow(false)
    val isLoadingBookings: StateFlow<Boolean> = _isLoadingBookings.asStateFlow()

    private val _bookingHistory = MutableStateFlow<List<ProviderBooking>>(emptyList())
    val bookingHistory: StateFlow<List<ProviderBooking>> = _bookingHistory.asStateFlow()

    private val _isLoadingBookingHistory = MutableStateFlow(false)
    val isLoadingBookingHistory: StateFlow<Boolean> = _isLoadingBookingHistory.asStateFlow()
    
    // ─── Services ────────────────────────────────────────────────────────────
    
    private val _services = MutableStateFlow<List<ProviderService>>(emptyList())
    val services: StateFlow<List<ProviderService>> = _services.asStateFlow()
    
    private val _isLoadingServices = MutableStateFlow(false)
    val isLoadingServices: StateFlow<Boolean> = _isLoadingServices.asStateFlow()

    // ─── Reviews ─────────────────────────────────────────────────────────────

    private val _reviews = MutableStateFlow<List<com.doorstep.tn.core.network.ServiceReview>>(emptyList())
    val reviews: StateFlow<List<com.doorstep.tn.core.network.ServiceReview>> = _reviews.asStateFlow()

    private val _isLoadingReviews = MutableStateFlow(false)
    val isLoadingReviews: StateFlow<Boolean> = _isLoadingReviews.asStateFlow()
    
    // ─── Stats ───────────────────────────────────────────────────────────────
    
    private val _stats = MutableStateFlow(ProviderStats())
    val stats: StateFlow<ProviderStats> = _stats.asStateFlow()
    
    // ─── Init ────────────────────────────────────────────────────────────────
    
    init {
        viewModelScope.launch {
            // Load user ID from DataStore (stored as String, convert to Int)
            currentUserId = context.dataStore.data.map { prefs ->
                prefs[PreferenceKeys.USER_ID]?.toIntOrNull()
            }.first()
            
            loadDashboardData()
        }
    }
    
    fun loadDashboardData() {
        loadPendingBookings()
        loadProviderServices()
        loadAllBookings()
        loadProviderReviews()
        loadBookingHistory()
    }
    
    // ─── Availability ────────────────────────────────────────────────────────
    
    fun toggleAvailability() {
        setAvailability(!_isAvailable.value)
    }

    fun setAvailability(isAvailable: Boolean, note: String? = null) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.updateProviderAvailability(isAvailable, note)) {
                is Result.Success -> {
                    _services.value = result.data.services
                    _isAvailable.value = result.data.services.any { it.isAvailableNow != false }
                    _successMessage.value = if (isAvailable) "You're now online" else "You're now offline"
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
            _isLoading.value = false
        }
    }
    
    // ─── Pending Bookings ────────────────────────────────────────────────────
    
    fun loadPendingBookings() {
        viewModelScope.launch {
            _isLoadingPendingBookings.value = true
            _error.value = null
            
            when (val result = repository.getPendingBookings()) {
                is Result.Success -> {
                    _pendingBookings.value = result.data
                    // Update pending bookings count in stats
                    _stats.value = _stats.value.copy(pendingBookings = result.data.size)
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
            
            _isLoadingPendingBookings.value = false
        }
    }
    
    fun acceptBooking(bookingId: Int, comments: String? = null) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.acceptBooking(bookingId, comments)) {
                is Result.Success -> {
                    _successMessage.value = "Booking accepted"
                    loadPendingBookings() // Refresh pending list
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
            _isLoading.value = false
        }
    }
    
    fun rejectBooking(bookingId: Int, comments: String? = null) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.rejectBooking(bookingId, comments)) {
                is Result.Success -> {
                    _successMessage.value = "Booking rejected"
                    loadPendingBookings() // Refresh pending list
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
            _isLoading.value = false
        }
    }
    
    fun completeBooking(bookingId: Int, comments: String? = null) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.completeBooking(bookingId, comments)) {
                is Result.Success -> {
                    _successMessage.value = "Booking marked as completed"
                    loadAllBookings() // Refresh bookings list
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
            _isLoading.value = false
        }
    }
    
    // ─── All Bookings ────────────────────────────────────────────────────────
    
    fun loadAllBookings(status: String? = null) {
        viewModelScope.launch {
            _isLoadingBookings.value = true
            _error.value = null
            
            when (val result = repository.getProviderBookings(status)) {
                is Result.Success -> {
                    _bookings.value = result.data
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
            
            _isLoadingBookings.value = false
        }
    }

    fun loadBookingHistory() {
        viewModelScope.launch {
            _isLoadingBookingHistory.value = true
            _error.value = null

            when (val result = repository.getProviderBookingHistory()) {
                is Result.Success -> {
                    _bookingHistory.value = result.data
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }

            _isLoadingBookingHistory.value = false
        }
    }
    
    // ─── Services ────────────────────────────────────────────────────────────
    
    fun loadProviderServices() {
        val providerId = currentUserId
        if (providerId == null) {
            _error.value = "User not logged in"
            return
        }
        
        viewModelScope.launch {
            _isLoadingServices.value = true
            _error.value = null
            
            when (val result = repository.getProviderServices(providerId)) {
                is Result.Success -> {
                    _services.value = result.data
                    _isAvailable.value = result.data.any { it.isAvailableNow != false }
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
            
            _isLoadingServices.value = false
        }
    }

    fun loadProviderReviews() {
        val providerId = currentUserId
        if (providerId == null) {
            _error.value = "User not logged in"
            return
        }

        viewModelScope.launch {
            _isLoadingReviews.value = true
            _error.value = null

            when (val result = repository.getProviderReviews(providerId)) {
                is Result.Success -> {
                    _reviews.value = result.data
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }

            _isLoadingReviews.value = false
        }
    }

    fun replyToReview(reviewId: Int, responseText: String) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.replyToReview(reviewId, responseText)) {
                is Result.Success -> {
                    _successMessage.value = "Reply sent"
                    loadProviderReviews()
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
            _isLoading.value = false
        }
    }

    fun rescheduleBooking(bookingId: Int, rescheduleDateIso: String, comments: String? = null) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.rescheduleBooking(bookingId, rescheduleDateIso, comments)) {
                is Result.Success -> {
                    _successMessage.value = "Booking rescheduled"
                    loadPendingBookings()
                    loadAllBookings()
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
            _isLoading.value = false
        }
    }

    fun markEnRoute(bookingId: Int) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.markEnRoute(bookingId)) {
                is Result.Success -> {
                    _successMessage.value = "Marked as en route"
                    loadAllBookings()
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
            _isLoading.value = false
        }
    }

    fun confirmPayment(bookingId: Int) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.completeBooking(bookingId)) {
                is Result.Success -> {
                    _successMessage.value = "Payment confirmed"
                    loadAllBookings()
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
            _isLoading.value = false
        }
    }

    fun reportDispute(bookingId: Int, reason: String) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.reportDispute(bookingId, reason)) {
                is Result.Success -> {
                    _successMessage.value = "Issue reported"
                    loadAllBookings()
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
            _isLoading.value = false
        }
    }
    
    fun createService(request: CreateServiceRequest, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.createService(request)) {
                is Result.Success -> {
                    _successMessage.value = "Service created successfully"
                    loadProviderServices() // Refresh services list
                    onSuccess()
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
            _isLoading.value = false
        }
    }
    
    fun updateService(serviceId: Int, request: UpdateServiceRequest, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.updateService(serviceId, request)) {
                is Result.Success -> {
                    _successMessage.value = "Service updated successfully"
                    loadProviderServices() // Refresh services list
                    onSuccess()
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
            _isLoading.value = false
        }
    }
    
    fun deleteService(serviceId: Int) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.deleteService(serviceId)) {
                is Result.Success -> {
                    _successMessage.value = "Service deleted successfully"
                    loadProviderServices() // Refresh services list
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
            _isLoading.value = false
        }
    }
    
    fun toggleServiceAvailability(serviceId: Int, isAvailable: Boolean) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.toggleServiceAvailability(serviceId, isAvailable)) {
                is Result.Success -> {
                    _successMessage.value = if (isAvailable) "Service is now available" else "Service is now unavailable"
                    loadProviderServices() // Refresh services list
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
            _isLoading.value = false
        }
    }
    
    // ─── Helpers ─────────────────────────────────────────────────────────────
    
    fun clearError() {
        _error.value = null
    }
    
    fun clearSuccessMessage() {
        _successMessage.value = null
    }
}
