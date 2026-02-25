package com.doorstep.tn.core.database

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Room entities for local caching of API data.
 * These enable offline-first functionality and faster app startup.
 */

/**
 * Cached product entity for offline access
 */
@Entity(
    tableName = "cached_products",
    primaryKeys = ["cacheKey", "id"],
    indices = [
        Index(value = ["cacheKey"]),
        Index(value = ["id"]),
        Index(value = ["cachedAt"])
    ]
)
data class CachedProduct(
    val cacheKey: String,
    val id: Int,
    val itemOrder: Int = 0,
    val name: String,
    val description: String?,
    val price: String,
    val mrp: String?,
    val minOrderQuantity: Int?,
    val maxOrderQuantity: Int?,
    val category: String?,
    val images: String?, // JSON array stored as string
    val shopId: Int?,
    val shopName: String?,
    val isAvailable: Boolean = true,
    val cachedAt: Long = System.currentTimeMillis()
)

/**
 * Cached service entity for offline access
 */
@Entity(
    tableName = "cached_services",
    primaryKeys = ["cacheKey", "id"],
    indices = [
        Index(value = ["cacheKey"]),
        Index(value = ["id"]),
        Index(value = ["cachedAt"])
    ]
)
data class CachedService(
    val cacheKey: String,
    val id: Int,
    val itemOrder: Int = 0,
    val name: String,
    val description: String?,
    val price: String,
    val category: String?,
    val images: String?, // JSON array stored as string
    val providerId: Int?,
    val providerName: String?,
    val duration: Int?,
    val rating: Double?,
    val reviewCount: Int = 0,
    val isAvailableNow: Boolean = true,
    val cachedAt: Long = System.currentTimeMillis()
)

/**
 * Cached shop entity for offline access
 */
@Entity(
    tableName = "cached_shops",
    primaryKeys = ["cacheKey", "id"],
    indices = [
        Index(value = ["cacheKey"]),
        Index(value = ["id"]),
        Index(value = ["cachedAt"])
    ]
)
data class CachedShop(
    val cacheKey: String,
    val id: Int,
    val itemOrder: Int = 0,
    val name: String,
    val description: String?,
    val address: String?,
    val phone: String?,
    val category: String?,
    val images: String?, // JSON array stored as string
    val rating: Double?,
    val pickupAvailable: Boolean = false,
    val deliveryAvailable: Boolean = false,
    val isOpen: Boolean = true,
    val cachedAt: Long = System.currentTimeMillis()
)

/**
 * Cache metadata to track when data was last updated
 */
@Entity(tableName = "cache_metadata")
data class CacheMetadata(
    @PrimaryKey val cacheKey: String,
    val lastUpdated: Long = System.currentTimeMillis(),
    val expiresAt: Long = System.currentTimeMillis() + (5 * 60 * 1000), // 5 min default TTL
    val responsePage: Int? = null,
    val responsePageSize: Int? = null,
    val responseHasMore: Boolean? = null
)
