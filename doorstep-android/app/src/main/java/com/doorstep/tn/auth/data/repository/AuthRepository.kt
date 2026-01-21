package com.doorstep.tn.auth.data.repository

import com.doorstep.tn.auth.data.model.CheckUserRequest
import com.doorstep.tn.auth.data.model.CheckUserResponse
import com.doorstep.tn.auth.data.model.CreateProviderRequest
import com.doorstep.tn.auth.data.model.CreateProviderResponse
import com.doorstep.tn.auth.data.model.CreateShopRequest
import com.doorstep.tn.auth.data.model.CreateShopResponse
import com.doorstep.tn.auth.data.model.LoginPinRequest
import com.doorstep.tn.auth.data.model.ResetPinRequest
import com.doorstep.tn.auth.data.model.RuralRegisterRequest
import com.doorstep.tn.auth.data.model.UserResponse
import com.doorstep.tn.auth.data.model.AuthProfilesResponse
import com.doorstep.tn.core.network.DoorStepApi
import com.doorstep.tn.core.network.FcmTokenRequest
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Result wrapper for API calls
 */
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String, val code: Int? = null) : Result<Nothing>()
    object Loading : Result<Nothing>()
}

/**
 * Repository for authentication operations
 */
@Singleton
class AuthRepository @Inject constructor(
    private val api: DoorStepApi
) {
    
    /**
     * Check if a user exists by phone number
     */
    suspend fun checkUser(phone: String): Result<CheckUserResponse> {
        return try {
            val response = api.checkUser(CheckUserRequest(phone))
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }
    
    /**
     * Login with phone and PIN
     */
    suspend fun loginWithPin(phone: String, pin: String): Result<UserResponse> {
        return try {
            val response = api.loginWithPin(LoginPinRequest(phone, pin))
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                val errorMessage = when (response.code()) {
                    401 -> "Invalid PIN"
                    404 -> "User not found"
                    else -> response.message()
                }
                Result.Error(errorMessage, response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }
    
    /**
     * Register a new user with Firebase token
     */
    suspend fun ruralRegister(
        firebaseIdToken: String,
        name: String,
        pin: String,
        role: String,
        language: String = "en"
    ): Result<UserResponse> {
        return try {
            val response = api.ruralRegister(
                RuralRegisterRequest(
                    firebaseIdToken = firebaseIdToken,
                    name = name,
                    pin = pin,
                    initialRole = role,
                    language = language
                )
            )
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Registration failed")
        }
    }
    
    /**
     * Get current logged in user
     */
    suspend fun getCurrentUser(): Result<UserResponse> {
        return try {
            val response = api.getCurrentUser()
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("Not logged in", response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }
    
    /**
     * Logout user
     */
    suspend fun logout(): Result<Unit> {
        return try {
            api.logout()
            Result.Success(Unit)
        } catch (e: Exception) {
            // Even if logout fails on server, we clear local state
            Result.Success(Unit)
        }
    }
    
    /**
     * Update user role - for role switching functionality
     * Uses existing PATCH /api/users/{id} endpoint
     */
    suspend fun updateUserRole(userId: Int, newRole: String): Result<Unit> {
        return try {
            val response = api.updateUserProfile(userId, mapOf("role" to newRole))
            if (response.isSuccessful) {
                Result.Success(Unit)
            } else {
                Result.Error("Failed to update role", response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to update role")
        }
    }
    
    /**
     * Reset PIN using Firebase ID token
     */
    suspend fun resetPin(firebaseIdToken: String, newPin: String): Result<Unit> {
        return try {
            val response = api.resetPin(ResetPinRequest(firebaseIdToken, newPin))
            if (response.isSuccessful) {
                Result.Success(Unit)
            } else {
                val errorMessage = when (response.code()) {
                    401 -> "Session expired. Please verify your phone again."
                    404 -> "User not found"
                    else -> response.message()
                }
                Result.Error(errorMessage, response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to reset PIN")
        }
    }

    /**
     * Fetch shop/provider profile status for role switching
     */
    suspend fun getAuthProfiles(): Result<AuthProfilesResponse> {
        return try {
            val response = api.getAuthProfiles()
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("Failed to fetch profiles", response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to fetch profiles")
        }
    }

    /**
     * Create a shop profile for the current user
     */
    suspend fun createShopProfile(
        shopName: String,
        description: String? = null
    ): Result<CreateShopResponse> {
        return try {
            val response = api.createShopProfile(
                CreateShopRequest(
                    shopName = shopName,
                    description = description
                )
            )
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to create shop profile")
        }
    }

    /**
     * Create a provider profile for the current user
     */
    suspend fun createProviderProfile(
        bio: String? = null
    ): Result<CreateProviderResponse> {
        return try {
            val response = api.createProviderProfile(CreateProviderRequest(bio = bio))
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to create provider profile")
        }
    }
    
    /**
     * Register FCM token for push notifications
     */
    suspend fun registerFcmToken(
        token: String,
        platform: String,
        deviceInfo: String
    ): Result<Unit> {
        return try {
            val response = api.registerFcmToken(
                FcmTokenRequest(
                    token = token,
                    platform = platform,
                    deviceInfo = deviceInfo
                )
            )
            if (response.isSuccessful) {
                Result.Success(Unit)
            } else {
                Result.Error("Failed to register FCM token", response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to register FCM token")
        }
    }
}
