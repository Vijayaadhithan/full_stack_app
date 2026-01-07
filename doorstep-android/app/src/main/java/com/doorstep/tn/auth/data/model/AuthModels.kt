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
    @Json(name = "profileCompleteness") val profileCompleteness: Int? = null,
    @Json(name = "hasShopProfile") val hasShopProfile: Boolean? = false,
    @Json(name = "hasProviderProfile") val hasProviderProfile: Boolean? = false,
    @Json(name = "upiId") val upiId: String? = null,
    @Json(name = "addressStreet") val addressStreet: String? = null,
    @Json(name = "addressCity") val addressCity: String? = null,
    @Json(name = "addressState") val addressState: String? = null,
    @Json(name = "addressPostalCode") val addressPostalCode: String? = null,
    @Json(name = "addressCountry") val addressCountry: String? = null,
    @Json(name = "addressLandmark") val addressLandmark: String? = null,
    @Json(name = "latitude") val latitude: String? = null,
    @Json(name = "longitude") val longitude: String? = null
)

/**
 * Request for PIN reset
 */
@JsonClass(generateAdapter = true)
data class ResetPinRequest(
    @Json(name = "firebaseIdToken") val firebaseIdToken: String,
    @Json(name = "newPin") val newPin: String
)
