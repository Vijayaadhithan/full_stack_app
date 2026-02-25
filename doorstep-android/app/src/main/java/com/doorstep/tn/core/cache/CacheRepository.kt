package com.doorstep.tn.core.cache

import com.doorstep.tn.core.database.*
import com.doorstep.tn.customer.data.model.Product
import com.doorstep.tn.customer.data.model.Service
import com.doorstep.tn.customer.data.model.Shop
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
     * Get cached products for a specific cache key.
     */
    suspend fun getCachedProducts(cacheKey: String): List<Product> {
        return productCacheDao.getProductsByCacheKey(cacheKey).map { it.toProduct() }
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
    suspend fun cacheProducts(
        products: List<Product>,
        cacheKey: String,
        page: Int,
        pageSize: Int,
        hasMore: Boolean
    ) {
        val cachedProducts = products.mapIndexed { index, product ->
            product.toCachedProduct(cacheKey, index)
        }
        productCacheDao.deleteByCacheKey(cacheKey)
        productCacheDao.insertProducts(cachedProducts)
        cacheMetadataDao.setMetadata(
            CacheMetadata(
                cacheKey = cacheKey,
                expiresAt = System.currentTimeMillis() + CACHE_TTL_MS,
                responsePage = page,
                responsePageSize = pageSize,
                responseHasMore = hasMore
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
    
    suspend fun getCachedServices(cacheKey: String): List<Service> {
        return serviceCacheDao.getServicesByCacheKey(cacheKey).map { it.toService() }
    }
    
    suspend fun getCachedService(serviceId: Int): Service? {
        return serviceCacheDao.getServiceById(serviceId)?.toService()
    }
    
    suspend fun cacheServices(
        services: List<Service>,
        cacheKey: String,
        page: Int,
        pageSize: Int,
        hasMore: Boolean
    ) {
        val cachedServices = services.mapIndexed { index, service ->
            service.toCachedService(cacheKey, index)
        }
        serviceCacheDao.deleteByCacheKey(cacheKey)
        serviceCacheDao.insertServices(cachedServices)
        cacheMetadataDao.setMetadata(
            CacheMetadata(
                cacheKey = cacheKey,
                expiresAt = System.currentTimeMillis() + CACHE_TTL_MS,
                responsePage = page,
                responsePageSize = pageSize,
                responseHasMore = hasMore
            )
        )
    }
    
    suspend fun isServicesCacheValid(cacheKey: String): Boolean {
        return cacheMetadataDao.isCacheValid(cacheKey)
    }
    
    // ==================== Shops ====================
    
    suspend fun getCachedShops(cacheKey: String): List<Shop> {
        return shopCacheDao.getShopsByCacheKey(cacheKey).map { it.toShop() }
    }
    
    suspend fun getCachedShop(shopId: Int): Shop? {
        return shopCacheDao.getShopById(shopId)?.toShop()
    }
    
    suspend fun cacheShops(shops: List<Shop>, cacheKey: String) {
        val cachedShops = shops.mapIndexed { index, shop ->
            shop.toCachedShop(cacheKey, index)
        }
        shopCacheDao.deleteByCacheKey(cacheKey)
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

    suspend fun getCacheMetadata(cacheKey: String): CacheMetadata? {
        return cacheMetadataDao.getMetadata(cacheKey)
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
        minOrderQuantity = minOrderQuantity,
        maxOrderQuantity = maxOrderQuantity,
        category = category,
        images = images?.split(",")?.filter { it.isNotBlank() },
        shopId = shopId,
        isAvailable = isAvailable
    )
}

private fun Product.toCachedProduct(cacheKey: String, itemOrder: Int): CachedProduct {
    return CachedProduct(
        cacheKey = cacheKey,
        id = id,
        itemOrder = itemOrder,
        name = name,
        description = description,
        price = price,
        mrp = mrp,
        minOrderQuantity = minOrderQuantity,
        maxOrderQuantity = maxOrderQuantity,
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

private fun Service.toCachedService(cacheKey: String, itemOrder: Int): CachedService {
    return CachedService(
        cacheKey = cacheKey,
        id = id,
        itemOrder = itemOrder,
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
        shopProfile = com.doorstep.tn.customer.data.model.ShopProfile(
            shopName = name,
            description = description
        ),
        phone = phone,
        profilePicture = images,
        averageRating = rating?.toString(),
        pickupAvailable = pickupAvailable,
        deliveryAvailable = deliveryAvailable
    )
}

private fun Shop.toCachedShop(cacheKey: String, itemOrder: Int): CachedShop {
    return CachedShop(
        cacheKey = cacheKey,
        id = id,
        itemOrder = itemOrder,
        name = displayName,
        description = description,
        address = addressStreet,
        phone = phone,
        category = null, // Not available in Shop model
        images = profileImage,
        rating = rating,
        pickupAvailable = pickupAvailable,
        deliveryAvailable = deliveryAvailable,
        isOpen = isOpen
    )
}
