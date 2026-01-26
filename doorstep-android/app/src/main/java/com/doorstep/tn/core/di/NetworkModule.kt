package com.doorstep.tn.core.di

import android.content.Context
import com.doorstep.tn.BuildConfig
import com.doorstep.tn.core.network.AuthInterceptor
import com.doorstep.tn.core.network.DoorStepApi
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.Cache
import okhttp3.CertificatePinner
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.io.File
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

/**
 * Hilt module for network dependencies
 */
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    
    private const val HTTP_CACHE_SIZE = 10L * 1024 * 1024 // 10 MB

    private fun buildCertificatePinner(): CertificatePinner? {
        val rawPins = BuildConfig.API_CERT_PINS.trim()
        if (rawPins.isEmpty()) {
            return null
        }

        val host = BuildConfig.API_BASE_URL
            .trim()
            .trimEnd('/')
            .toHttpUrlOrNull()
            ?.host
            ?: return null

        val pins = rawPins.split(",")
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .map { pin ->
                if (pin.startsWith("sha256/")) pin else "sha256/$pin"
            }

        if (pins.isEmpty()) {
            return null
        }

        val builder = CertificatePinner.Builder()
        pins.forEach { pin ->
            builder.add(host, pin)
        }
        return builder.build()
    }
    
    @Provides
    @Singleton
    fun provideMoshi(): Moshi {
        return Moshi.Builder()
            .add(KotlinJsonAdapterFactory())
            .build()
    }
    
    @Provides
    @Singleton
    fun provideLoggingInterceptor(): HttpLoggingInterceptor {
        return HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }
    }
    
    @Provides
    @Singleton
    fun provideAuthInterceptor(
        @ApplicationContext context: Context
    ): AuthInterceptor {
        return AuthInterceptor(context)
    }
    
    @Provides
    @Singleton
    fun provideHttpCache(@ApplicationContext context: Context): Cache {
        val cacheDir = File(context.cacheDir, "http_cache")
        return Cache(cacheDir, HTTP_CACHE_SIZE)
    }
    
    @Provides
    @Singleton
    fun provideOkHttpClient(
        loggingInterceptor: HttpLoggingInterceptor,
        authInterceptor: AuthInterceptor,
        cache: Cache
    ): OkHttpClient {
        val certificatePinner = buildCertificatePinner()
        return OkHttpClient.Builder()
            .cache(cache)
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            .apply {
                if (certificatePinner != null) {
                    certificatePinner(certificatePinner)
                }
            }
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }
    
    @Provides
    @Singleton
    fun provideRetrofit(
        okHttpClient: OkHttpClient,
        moshi: Moshi
    ): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL + "/")
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
    }
    
    @Provides
    @Singleton
    fun provideDoorStepApi(retrofit: Retrofit): DoorStepApi {
        return retrofit.create(DoorStepApi::class.java)
    }
}
