package com.doorstep.tn

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import dagger.hilt.android.HiltAndroidApp
import java.io.File

/**
 * Application class for DoorStep TN.
 * Annotated with @HiltAndroidApp to enable Hilt dependency injection.
 * Implements ImageLoaderFactory for optimized image caching.
 */
@HiltAndroidApp
class DoorStepApp : Application(), ImageLoaderFactory {
    
    override fun onCreate() {
        super.onCreate()
        // Application initialization can go here
    }
    
    /**
     * Custom ImageLoader configuration with optimized caching.
     * - Memory cache: 25% of app memory for frequently viewed images
     * - Disk cache: 50MB for offline image access and faster loads
     * - Crossfade: Smooth transitions for better UX
     */
    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.25) // Use 25% of available memory
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(File(cacheDir, "image_cache"))
                    .maxSizeBytes(50 * 1024 * 1024) // 50 MB disk cache
                    .build()
            }
            .crossfade(true)
            .respectCacheHeaders(false) // Ignore server cache headers for better offline support
            .build()
    }
}
