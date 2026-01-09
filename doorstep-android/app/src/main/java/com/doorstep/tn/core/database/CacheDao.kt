package com.doorstep.tn.core.database

import androidx.room.*
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Objects for cached data.
 * Provides database operations for offline caching.
 */

@Dao
interface ProductCacheDao {
    @Query("SELECT * FROM cached_products ORDER BY cachedAt DESC")
    fun getAllProducts(): Flow<List<CachedProduct>>
    
    @Query("SELECT * FROM cached_products WHERE id = :productId")
    suspend fun getProductById(productId: Int): CachedProduct?
    
    @Query("SELECT * FROM cached_products WHERE category = :category ORDER BY cachedAt DESC")
    fun getProductsByCategory(category: String): Flow<List<CachedProduct>>
    
    @Query("SELECT * FROM cached_products WHERE name LIKE '%' || :query || '%' ORDER BY cachedAt DESC")
    fun searchProducts(query: String): Flow<List<CachedProduct>>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProducts(products: List<CachedProduct>)
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProduct(product: CachedProduct)
    
    @Query("DELETE FROM cached_products WHERE cachedAt < :expireTime")
    suspend fun deleteExpiredProducts(expireTime: Long)
    
    @Query("DELETE FROM cached_products")
    suspend fun clearAll()
}

@Dao
interface ServiceCacheDao {
    @Query("SELECT * FROM cached_services ORDER BY cachedAt DESC")
    fun getAllServices(): Flow<List<CachedService>>
    
    @Query("SELECT * FROM cached_services WHERE id = :serviceId")
    suspend fun getServiceById(serviceId: Int): CachedService?
    
    @Query("SELECT * FROM cached_services WHERE category = :category ORDER BY cachedAt DESC")
    fun getServicesByCategory(category: String): Flow<List<CachedService>>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertServices(services: List<CachedService>)
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertService(service: CachedService)
    
    @Query("DELETE FROM cached_services WHERE cachedAt < :expireTime")
    suspend fun deleteExpiredServices(expireTime: Long)
    
    @Query("DELETE FROM cached_services")
    suspend fun clearAll()
}

@Dao
interface ShopCacheDao {
    @Query("SELECT * FROM cached_shops ORDER BY cachedAt DESC")
    fun getAllShops(): Flow<List<CachedShop>>
    
    @Query("SELECT * FROM cached_shops WHERE id = :shopId")
    suspend fun getShopById(shopId: Int): CachedShop?
    
    @Query("SELECT * FROM cached_shops WHERE category = :category ORDER BY cachedAt DESC")
    fun getShopsByCategory(category: String): Flow<List<CachedShop>>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertShops(shops: List<CachedShop>)
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertShop(shop: CachedShop)
    
    @Query("DELETE FROM cached_shops WHERE cachedAt < :expireTime")
    suspend fun deleteExpiredShops(expireTime: Long)
    
    @Query("DELETE FROM cached_shops")
    suspend fun clearAll()
}

@Dao
interface CacheMetadataDao {
    @Query("SELECT * FROM cache_metadata WHERE cacheKey = :key")
    suspend fun getMetadata(key: String): CacheMetadata?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun setMetadata(metadata: CacheMetadata)
    
    @Query("DELETE FROM cache_metadata WHERE expiresAt < :now")
    suspend fun deleteExpired(now: Long = System.currentTimeMillis())
    
    /**
     * Check if cache for given key is still valid
     */
    @Query("SELECT COUNT(*) > 0 FROM cache_metadata WHERE cacheKey = :key AND expiresAt > :now")
    suspend fun isCacheValid(key: String, now: Long = System.currentTimeMillis()): Boolean
}
