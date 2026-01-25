package com.doorstep.tn.common.util

import android.annotation.SuppressLint
import android.content.Context
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource

data class GeoPoint(
    val latitude: Double,
    val longitude: Double
)

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
