package com.doorstep.tn.auth.data.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Request to check if a user exists by phone number
 */
@JsonClass(generateAdapter = true)
data class CheckUserRequest(
    @Json(name = "phone") val phone: String
)

/**
 * Response from check-user endpoint
 */
@JsonClass(generateAdapter = true)
data class CheckUserResponse(
    @Json(name = "exists") val exists: Boolean,
    @Json(name = "name") val name: String? = null
)

/**
 * Request for PIN login
 */
@JsonClass(generateAdapter = true)
data class LoginPinRequest(
    @Json(name = "phone") val phone: String,
    @Json(name = "pin") val pin: String
)

/**
 * Request for rural registration
 */
@JsonClass(generateAdapter = true)
data class RuralRegisterRequest(
    @Json(name = "firebaseIdToken") val firebaseIdToken: String,
    @Json(name = "name") val name: String,
    @Json(name = "pin") val pin: String,
    @Json(name = "initialRole") val initialRole: String,
    @Json(name = "language") val language: String = "en"
)

/**
 * User response from API
 */
@JsonClass(generateAdapter = true)
data class UserResponse(
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String?,
    @Json(name = "phone") val phone: String?,
    @Json(name = "email") val email: String? = null,
    @Json(name = "role") val role: String?,
    @Json(name = "language") val language: String? = "en",
    @Json(name = "profilePicture") val profilePicture: String? = null,
    @Json(name = "verificationStatus") val verificationStatus: String? = null,
    @Json(name = "hasShopProfile") val hasShopProfile: Boolean? = false,
    @Json(name = "hasProviderProfile") val hasProviderProfile: Boolean? = false
)

/**
 * Request for PIN reset
 */
@JsonClass(generateAdapter = true)
data class ResetPinRequest(
    @Json(name = "firebaseIdToken") val firebaseIdToken: String,
    @Json(name = "newPin") val newPin: String
)
