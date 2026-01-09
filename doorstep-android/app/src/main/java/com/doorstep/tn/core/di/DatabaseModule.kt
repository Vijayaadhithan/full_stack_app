package com.doorstep.tn.core.di

import android.content.Context
import com.doorstep.tn.core.database.CacheMetadataDao
import com.doorstep.tn.core.database.DoorStepDatabase
import com.doorstep.tn.core.database.ProductCacheDao
import com.doorstep.tn.core.database.ServiceCacheDao
import com.doorstep.tn.core.database.ShopCacheDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Hilt module for database dependencies.
 * Provides Room database and DAOs for caching.
 */
@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {
    
    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): DoorStepDatabase {
        return DoorStepDatabase.getInstance(context)
    }
    
    @Provides
    @Singleton
    fun provideProductCacheDao(database: DoorStepDatabase): ProductCacheDao {
        return database.productCacheDao()
    }
    
    @Provides
    @Singleton
    fun provideServiceCacheDao(database: DoorStepDatabase): ServiceCacheDao {
        return database.serviceCacheDao()
    }
    
    @Provides
    @Singleton
    fun provideShopCacheDao(database: DoorStepDatabase): ShopCacheDao {
        return database.shopCacheDao()
    }
    
    @Provides
    @Singleton
    fun provideCacheMetadataDao(database: DoorStepDatabase): CacheMetadataDao {
        return database.cacheMetadataDao()
    }
}
