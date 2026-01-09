package com.doorstep.tn.core.database

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Room entities for local caching of API data.
 * These enable offline-first functionality and faster app startup.
 */

/**
 * Cached product entity for offline access
 */
@Entity(tableName = "cached_products")
data class CachedProduct(
    @PrimaryKey val id: Int,
    val name: String,
    val description: String?,
    val price: String,
    val mrp: String?,
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
@Entity(tableName = "cached_services")
data class CachedService(
    @PrimaryKey val id: Int,
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
@Entity(tableName = "cached_shops")
data class CachedShop(
    @PrimaryKey val id: Int,
    val name: String,
    val description: String?,
    val address: String?,
    val phone: String?,
    val category: String?,
    val images: String?, // JSON array stored as string
    val rating: Double?,
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
    val expiresAt: Long = System.currentTimeMillis() + (5 * 60 * 1000) // 5 min default TTL
)
