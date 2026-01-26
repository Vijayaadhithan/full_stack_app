package com.doorstep.tn.common.util

import android.annotation.SuppressLint
import android.content.Context
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlin.math.pow

data class GeoPoint(
    val latitude: Double,
    val longitude: Double
)

fun haversineDistanceKm(
    latitude1: Double,
    longitude1: Double,
    latitude2: Double,
    longitude2: Double
): Double {
    val radiusKm = 6371.0
    fun toRad(deg: Double) = deg * Math.PI / 180.0
    val dLat = toRad(latitude2 - latitude1)
    val dLon = toRad(longitude2 - longitude1)
    val lat1 = toRad(latitude1)
    val lat2 = toRad(latitude2)
    val a = Math.sin(dLat / 2).pow(2.0) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2).pow(2.0)
    val c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return radiusKm * c
}

fun parseGeoPoint(latitude: String?, longitude: String?): GeoPoint? {
    val lat = latitude?.toDoubleOrNull()
    val lng = longitude?.toDoubleOrNull()
    return if (lat != null && lng != null) GeoPoint(lat, lng) else null
}

@SuppressLint("MissingPermission")
fun fetchCurrentLocation(
    context: Context,
    onSuccess: (GeoPoint) -> Unit,
    onError: (String) -> Unit
) {
    try {
        val client = LocationServices.getFusedLocationProviderClient(context)
        val cancellationToken = CancellationTokenSource()
        client.getCurrentLocation(
            Priority.PRIORITY_HIGH_ACCURACY,
            cancellationToken.token
        ).addOnSuccessListener { location ->
            if (location != null) {
                onSuccess(GeoPoint(location.latitude, location.longitude))
            } else {
                onError("Unable to get current location. Please try again.")
            }
        }.addOnFailureListener { exception ->
            onError(exception.message ?: "Failed to get location")
        }
    } catch (e: Exception) {
        onError(e.message ?: "Location capture failed")
    }
}
