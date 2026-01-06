package com.doorstep.tn.auth.ui

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.doorstep.tn.auth.data.model.UserResponse
import com.doorstep.tn.auth.data.repository.AuthRepository
import com.doorstep.tn.auth.data.repository.Result
import com.doorstep.tn.core.datastore.PreferenceKeys
import com.doorstep.tn.core.datastore.dataStore
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.concurrent.TimeUnit
import javax.inject.Inject

/**
 * ViewModel for authentication screens
 */
@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    @ApplicationContext private val context: Context
) : ViewModel() {
    
    private val firebaseAuth = FirebaseAuth.getInstance()
    
    // UI State
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()
    
    private val _isLoggedIn = MutableStateFlow(false)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()
    
    private val _userRole = MutableStateFlow<String?>(null)
    val userRole: StateFlow<String?> = _userRole.asStateFlow()
    
    private val _userName = MutableStateFlow<String?>(null)
    val userName: StateFlow<String?> = _userName.asStateFlow()
    
    // Form State
    private val _phone = MutableStateFlow("")
    val phone: StateFlow<String> = _phone.asStateFlow()
    
    private val _otp = MutableStateFlow("")
    val otp: StateFlow<String> = _otp.asStateFlow()
    
    private val _pin = MutableStateFlow("")
    val pin: StateFlow<String> = _pin.asStateFlow()
    
    private val _confirmPin = MutableStateFlow("")
    val confirmPin: StateFlow<String> = _confirmPin.asStateFlow()
    
    private val _name = MutableStateFlow("")
    val name: StateFlow<String> = _name.asStateFlow()
    
    private val _selectedRole = MutableStateFlow("customer")
    val selectedRole: StateFlow<String> = _selectedRole.asStateFlow()
    
    private val _language = MutableStateFlow("en")
    val language: StateFlow<String> = _language.asStateFlow()
    
    // OTP Verification
    private var verificationId: String? = null
    private var firebaseIdToken: String? = null
    
    // User exists check result
    private val _userExists = MutableStateFlow(false)
    val userExists: StateFlow<Boolean> = _userExists.asStateFlow()
    
    private val _existingUserName = MutableStateFlow<String?>(null)
    val existingUserName: StateFlow<String?> = _existingUserName.asStateFlow()
    
    init {
        // Check if user is already logged in
        viewModelScope.launch {
            val prefs = context.dataStore.data.first()
            _isLoggedIn.value = prefs[PreferenceKeys.IS_LOGGED_IN] ?: false
            _userRole.value = prefs[PreferenceKeys.USER_ROLE]
            _userName.value = prefs[PreferenceKeys.USER_NAME]
            _language.value = prefs[PreferenceKeys.LANGUAGE] ?: "en"
            
            // Load last used phone number
            prefs[PreferenceKeys.LAST_PHONE]?.let {
                _phone.value = it
            }
        }
    }
    
    // ==================== Form Updates ====================
    
    fun updatePhone(value: String) {
        _phone.value = value.filter { it.isDigit() }.take(10)
    }
    
    fun updateOtp(value: String) {
        _otp.value = value.filter { it.isDigit() }.take(6)
    }
    
    fun updatePin(value: String) {
        _pin.value = value.filter { it.isDigit() }.take(4)
    }
    
    fun updateConfirmPin(value: String) {
        _confirmPin.value = value.filter { it.isDigit() }.take(4)
    }
    
    fun updateName(value: String) {
        _name.value = value
    }
    
    fun updateSelectedRole(role: String) {
        _selectedRole.value = role
    }
    
    fun toggleLanguage() {
        _language.value = if (_language.value == "en") "ta" else "en"
        viewModelScope.launch {
            context.dataStore.edit { prefs ->
                prefs[PreferenceKeys.LANGUAGE] = _language.value
            }
        }
    }
    
    fun clearError() {
        _error.value = null
    }
    
    // ==================== Auth Actions ====================
    
    /**
     * Check if user exists by phone number
     */
    fun checkUser(onExistingUser: () -> Unit, onNewUser: () -> Unit) {
        if (_phone.value.length != 10) {
            _error.value = "Please enter a valid 10-digit phone number"
            return
        }
        
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            // Save last phone
            context.dataStore.edit { prefs ->
                prefs[PreferenceKeys.LAST_PHONE] = _phone.value
            }
            
            when (val result = authRepository.checkUser(_phone.value)) {
                is Result.Success -> {
                    _userExists.value = result.data.exists
                    _existingUserName.value = result.data.name
                    
                    if (result.data.exists) {
                        onExistingUser()
                    } else {
                        // New user - need to send OTP
                        sendOtp(onSuccess = onNewUser)
                    }
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    /**
     * Send OTP via Firebase
     */
    private fun sendOtp(onSuccess: () -> Unit) {
        // For now, we'll simulate OTP. In production, use PhoneAuthProvider
        // This would require Activity reference for reCAPTCHA
        viewModelScope.launch {
            // Simulating OTP sent - in production, implement Firebase Phone Auth
            _error.value = "OTP feature requires Firebase configuration. Please set up google-services.json"
            // onSuccess() // Call this after OTP is sent
        }
    }
    
    /**
     * Verify OTP entered by user
     */
    fun verifyOtp(onSuccess: () -> Unit) {
        if (_otp.value.length != 6) {
            _error.value = "Please enter a valid 6-digit OTP"
            return
        }
        
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            try {
                // Verify OTP with Firebase and get ID token
                // In production, use PhoneAuthCredential
                verificationId?.let { verId ->
                    val credential = PhoneAuthProvider.getCredential(verId, _otp.value)
                    val authResult = firebaseAuth.signInWithCredential(credential).await()
                    firebaseIdToken = authResult.user?.getIdToken(true)?.await()?.token
                    onSuccess()
                } ?: run {
                    _error.value = "OTP session expired. Please request a new OTP."
                }
            } catch (e: Exception) {
                _error.value = e.message ?: "OTP verification failed"
            }
            
            _isLoading.value = false
        }
    }
    
    /**
     * Login with PIN (existing user)
     */
    fun loginWithPin(onSuccess: (String) -> Unit) {
        if (_pin.value.length != 4) {
            _error.value = "Please enter a valid 4-digit PIN"
            return
        }
        
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            when (val result = authRepository.loginWithPin(_phone.value, _pin.value)) {
                is Result.Success -> {
                    saveUserSession(result.data)
                    onSuccess(result.data.role ?: "customer")
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    /**
     * Complete registration (new user)
     */
    fun completeRegistration(onSuccess: (String) -> Unit) {
        if (_pin.value.length != 4) {
            _error.value = "Please enter a valid 4-digit PIN"
            return
        }
        
        if (_pin.value != _confirmPin.value) {
            _error.value = "PINs do not match"
            return
        }
        
        if (_name.value.isBlank()) {
            _error.value = "Please enter your name"
            return
        }
        
        val token = firebaseIdToken
        if (token == null) {
            _error.value = "Session expired. Please verify your phone again."
            return
        }
        
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            when (val result = authRepository.ruralRegister(
                firebaseIdToken = token,
                name = _name.value.trim(),
                pin = _pin.value,
                role = _selectedRole.value,
                language = _language.value
            )) {
                is Result.Success -> {
                    saveUserSession(result.data)
                    onSuccess(result.data.role ?: "customer")
                }
                is Result.Error -> {
                    _error.value = result.message
                }
                is Result.Loading -> {}
            }
            
            _isLoading.value = false
        }
    }
    
    /**
     * Logout user
     */
    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            firebaseAuth.signOut()
            
            context.dataStore.edit { prefs ->
                prefs[PreferenceKeys.IS_LOGGED_IN] = false
                prefs.remove(PreferenceKeys.USER_ID)
                prefs.remove(PreferenceKeys.USER_NAME)
                prefs.remove(PreferenceKeys.USER_ROLE)
                prefs.remove(PreferenceKeys.USER_PHONE)
            }
            
            _isLoggedIn.value = false
            _userRole.value = null
            _userName.value = null
            
            // Clear form
            _pin.value = ""
            _confirmPin.value = ""
            _otp.value = ""
            _name.value = ""
        }
    }
    
    // ==================== Private Helpers ====================
    
    private suspend fun saveUserSession(user: UserResponse) {
        context.dataStore.edit { prefs ->
            prefs[PreferenceKeys.IS_LOGGED_IN] = true
            prefs[PreferenceKeys.USER_ID] = user.id.toString()
            prefs[PreferenceKeys.USER_NAME] = user.name ?: ""
            prefs[PreferenceKeys.USER_ROLE] = user.role ?: "customer"
            prefs[PreferenceKeys.USER_PHONE] = user.phone ?: ""
        }
        
        _isLoggedIn.value = true
        _userRole.value = user.role
        _userName.value = user.name
    }
}
