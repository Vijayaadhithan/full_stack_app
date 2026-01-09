package com.doorstep.tn.core.cache

import com.doorstep.tn.core.database.*
import com.doorstep.tn.customer.data.model.Product
import com.doorstep.tn.customer.data.model.Service
import com.doorstep.tn.customer.data.model.Shop
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for managing cached data in Room database.
 * Provides offline-first data access with automatic cache expiration.
 */
@Singleton
class CacheRepository @Inject constructor(
    private val productCacheDao: ProductCacheDao,
    private val serviceCacheDao: ServiceCacheDao,
    private val shopCacheDao: ShopCacheDao,
    private val cacheMetadataDao: CacheMetadataDao
) {
    companion object {
        private const val CACHE_TTL_MS = 5 * 60 * 1000L // 5 minutes
    }
    
    // ==================== Products ====================
    
    /**
     * Get all cached products as Flow
     */
    fun getCachedProducts(): Flow<List<Product>> {
        return productCacheDao.getAllProducts().map { cachedList ->
            cachedList.map { it.toProduct() }
        }
    }
    
    /**
     * Get cached product by ID
     */
    suspend fun getCachedProduct(productId: Int): Product? {
        return productCacheDao.getProductById(productId)?.toProduct()
    }
    
    /**
     * Cache products from API response
     */
    suspend fun cacheProducts(products: List<Product>, cacheKey: String) {
        val cachedProducts = products.map { it.toCachedProduct() }
        productCacheDao.insertProducts(cachedProducts)
        cacheMetadataDao.setMetadata(
            CacheMetadata(
                cacheKey = cacheKey,
                expiresAt = System.currentTimeMillis() + CACHE_TTL_MS
            )
        )
    }
    
    /**
     * Check if products cache is valid
     */
    suspend fun isProductsCacheValid(cacheKey: String): Boolean {
        return cacheMetadataDao.isCacheValid(cacheKey)
    }
    
    // ==================== Services ====================
    
    fun getCachedServices(): Flow<List<Service>> {
        return serviceCacheDao.getAllServices().map { cachedList ->
            cachedList.map { it.toService() }
        }
    }
    
    suspend fun getCachedService(serviceId: Int): Service? {
        return serviceCacheDao.getServiceById(serviceId)?.toService()
    }
    
    suspend fun cacheServices(services: List<Service>, cacheKey: String) {
        val cachedServices = services.map { it.toCachedService() }
        serviceCacheDao.insertServices(cachedServices)
        cacheMetadataDao.setMetadata(
            CacheMetadata(
                cacheKey = cacheKey,
                expiresAt = System.currentTimeMillis() + CACHE_TTL_MS
            )
        )
    }
    
    suspend fun isServicesCacheValid(cacheKey: String): Boolean {
        return cacheMetadataDao.isCacheValid(cacheKey)
    }
    
    // ==================== Shops ====================
    
    fun getCachedShops(): Flow<List<Shop>> {
        return shopCacheDao.getAllShops().map { cachedList ->
            cachedList.map { it.toShop() }
        }
    }
    
    suspend fun getCachedShop(shopId: Int): Shop? {
        return shopCacheDao.getShopById(shopId)?.toShop()
    }
    
    suspend fun cacheShops(shops: List<Shop>, cacheKey: String) {
        val cachedShops = shops.map { it.toCachedShop() }
        shopCacheDao.insertShops(cachedShops)
        cacheMetadataDao.setMetadata(
            CacheMetadata(
                cacheKey = cacheKey,
                expiresAt = System.currentTimeMillis() + CACHE_TTL_MS
            )
        )
    }
    
    suspend fun isShopsCacheValid(cacheKey: String): Boolean {
        return cacheMetadataDao.isCacheValid(cacheKey)
    }
    
    // ==================== Cleanup ====================
    
    /**
     * Clear all expired cache entries
     */
    suspend fun clearExpiredCache() {
        val expireTime = System.currentTimeMillis() - CACHE_TTL_MS
        productCacheDao.deleteExpiredProducts(expireTime)
        serviceCacheDao.deleteExpiredServices(expireTime)
        shopCacheDao.deleteExpiredShops(expireTime)
        cacheMetadataDao.deleteExpired()
    }
    
    /**
     * Clear all cached data
     */
    suspend fun clearAllCache() {
        productCacheDao.clearAll()
        serviceCacheDao.clearAll()
        shopCacheDao.clearAll()
    }
}

// ==================== Extension functions for mapping ====================

private fun CachedProduct.toProduct(): Product {
    return Product(
        id = id,
        name = name,
        description = description,
        price = price,
        mrp = mrp,
        category = category,
        images = images?.split(",")?.filter { it.isNotBlank() },
        shopId = shopId,
        isAvailable = isAvailable
    )
}

private fun Product.toCachedProduct(): CachedProduct {
    return CachedProduct(
        id = id,
        name = name,
        description = description,
        price = price,
        mrp = mrp,
        category = category,
        images = images?.joinToString(","),
        shopId = shopId,
        shopName = null, // Not available in base Product model
        isAvailable = isAvailable
    )
}

private fun CachedService.toService(): Service {
    return Service(
        id = id,
        name = name,
        description = description,
        price = price,
        category = category,
        images = images?.split(",")?.filter { it.isNotBlank() },
        providerId = providerId,
        duration = duration,
        rating = rating,
        reviewCount = reviewCount,
        isAvailableNow = isAvailableNow
    )
}

private fun Service.toCachedService(): CachedService {
    return CachedService(
        id = id,
        name = name,
        description = description,
        price = price,
        category = category,
        images = images?.joinToString(","),
        providerId = providerId,
        providerName = provider?.name,
        duration = duration,
        rating = rating,
        reviewCount = reviewCount,
        isAvailableNow = isAvailableNow
    )
}

private fun CachedShop.toShop(): Shop {
    return Shop(
        id = id,
        name = name,
        description = description,
        phone = phone,
        rating = rating,
        isOpen = isOpen
    )
}

private fun Shop.toCachedShop(): CachedShop {
    return CachedShop(
        id = id,
        name = name,
        description = description,
        address = addressStreet,
        phone = phone,
        category = null, // Not available in Shop model
        images = profileImage,
        rating = rating,
        isOpen = isOpen
    )
}
