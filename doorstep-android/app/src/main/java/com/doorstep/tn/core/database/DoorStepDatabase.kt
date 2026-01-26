package com.doorstep.tn.core.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

/**
 * Room database for offline caching.
 * Stores products, services, and shops for offline access and faster loading.
 */
@Database(
    entities = [
        CachedProduct::class,
        CachedService::class,
        CachedShop::class,
        CacheMetadata::class
    ],
    version = 2,
    exportSchema = false
)
abstract class DoorStepDatabase : RoomDatabase() {
    
    abstract fun productCacheDao(): ProductCacheDao
    abstract fun serviceCacheDao(): ServiceCacheDao
    abstract fun shopCacheDao(): ShopCacheDao
    abstract fun cacheMetadataDao(): CacheMetadataDao
    
    companion object {
        private const val DATABASE_NAME = "doorstep_cache.db"
        
        @Volatile
        private var INSTANCE: DoorStepDatabase? = null
        
        fun getInstance(context: Context): DoorStepDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    DoorStepDatabase::class.java,
                    DATABASE_NAME
                )
                    .fallbackToDestructiveMigration(dropAllTables = true) // For cache DB, data loss is acceptable
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
